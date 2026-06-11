use crate::auth::{can_access_case, check_permission, AuthGuard};
use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{
    ApiResponse, CaseActionRequest, CaseDetail, CaseListRequest, CaseListResponse, CasePriority,
    CaseQueue, CaseRegistration, CaseStatus, CreateCaseRequest, LegalCase, ProcessingRecord,
    UpdateCaseRequest, UserRole,
};
use crate::utils::{
    check_version, generate_case_no, get_case, get_user_name, get_warning_status,
    init_module_records, record_audit_note, record_processing_record,
    update_case_status,
};
use chrono::Utc;
use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::Route;

pub fn routes() -> Vec<Route> {
    rocket::routes![
        list_cases,
        get_case_detail,
        create_case,
        update_case,
        delete_case,
        case_action,
        get_processing_records,
    ]
}

#[get("/cases?<params..>")]
fn list_cases(
    db: &Database,
    auth: AuthGuard,
    params: CaseListRequest,
) -> Result<(Status, Json<ApiResponse<CaseListResponse>>)> {
    let conn = db.conn.lock();

    let mut where_clauses: Vec<String> = Vec::new();
    let mut params_vec: Vec<String> = Vec::new();

    let accessible_statuses = crate::auth::get_accessible_statuses(&auth.user);
    let status_placeholders: Vec<String> = accessible_statuses
        .iter()
        .map(|s| format!("'{}'", s.as_str()))
        .collect();
    where_clauses.push(format!("lc.status IN ({})", status_placeholders.join(", ")));

    match auth.user.role {
        UserRole::Registrar => {
            where_clauses.push("lc.created_by = ?".to_string());
            params_vec.push(auth.user.id.to_string());
        }
        UserRole::Assistant | UserRole::Lawyer => {
            where_clauses.push("lc.current_handler_id = ?".to_string());
            params_vec.push(auth.user.id.to_string());
        }
        _ => {}
    }

    if let Some(handler_id) = params.handler_id {
        where_clauses.push("lc.current_handler_id = ?".to_string());
        params_vec.push(handler_id.to_string());
    }

    if let Some(priority) = params.priority {
        if CasePriority::from_str(&priority).is_some() {
            where_clauses.push("lc.priority = ?".to_string());
            params_vec.push(priority);
        }
    }

    if let Some(status) = params.status {
        if CaseStatus::from_str(&status).is_some() {
            where_clauses.push("lc.status = ?".to_string());
            params_vec.push(status);
        }
    }

    if let Some(deadline_from) = params.deadline_from {
        where_clauses.push("lc.deadline >= ?".to_string());
        params_vec.push(deadline_from);
    }

    if let Some(deadline_to) = params.deadline_to {
        where_clauses.push("lc.deadline <= ?".to_string());
        params_vec.push(deadline_to);
    }

    if let Some(keyword) = params.keyword {
        where_clauses.push("(lc.title LIKE ? OR lc.case_no LIKE ?)".to_string());
        let kw = format!("%{}%", keyword);
        params_vec.push(kw.clone());
        params_vec.push(kw);
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let count_sql = format!(
        "SELECT COUNT(*) FROM legal_cases lc {}",
        where_sql
    );
    let total: i64 = conn.query_row(&count_sql, rusqlite::params_from_iter(&params_vec), |row| row.get(0))?;

    let offset = (params.page - 1) * params.page_size;
    let query_sql = format!(
        "SELECT lc.id, lc.case_no, lc.title, lc.priority, lc.status, lc.queue, 
                lc.current_handler_id, lc.deadline, lc.version, lc.created_by, 
                lc.created_at, lc.updated_at, 
                u1.real_name as handler_name, u2.real_name as creator_name
         FROM legal_cases lc
         LEFT JOIN users u1 ON lc.current_handler_id = u1.id
         LEFT JOIN users u2 ON lc.created_by = u2.id
         {}
         ORDER BY lc.created_at DESC
         LIMIT ? OFFSET ?",
        where_sql
    );

    let mut stmt = conn.prepare(&query_sql)?;
    let mut params_with_limit = params_vec.clone();
    params_with_limit.push(params.page_size.to_string());
    params_with_limit.push(offset.to_string());

    let cases = stmt.query_map(rusqlite::params_from_iter(&params_with_limit), |row| {
        let priority_str: String = row.get(3)?;
        let status_str: String = row.get(4)?;
        let queue_str: String = row.get(5)?;
        let deadline: Option<chrono::DateTime<Utc>> = row.get(7)?;

        Ok(LegalCase {
            id: row.get(0)?,
            case_no: row.get(1)?,
            title: row.get(2)?,
            priority: CasePriority::from_str(&priority_str).unwrap_or(CasePriority::Normal),
            status: CaseStatus::from_str(&status_str).unwrap_or(CaseStatus::Draft),
            queue: CaseQueue::from_str(&queue_str).unwrap_or(CaseQueue::Registration),
            current_handler_id: row.get(6)?,
            current_handler_name: row.get(12)?,
            deadline,
            version: row.get(8)?,
            created_by: row.get(9)?,
            created_by_name: row.get(13)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
            warning_status: get_warning_status(deadline),
        })
    })?;

    let mut list: Vec<LegalCase> = Vec::new();
    for case in cases {
        list.push(case?);
    }

    let response = CaseListResponse {
        list,
        total,
        page: params.page,
        page_size: params.page_size,
    };

    Ok((
        Status::Ok,
        Json(ApiResponse::success(response, "查询成功")),
    ))
}

#[get("/cases/<id>")]
fn get_case_detail(
    db: &Database,
    auth: AuthGuard,
    id: i64,
) -> Result<(Status, Json<ApiResponse<CaseDetail>>)> {
    let case = get_case(db, id)?;

    if !can_access_case(&auth.user, case.created_by, case.current_handler_id, &case.status) {
        return Err(AppError::PermissionError(format!(
            "用户无权查看此案件，案件ID: {}",
            id
        )));
    }

    let conn = db.conn.lock();

    let mut reg_stmt = conn.prepare(
        "SELECT id, case_id, client_name, client_phone, client_id_card, consultation_type, 
         consultation_content, evidence_provided, registration_remark, registered_by, registered_at, 
         is_complete, created_at, updated_at FROM case_registration WHERE case_id = ?1",
    )?;
    let registration: Option<CaseRegistration> = reg_stmt
        .query_row([id], |row| {
            Ok(CaseRegistration {
                id: row.get(0)?,
                case_id: row.get(1)?,
                client_name: row.get(2)?,
                client_phone: row.get(3)?,
                client_id_card: row.get(4)?,
                consultation_type: row.get(5)?,
                consultation_content: row.get(6)?,
                evidence_provided: row.get(7)?,
                registration_remark: row.get(8)?,
                registered_by: row.get(9)?,
                registered_at: row.get(10)?,
                is_complete: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            })
        })
        .ok();

    let mut assign_stmt = conn.prepare(
        "SELECT ca.id, ca.case_id, ca.assistant_id, ca.lawyer_id, ca.assignment_reason, 
                ca.assignment_remark, ca.assigned_by, ca.assigned_at, ca.is_complete, 
                ca.created_at, ca.updated_at,
                u1.real_name as assistant_name, u2.real_name as lawyer_name
         FROM case_assignment ca
         LEFT JOIN users u1 ON ca.assistant_id = u1.id
         LEFT JOIN users u2 ON ca.lawyer_id = u2.id
         WHERE ca.case_id = ?1",
    )?;
    let assignment: Option<crate::models::CaseAssignment> = assign_stmt
        .query_row([id], |row| {
            Ok(crate::models::CaseAssignment {
                id: row.get(0)?,
                case_id: row.get(1)?,
                assistant_id: row.get(2)?,
                assistant_name: row.get(11)?,
                lawyer_id: row.get(3)?,
                lawyer_name: row.get(12)?,
                assignment_reason: row.get(4)?,
                assignment_remark: row.get(5)?,
                assigned_by: row.get(6)?,
                assigned_at: row.get(7)?,
                is_complete: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .ok();

    let mut followup_stmt = conn.prepare(
        "SELECT id, case_id, followup_result, client_satisfaction, followup_remark, 
         followup_by, followup_at, is_complete, created_at, updated_at FROM case_followup WHERE case_id = ?1",
    )?;
    let followup: Option<crate::models::CaseFollowup> = followup_stmt
        .query_row([id], |row| {
            Ok(crate::models::CaseFollowup {
                id: row.get(0)?,
                case_id: row.get(1)?,
                followup_result: row.get(2)?,
                client_satisfaction: row.get(3)?,
                followup_remark: row.get(4)?,
                followup_by: row.get(5)?,
                followup_at: row.get(6)?,
                is_complete: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .ok();

    let mut case = case;
    case.current_handler_name = case.current_handler_id.and_then(|id| get_user_name(db, id).ok().flatten());
    case.created_by_name = Some(get_user_name(db, case.created_by)?.unwrap_or_default());
    case.warning_status = get_warning_status(case.deadline);

    let detail = CaseDetail {
        case,
        registration,
        assignment,
        followup,
    };

    Ok((
        Status::Ok,
        Json(ApiResponse::success(detail, "查询成功")),
    ))
}

#[post("/cases", data = "<req>")]
fn create_case(
    db: &Database,
    auth: AuthGuard,
    req: Json<CreateCaseRequest>,
) -> Result<(Status, Json<ApiResponse<LegalCase>>)> {
    check_permission(
        &auth.user,
        &[UserRole::Registrar, UserRole::Supervisor, UserRole::Director],
        "创建案件",
    )?;

    if req.title.trim().is_empty() {
        return Err(AppError::BadRequest("案件标题不能为空".to_string()));
    }

    let priority = req
        .priority
        .as_ref()
        .and_then(|p| CasePriority::from_str(p))
        .unwrap_or(CasePriority::Normal);

    let deadline = req
        .deadline
        .as_ref()
        .and_then(|d| chrono::DateTime::parse_from_rfc3339(d).ok())
        .map(|d| d.with_timezone(&Utc));

    let case_no = generate_case_no();
    let now = Utc::now();

    let conn = db.conn.lock();
    conn.execute(
        "INSERT INTO legal_cases (case_no, title, priority, status, queue, deadline, version, created_by, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        (
            &case_no,
            &req.title,
            priority.as_str(),
            CaseStatus::Draft.as_str(),
            CaseQueue::Registration.as_str(),
            &deadline,
            1,
            auth.user.id,
            now,
            now,
        ),
    )?;

    let case_id = conn.last_insert_rowid();

    drop(conn);

    init_module_records(db, case_id)?;

    record_processing_record(
        db,
        case_id,
        "create",
        None,
        Some(CaseStatus::Draft.as_str()),
        auth.user.id,
        Some("创建新案件"),
    )?;

    record_audit_note(
        db,
        case_id,
        None,
        "case_created",
        &format!("用户 {} 创建了新案件", auth.user.real_name),
        Some(auth.user.id),
    )?;

    let case = get_case(db, case_id)?;

    Ok((
        Status::Created,
        Json(ApiResponse::success(case, "创建成功")),
    ))
}

#[put("/cases/<id>", data = "<req>")]
fn update_case(
    db: &Database,
    auth: AuthGuard,
    id: i64,
    req: Json<UpdateCaseRequest>,
) -> Result<(Status, Json<ApiResponse<LegalCase>>)> {
    let case = get_case(db, id)?;

    check_permission(
        &auth.user,
        &[UserRole::Registrar, UserRole::Supervisor, UserRole::Director],
        "更新案件",
    )?;

    if !can_access_case(&auth.user, case.created_by, case.current_handler_id, &case.status) {
        return Err(AppError::PermissionError(
            "用户无权更新此案件".to_string(),
        ));
    }

    check_version(case.version, req.version)?;

    if matches!(case.status, CaseStatus::Archived) {
        return Err(AppError::BadRequest("已归档的案件无法修改".to_string()));
    }

    let conn = db.conn.lock();

    if let Some(title) = &req.title {
        if title.trim().is_empty() {
            return Err(AppError::BadRequest("案件标题不能为空".to_string()));
        }
        conn.execute(
            "UPDATE legal_cases SET title = ?1, version = version + 1, updated_at = ?2 WHERE id = ?3",
            (title, Utc::now(), id),
        )?;
    }

    if let Some(priority_str) = &req.priority {
        if let Some(priority) = CasePriority::from_str(priority_str) {
            conn.execute(
                "UPDATE legal_cases SET priority = ?1, version = version + 1, updated_at = ?2 WHERE id = ?3",
                (priority.as_str(), Utc::now(), id),
            )?;
        }
    }

    if let Some(deadline_str) = &req.deadline {
        let deadline = chrono::DateTime::parse_from_rfc3339(deadline_str)
            .map(|d| d.with_timezone(&Utc))
            .map_err(|_| AppError::BadRequest("无效的日期格式".to_string()))?;
        conn.execute(
            "UPDATE legal_cases SET deadline = ?1, version = version + 1, updated_at = ?2 WHERE id = ?3",
            (&deadline, Utc::now(), id),
        )?;
    }

    drop(conn);

    let updated_case = get_case(db, id)?;

    record_processing_record(
        db,
        id,
        "update",
        Some(case.status.as_str()),
        Some(case.status.as_str()),
        auth.user.id,
        Some("更新案件基本信息"),
    )?;

    record_audit_note(
        db,
        id,
        None,
        "case_updated",
        &format!("用户 {} 更新了案件信息", auth.user.real_name),
        Some(auth.user.id),
    )?;

    Ok((
        Status::Ok,
        Json(ApiResponse::success(updated_case, "更新成功")),
    ))
}

#[delete("/cases/<id>")]
fn delete_case(
    db: &Database,
    auth: AuthGuard,
    id: i64,
) -> Result<(Status, Json<ApiResponse<&'static str>>)> {
    check_permission(
        &auth.user,
        &[UserRole::Supervisor, UserRole::Director],
        "删除案件",
    )?;

    let case = get_case(db, id)?;

    if !matches!(case.status, CaseStatus::Draft | CaseStatus::Archived) {
        return Err(AppError::BadRequest(
            "只能删除草稿或已归档状态的案件".to_string(),
        ));
    }

    let conn = db.conn.lock();
    conn.execute("DELETE FROM legal_cases WHERE id = ?1", [id])?;
    drop(conn);

    record_audit_note(
        db,
        id,
        None,
        "case_deleted",
        &format!("用户 {} 删除了案件", auth.user.real_name),
        Some(auth.user.id),
    )?;

    Ok((
        Status::Ok,
        Json(ApiResponse::success_no_data("删除成功")),
    ))
}

#[post("/cases/action", data = "<req>")]
fn case_action(
    db: &Database,
    auth: AuthGuard,
    req: Json<CaseActionRequest>,
) -> Result<(Status, Json<ApiResponse<LegalCase>>)> {
    let case = get_case(db, req.case_id)?;

    check_version(case.version, req.version)?;

    if !can_access_case(&auth.user, case.created_by, case.current_handler_id, &case.status) {
        return Err(AppError::PermissionError(
            "用户无权操作此案件".to_string(),
        ));
    }

    let action = req.action.as_str();
    let new_status = match action {
        "submit" => {
            check_permission(
                &auth.user,
                &[UserRole::Registrar, UserRole::Supervisor, UserRole::Director],
                "提交案件",
            )?;
            if matches!(case.status, CaseStatus::Draft | CaseStatus::PendingSubmit) {
                Some(CaseStatus::Submitted)
            } else if matches!(case.status, CaseStatus::Returned) {
                Some(CaseStatus::Resubmitted)
            } else {
                return Err(AppError::InvalidStatusTransition {
                    from: case.status.as_str().to_string(),
                    to: "submitted".to_string(),
                });
            }
        }
        "review" => {
            check_permission(
                &auth.user,
                &[UserRole::Reviewer, UserRole::Supervisor, UserRole::Director],
                "审核案件",
            )?;
            Some(CaseStatus::Reviewing)
        }
        "assign" => {
            check_permission(
                &auth.user,
                &[UserRole::Supervisor, UserRole::Director],
                "分派案件",
            )?;
            Some(CaseStatus::Assigned)
        }
        "start_followup" => {
            check_permission(
                &auth.user,
                &[UserRole::Assistant, UserRole::Lawyer, UserRole::Supervisor, UserRole::Director],
                "开始回访",
            )?;
            Some(CaseStatus::Followup)
        }
        "complete" => {
            check_permission(
                &auth.user,
                &[UserRole::Assistant, UserRole::Lawyer, UserRole::Supervisor, UserRole::Director],
                "完成案件",
            )?;
            Some(CaseStatus::Completed)
        }
        "archive" => {
            check_permission(
                &auth.user,
                &[UserRole::Supervisor, UserRole::Director],
                "归档案件",
            )?;
            Some(CaseStatus::Archived)
        }
        "return" => {
            check_permission(
                &auth.user,
                &[UserRole::Reviewer, UserRole::Supervisor, UserRole::Director],
                "退回案件",
            )?;
            Some(CaseStatus::Returned)
        }
        _ => {
            return Err(AppError::BadRequest(format!(
                "不支持的操作: {}",
                action
            )));
        }
    };

    if let Some(new_status) = new_status {
        update_case_status(
            db,
            req.case_id,
            &case.status,
            &new_status,
            auth.user.id,
            req.remark.as_deref(),
        )?;

        record_audit_note(
            db,
            req.case_id,
            None,
            "status_change",
            &format!(
                "用户 {} 将案件状态从 {} 变更为 {}",
                auth.user.real_name,
                case.status.as_str(),
                new_status.as_str()
            ),
            Some(auth.user.id),
        )?;
    }

    let updated_case = get_case(db, req.case_id)?;

    Ok((
        Status::Ok,
        Json(ApiResponse::success(updated_case, "操作成功")),
    ))
}

#[get("/cases/<id>/records")]
fn get_processing_records(
    db: &Database,
    auth: AuthGuard,
    id: i64,
) -> Result<(Status, Json<ApiResponse<Vec<ProcessingRecord>>)> {
    let case = get_case(db, id)?;

    if !can_access_case(&auth.user, case.created_by, case.current_handler_id, &case.status) {
        return Err(AppError::PermissionError(
            "用户无权查看此案件的处理记录".to_string(),
        ));
    }

    let conn = db.conn.lock();
    let mut stmt = conn.prepare(
        "SELECT pr.id, pr.case_id, pr.action, pr.from_status, pr.to_status, 
                pr.operator_id, pr.remark, pr.created_at, u.real_name as operator_name
         FROM processing_records pr
         LEFT JOIN users u ON pr.operator_id = u.id
         WHERE pr.case_id = ?1
         ORDER BY pr.created_at DESC",
    )?;

    let records = stmt.query_map([id], |row| {
        Ok(ProcessingRecord {
            id: row.get(0)?,
            case_id: row.get(1)?,
            action: row.get(2)?,
            from_status: row.get(3)?,
            to_status: row.get(4)?,
            operator_id: row.get(5)?,
            operator_name: row.get(8)?,
            remark: row.get(6)?,
            created_at: row.get(7)?,
        })
    })?;

    let mut list: Vec<ProcessingRecord> = Vec::new();
    for record in records {
        list.push(record?);
    }

    Ok((
        Status::Ok,
        Json(ApiResponse::success(list, "查询成功")),
    ))
}

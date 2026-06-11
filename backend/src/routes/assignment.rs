use crate::auth::{can_access_case, check_permission, AuthGuard};
use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{ApiResponse, AssignmentUpdateRequest, CaseAssignment, CaseStatus, UserRole};
use crate::utils::{
    check_assignment_complete, check_version, get_case, get_user_name, record_audit_note,
    record_exception, record_processing_record,
};
use chrono::Utc;
use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::Route;

pub fn routes() -> Vec<Route> {
    rocket::routes![get_assignment, update_assignment, check_assignment_complete_status, verify_assignment]
}

#[get("/cases/<case_id>/assignment")]
fn get_assignment(
    db: &Database,
    auth: AuthGuard,
    case_id: i64,
) -> Result<(Status, Json<ApiResponse<CaseAssignment>>)> {
    let case = get_case(db, case_id)?;

    if !can_access_case(&auth.user, case.created_by, case.current_handler_id, &case.status) {
        return Err(AppError::PermissionError(
            "用户无权查看此案件的分派信息".to_string(),
        ));
    }

    let conn = db.conn.lock();
    let mut stmt = conn.prepare(
        "SELECT ca.id, ca.case_id, ca.assistant_id, ca.lawyer_id, ca.assignment_reason, 
                ca.assignment_remark, ca.assigned_by, ca.assigned_at, ca.is_complete, 
                ca.created_at, ca.updated_at,
                u1.real_name as assistant_name, u2.real_name as lawyer_name
         FROM case_assignment ca
         LEFT JOIN users u1 ON ca.assistant_id = u1.id
         LEFT JOIN users u2 ON ca.lawyer_id = u2.id
         WHERE ca.case_id = ?1",
    )?;

    let assignment = stmt.query_row([case_id], |row| {
        Ok(CaseAssignment {
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
    })?;

    Ok((
        Status::Ok,
        Json(ApiResponse::success(assignment, "查询成功")),
    ))
}

#[put("/cases/<case_id>/assignment", data = "<req>")]
fn update_assignment(
    db: &Database,
    auth: AuthGuard,
    case_id: i64,
    req: Json<AssignmentUpdateRequest>,
) -> Result<(Status, Json<ApiResponse<CaseAssignment>>)> {
    check_permission(
        &auth.user,
        &[UserRole::Supervisor, UserRole::Director],
        "更新案件分派信息",
    )?;

    let case = get_case(db, case_id)?;

    if !matches!(
        case.status,
        CaseStatus::Reviewing | CaseStatus::Assigned | CaseStatus::Returned | CaseStatus::Submitted | CaseStatus::Resubmitted
    ) {
        return Err(AppError::BadRequest(format!(
            "当前案件状态 {} 不允许修改分派信息",
            case.status.as_str()
        )));
    }

    if let Some(v) = req.version {
        check_version(db, case_id, case.version, v, Some(auth.user.id))?;
    }

    if matches!(case.status, CaseStatus::Archived | CaseStatus::Completed | CaseStatus::Followup) {
        return Err(AppError::BadRequest(
            "已进入回访、完成或归档阶段的案件无法修改分派信息".to_string(),
        ));
    }

    let conn = db.conn.lock();

    let mut updates: Vec<String> = Vec::new();
    let mut params: Vec<&dyn rusqlite::ToSql> = Vec::new();

    if let Some(assistant_id) = req.assistant_id {
        updates.push("assistant_id = ?".to_string());
        params.push(&assistant_id);
    }
    if let Some(lawyer_id) = req.lawyer_id {
        updates.push("lawyer_id = ?".to_string());
        params.push(&lawyer_id);
    }
    if let Some(assignment_reason) = &req.assignment_reason {
        updates.push("assignment_reason = ?".to_string());
        params.push(assignment_reason);
    }
    if let Some(assignment_remark) = &req.assignment_remark {
        updates.push("assignment_remark = ?".to_string());
        params.push(assignment_remark);
    }

    if updates.is_empty() {
        return Err(AppError::BadRequest("没有提供需要更新的字段".to_string()));
    }

    updates.push("assigned_by = ?".to_string());
    params.push(&auth.user.id);
    updates.push("assigned_at = ?".to_string());
    let now = Utc::now();
    params.push(&now);
    updates.push("updated_at = ?".to_string());
    params.push(&now);

    params.push(&case_id);

    let sql = format!(
        "UPDATE case_assignment SET {} WHERE case_id = ?",
        updates.join(", ")
    );

    conn.execute(&sql, rusqlite::params_from_iter(params))?;

    let mut handler_id: Option<i64> = None;
    if let Some(lawyer_id) = req.lawyer_id {
        handler_id = Some(lawyer_id);
    } else if let Some(assistant_id) = req.assistant_id {
        handler_id = Some(assistant_id);
    }

    if let Some(handler_id) = handler_id {
        conn.execute(
            "UPDATE legal_cases SET current_handler_id = ?, version = version + 1, updated_at = ? WHERE id = ?",
            (handler_id, Utc::now(), case_id),
        )?;
    } else {
        conn.execute(
            "UPDATE legal_cases SET version = version + 1, updated_at = ? WHERE id = ?",
            (Utc::now(), case_id),
        )?;
    }

    drop(conn);

    let conn = db.conn.lock();
    let mut stmt = conn.prepare(
        "SELECT ca.id, ca.case_id, ca.assistant_id, ca.lawyer_id, ca.assignment_reason, 
                ca.assignment_remark, ca.assigned_by, ca.assigned_at, ca.is_complete, 
                ca.created_at, ca.updated_at,
                u1.real_name as assistant_name, u2.real_name as lawyer_name
         FROM case_assignment ca
         LEFT JOIN users u1 ON ca.assistant_id = u1.id
         LEFT JOIN users u2 ON ca.lawyer_id = u2.id
         WHERE ca.case_id = ?1",
    )?;

    let mut assignment = stmt.query_row([case_id], |row| {
        Ok(CaseAssignment {
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
    })?;

    drop(conn);

    let (is_complete, missing) = check_assignment_complete(&assignment);
    let complete_flag = if is_complete { 1 } else { 0 };

    let conn = db.conn.lock();
    conn.execute(
        "UPDATE case_assignment SET is_complete = ?, updated_at = ? WHERE case_id = ?",
        (complete_flag, Utc::now(), case_id),
    )?;
    assignment.is_complete = complete_flag;
    drop(conn);

    record_processing_record(
        db,
        case_id,
        "update_assignment",
        Some(case.status.as_str()),
        Some(case.status.as_str()),
        auth.user.id,
        Some("更新案件分派信息"),
    )?;

    record_audit_note(
        db,
        case_id,
        Some("assignment"),
        "assignment_updated",
        &format!(
            "用户 {} 更新了案件分派信息，完整状态: {}",
            auth.user.real_name,
            if is_complete { "完整" } else { "不完整" }
        ),
        Some(auth.user.id),
    )?;

    if !is_complete {
        record_exception(
            db,
            case_id,
            "incomplete_assignment",
            &format!(
                "案件分派信息不完整，缺少: {}",
                missing.join(", ")
            ),
            Some("assignment"),
            Some(auth.user.id),
        )?;
    }

    Ok((
        Status::Ok,
        Json(ApiResponse::success(assignment, "更新成功")),
    ))
}

#[get("/cases/<case_id>/assignment/complete-check")]
fn check_assignment_complete_status(
    db: &Database,
    auth: AuthGuard,
    case_id: i64,
) -> Result<(Status, Json<ApiResponse<serde_json::Value>>)> {
    let case = get_case(db, case_id)?;

    if !can_access_case(&auth.user, case.created_by, case.current_handler_id, &case.status) {
        return Err(AppError::PermissionError(
            "用户无权查看此案件的分派信息完整性".to_string(),
        ));
    }

    let conn = db.conn.lock();
    let mut stmt = conn.prepare(
        "SELECT id, case_id, assistant_id, lawyer_id, assignment_reason, assignment_remark, 
         assigned_by, assigned_at, is_complete, created_at, updated_at FROM case_assignment WHERE case_id = ?1",
    )?;

    let assignment = stmt.query_row([case_id], |row| {
        Ok(CaseAssignment {
            id: row.get(0)?,
            case_id: row.get(1)?,
            assistant_id: row.get(2)?,
            assistant_name: None,
            lawyer_id: row.get(3)?,
            lawyer_name: None,
            assignment_reason: row.get(4)?,
            assignment_remark: row.get(5)?,
            assigned_by: row.get(6)?,
            assigned_at: row.get(7)?,
            is_complete: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    })?;

    let (is_complete, missing) = check_assignment_complete(&assignment);

    let result = serde_json::json!({
        "is_complete": is_complete,
        "missing_fields": missing,
        "assistant_name": assignment.assistant_id.and_then(|id| get_user_name(db, id).ok().flatten()),
        "lawyer_name": assignment.lawyer_id.and_then(|id| get_user_name(db, id).ok().flatten()),
        "assigned_by_name": assignment.assigned_by.and_then(|id| get_user_name(db, id).ok().flatten()),
        "assigned_at": assignment.assigned_at,
    });

    Ok((
        Status::Ok,
        Json(ApiResponse::success(result, "查询成功")),
    ))
}

#[derive(Debug, serde::Serialize)]
pub struct VerifyResult {
    pub is_complete: bool,
    pub missing_fields: Vec<String>,
}

#[post("/cases/<case_id>/assignment/verify")]
fn verify_assignment(
    db: &Database,
    auth: AuthGuard,
    case_id: i64,
) -> Result<(Status, Json<ApiResponse<VerifyResult>>)> {
    check_permission(
        &auth.user,
        &[
            UserRole::Supervisor,
            UserRole::Director,
            UserRole::Reviewer,
        ],
        "核验案件分派信息",
    )?;

    let case = get_case(db, case_id)?;

    if !can_access_case(&auth.user, case.created_by, case.current_handler_id, &case.status) {
        return Err(AppError::PermissionError(
            "用户无权核验此案件的分派信息".to_string(),
        ));
    }

    let conn = db.conn.lock();
    let mut stmt = conn.prepare(
        "SELECT id, case_id, assistant_id, lawyer_id, assignment_reason, assignment_remark, 
         assigned_by, assigned_at, is_complete, created_at, updated_at FROM case_assignment WHERE case_id = ?1",
    )?;

    let assignment = stmt.query_row([case_id], |row| {
        Ok(CaseAssignment {
            id: row.get(0)?,
            case_id: row.get(1)?,
            assistant_id: row.get(2)?,
            assistant_name: None,
            lawyer_id: row.get(3)?,
            lawyer_name: None,
            assignment_reason: row.get(4)?,
            assignment_remark: row.get(5)?,
            assigned_by: row.get(6)?,
            assigned_at: row.get(7)?,
            is_complete: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    })?;

    drop(conn);

    let (is_complete, missing) = check_assignment_complete(&assignment);

    let content = if is_complete {
        format!("用户 {} 核验了案件分派信息，结果：信息完整", auth.user.real_name)
    } else {
        format!(
            "用户 {} 核验了案件分派信息，结果：信息不完整，缺少: {}",
            auth.user.real_name,
            missing.join(", ")
        )
    };

    record_audit_note(
        db,
        case_id,
        Some("assignment"),
        "assignment_verified",
        &content,
        Some(auth.user.id),
    )?;

    if !is_complete {
        record_exception(
            db,
            case_id,
            "incomplete_assignment",
            &format!("案件分派信息不完整，缺少: {}", missing.join(", ")),
            Some("assignment"),
            Some(auth.user.id),
        )?;
    }

    let result = VerifyResult {
        is_complete,
        missing_fields: missing,
    };

    Ok((
        Status::Ok,
        Json(ApiResponse::success(result, if is_complete { "核验通过，信息完整" } else { "核验未通过，信息不完整" })),
    ))
}

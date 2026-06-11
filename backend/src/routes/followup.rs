use crate::auth::{can_access_case, check_permission, AuthGuard};
use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{ApiResponse, CaseFollowup, CaseStatus, FollowupUpdateRequest, UserRole};
use crate::utils::{
    check_followup_complete, check_version, get_case, get_user_name, record_audit_note,
    record_exception, record_processing_record,
};
use chrono::Utc;
use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::Route;

pub fn routes() -> Vec<Route> {
    rocket::routes![get_followup, update_followup, check_followup_complete_status]
}

#[get("/cases/<case_id>/followup")]
fn get_followup(
    db: &Database,
    auth: AuthGuard,
    case_id: i64,
) -> Result<(Status, Json<ApiResponse<CaseFollowup>>)> {
    let case = get_case(db, case_id)?;

    if !can_access_case(&auth.user, case.created_by, case.current_handler_id, &case.status) {
        return Err(AppError::PermissionError(
            "用户无权查看此案件的回访信息".to_string(),
        ));
    }

    let conn = db.conn.lock();
    let mut stmt = conn.prepare(
        "SELECT id, case_id, followup_result, client_satisfaction, followup_remark, 
         followup_by, followup_at, is_complete, created_at, updated_at FROM case_followup WHERE case_id = ?1",
    )?;

    let followup = stmt.query_row([case_id], |row| {
        Ok(CaseFollowup {
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
    })?;

    Ok((
        Status::Ok,
        Json(ApiResponse::success(followup, "查询成功")),
    ))
}

#[put("/cases/<case_id>/followup", data = "<req>")]
fn update_followup(
    db: &Database,
    auth: AuthGuard,
    case_id: i64,
    req: Json<FollowupUpdateRequest>,
) -> Result<(Status, Json<ApiResponse<CaseFollowup>>)> {
    check_permission(
        &auth.user,
        &[
            UserRole::Assistant,
            UserRole::Lawyer,
            UserRole::Supervisor,
            UserRole::Director,
        ],
        "更新回访确认信息",
    )?;

    let case = get_case(db, case_id)?;

    if !can_access_case(&auth.user, case.created_by, case.current_handler_id, &case.status) {
        return Err(AppError::PermissionError(
            "用户无权更新此案件的回访信息".to_string(),
        ));
    }

    check_version(case.version, req.version)?;

    if !matches!(
        case.status,
        CaseStatus::Assigned | CaseStatus::Followup | CaseStatus::Returned
    ) {
        return Err(AppError::BadRequest(format!(
            "当前案件状态 {} 不允许修改回访信息，需要在已分派或回访阶段",
            case.status.as_str()
        )));
    }

    if matches!(case.status, CaseStatus::Archived | CaseStatus::Completed) {
        return Err(AppError::BadRequest(
            "已完成或已归档的案件无法修改回访信息".to_string(),
        ));
    }

    let conn = db.conn.lock();

    let mut updates: Vec<String> = Vec::new();
    let mut params: Vec<&dyn rusqlite::ToSql> = Vec::new();

    if let Some(followup_result) = &req.followup_result {
        updates.push("followup_result = ?".to_string());
        params.push(followup_result);
    }
    if let Some(client_satisfaction) = &req.client_satisfaction {
        updates.push("client_satisfaction = ?".to_string());
        params.push(client_satisfaction);
    }
    if let Some(followup_remark) = &req.followup_remark {
        updates.push("followup_remark = ?".to_string());
        params.push(followup_remark);
    }

    if updates.is_empty() {
        return Err(AppError::BadRequest("没有提供需要更新的字段".to_string()));
    }

    updates.push("followup_by = ?".to_string());
    params.push(&auth.user.id);
    updates.push("followup_at = ?".to_string());
    let now = Utc::now();
    params.push(&now);
    updates.push("updated_at = ?".to_string());
    params.push(&now);

    params.push(&case_id);

    let sql = format!(
        "UPDATE case_followup SET {} WHERE case_id = ?",
        updates.join(", ")
    );

    conn.execute(&sql, rusqlite::params_from_iter(params))?;

    conn.execute(
        "UPDATE legal_cases SET version = version + 1, updated_at = ? WHERE id = ?",
        (Utc::now(), case_id),
    )?;

    drop(conn);

    let conn = db.conn.lock();
    let mut stmt = conn.prepare(
        "SELECT id, case_id, followup_result, client_satisfaction, followup_remark, 
         followup_by, followup_at, is_complete, created_at, updated_at FROM case_followup WHERE case_id = ?1",
    )?;

    let mut followup = stmt.query_row([case_id], |row| {
        Ok(CaseFollowup {
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
    })?;

    drop(conn);

    let (is_complete, missing) = check_followup_complete(&followup);
    let complete_flag = if is_complete { 1 } else { 0 };

    let conn = db.conn.lock();
    conn.execute(
        "UPDATE case_followup SET is_complete = ?, updated_at = ? WHERE case_id = ?",
        (complete_flag, Utc::now(), case_id),
    )?;
    followup.is_complete = complete_flag;
    drop(conn);

    record_processing_record(
        db,
        case_id,
        "update_followup",
        Some(case.status.as_str()),
        Some(case.status.as_str()),
        auth.user.id,
        Some("更新回访确认信息"),
    )?;

    record_audit_note(
        db,
        case_id,
        Some("followup"),
        "followup_updated",
        &format!(
            "用户 {} 更新了回访确认信息，完整状态: {}",
            auth.user.real_name,
            if is_complete { "完整" } else { "不完整" }
        ),
        Some(auth.user.id),
    )?;

    if !is_complete {
        record_exception(
            db,
            case_id,
            "incomplete_followup",
            &format!(
                "回访确认信息不完整，缺少: {}",
                missing.join(", ")
            ),
            Some("followup"),
            Some(auth.user.id),
        )?;
    }

    Ok((
        Status::Ok,
        Json(ApiResponse::success(followup, "更新成功")),
    ))
}

#[get("/cases/<case_id>/followup/complete-check")]
fn check_followup_complete_status(
    db: &Database,
    auth: AuthGuard,
    case_id: i64,
) -> Result<(Status, Json<ApiResponse<serde_json::Value>>)> {
    let case = get_case(db, case_id)?;

    if !can_access_case(&auth.user, case.created_by, case.current_handler_id, &case.status) {
        return Err(AppError::PermissionError(
            "用户无权查看此案件的回访信息完整性".to_string(),
        ));
    }

    let conn = db.conn.lock();
    let mut stmt = conn.prepare(
        "SELECT id, case_id, followup_result, client_satisfaction, followup_remark, 
         followup_by, followup_at, is_complete, created_at, updated_at FROM case_followup WHERE case_id = ?1",
    )?;

    let followup = stmt.query_row([case_id], |row| {
        Ok(CaseFollowup {
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
    })?;

    let (is_complete, missing) = check_followup_complete(&followup);

    let result = serde_json::json!({
        "is_complete": is_complete,
        "missing_fields": missing,
        "followup_by_name": followup.followup_by.and_then(|id| get_user_name(db, id).ok().flatten()),
        "followup_at": followup.followup_at,
    });

    Ok((
        Status::Ok,
        Json(ApiResponse::success(result, "查询成功")),
    ))
}

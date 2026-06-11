use crate::auth::{can_access_case, check_permission, AuthGuard};
use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{
    ApiResponse, CaseRegistration, CaseStatus, RegistrationUpdateRequest, UserRole,
};
use crate::utils::{
    check_registration_complete, check_version, get_case, get_user_name, record_audit_note,
    record_exception, record_processing_record,
};
use chrono::Utc;
use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::Route;

pub fn routes() -> Vec<Route> {
    rocket::routes![get_registration, update_registration, check_registration_complete_status, verify_registration]
}

#[get("/cases/<case_id>/registration")]
fn get_registration(
    db: &Database,
    auth: AuthGuard,
    case_id: i64,
) -> Result<(Status, Json<ApiResponse<CaseRegistration>>)> {
    let case = get_case(db, case_id)?;

    if !can_access_case(&auth.user, case.created_by, case.current_handler_id, &case.status) {
        return Err(AppError::PermissionError(
            "用户无权查看此案件的登记信息".to_string(),
        ));
    }

    let conn = db.conn.lock();
    let mut stmt = conn.prepare(
        "SELECT id, case_id, client_name, client_phone, client_id_card, consultation_type, 
         consultation_content, evidence_provided, registration_remark, registered_by, registered_at, 
         is_complete, created_at, updated_at FROM case_registration WHERE case_id = ?1",
    )?;

    let registration = stmt.query_row([case_id], |row| {
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
    })?;

    Ok((
        Status::Ok,
        Json(ApiResponse::success(registration, "查询成功")),
    ))
}

#[put("/cases/<case_id>/registration", data = "<req>")]
fn update_registration(
    db: &Database,
    auth: AuthGuard,
    case_id: i64,
    req: Json<RegistrationUpdateRequest>,
) -> Result<(Status, Json<ApiResponse<CaseRegistration>>)> {
    check_permission(
        &auth.user,
        &[
            UserRole::Registrar,
            UserRole::Supervisor,
            UserRole::Director,
        ],
        "更新咨询登记信息",
    )?;

    let case = get_case(db, case_id)?;

    if !can_access_case(&auth.user, case.created_by, case.current_handler_id, &case.status) {
        return Err(AppError::PermissionError(
            "用户无权更新此案件的登记信息".to_string(),
        ));
    }

    if let Some(v) = req.version {
        check_version(case.version, v)?;
    }

    if matches!(case.status, CaseStatus::Archived | CaseStatus::Completed) {
        return Err(AppError::BadRequest(
            "已完成或已归档的案件无法修改登记信息".to_string(),
        ));
    }

    let conn = db.conn.lock();

    let mut updates: Vec<String> = Vec::new();
    let mut params: Vec<&dyn rusqlite::ToSql> = Vec::new();

    if let Some(client_name) = &req.client_name {
        updates.push("client_name = ?".to_string());
        params.push(client_name);
    }
    if let Some(client_phone) = &req.client_phone {
        updates.push("client_phone = ?".to_string());
        params.push(client_phone);
    }
    if let Some(client_id_card) = &req.client_id_card {
        updates.push("client_id_card = ?".to_string());
        params.push(client_id_card);
    }
    if let Some(consultation_type) = &req.consultation_type {
        updates.push("consultation_type = ?".to_string());
        params.push(consultation_type);
    }
    if let Some(consultation_content) = &req.consultation_content {
        updates.push("consultation_content = ?".to_string());
        params.push(consultation_content);
    }
    if let Some(evidence_provided) = &req.evidence_provided {
        updates.push("evidence_provided = ?".to_string());
        params.push(evidence_provided);
    }
    if let Some(registration_remark) = &req.registration_remark {
        updates.push("registration_remark = ?".to_string());
        params.push(registration_remark);
    }

    if updates.is_empty() {
        return Err(AppError::BadRequest("没有提供需要更新的字段".to_string()));
    }

    updates.push("registered_by = ?".to_string());
    params.push(&auth.user.id);
    updates.push("registered_at = ?".to_string());
    let now = Utc::now();
    params.push(&now);
    updates.push("updated_at = ?".to_string());
    params.push(&now);

    params.push(&case_id);

    let sql = format!(
        "UPDATE case_registration SET {} WHERE case_id = ?",
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
        "SELECT id, case_id, client_name, client_phone, client_id_card, consultation_type, 
         consultation_content, evidence_provided, registration_remark, registered_by, registered_at, 
         is_complete, created_at, updated_at FROM case_registration WHERE case_id = ?1",
    )?;

    let mut registration = stmt.query_row([case_id], |row| {
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
    })?;

    drop(conn);

    let (is_complete, missing) = check_registration_complete(&registration);
    let complete_flag = if is_complete { 1 } else { 0 };

    let conn = db.conn.lock();
    conn.execute(
        "UPDATE case_registration SET is_complete = ?, updated_at = ? WHERE case_id = ?",
        (complete_flag, Utc::now(), case_id),
    )?;
    registration.is_complete = complete_flag;
    drop(conn);

    record_processing_record(
        db,
        case_id,
        "update_registration",
        Some(case.status.as_str()),
        Some(case.status.as_str()),
        auth.user.id,
        Some("更新咨询登记信息"),
    )?;

    record_audit_note(
        db,
        case_id,
        Some("registration"),
        "registration_updated",
        &format!(
            "用户 {} 更新了咨询登记信息，完整状态: {}",
            auth.user.real_name,
            if is_complete { "完整" } else { "不完整" }
        ),
        Some(auth.user.id),
    )?;

    if !is_complete {
        record_exception(
            db,
            case_id,
            "incomplete_registration",
            &format!(
                "咨询登记信息不完整，缺少: {}",
                missing.join(", ")
            ),
            Some("registration"),
            Some(auth.user.id),
        )?;
    }

    Ok((
        Status::Ok,
        Json(ApiResponse::success(registration, "更新成功")),
    ))
}

#[get("/cases/<case_id>/registration/complete-check")]
fn check_registration_complete_status(
    db: &Database,
    auth: AuthGuard,
    case_id: i64,
) -> Result<(Status, Json<ApiResponse<serde_json::Value>>)> {
    let case = get_case(db, case_id)?;

    if !can_access_case(&auth.user, case.created_by, case.current_handler_id, &case.status) {
        return Err(AppError::PermissionError(
            "用户无权查看此案件的登记信息完整性".to_string(),
        ));
    }

    let conn = db.conn.lock();
    let mut stmt = conn.prepare(
        "SELECT id, case_id, client_name, client_phone, client_id_card, consultation_type, 
         consultation_content, evidence_provided, registration_remark, registered_by, registered_at, 
         is_complete, created_at, updated_at FROM case_registration WHERE case_id = ?1",
    )?;

    let registration = stmt.query_row([case_id], |row| {
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
    })?;

    let (is_complete, missing) = check_registration_complete(&registration);

    let result = serde_json::json!({
        "is_complete": is_complete,
        "missing_fields": missing,
        "registered_by_name": registration.registered_by.and_then(|id| get_user_name(db, id).ok().flatten()),
        "registered_at": registration.registered_at,
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

#[post("/cases/<case_id>/registration/verify")]
fn verify_registration(
    db: &Database,
    auth: AuthGuard,
    case_id: i64,
) -> Result<(Status, Json<ApiResponse<VerifyResult>>)> {
    check_permission(
        &auth.user,
        &[
            UserRole::Registrar,
            UserRole::Supervisor,
            UserRole::Director,
            UserRole::Reviewer,
        ],
        "核验咨询登记信息",
    )?;

    let case = get_case(db, case_id)?;

    if !can_access_case(&auth.user, case.created_by, case.current_handler_id, &case.status) {
        return Err(AppError::PermissionError(
            "用户无权核验此案件的登记信息".to_string(),
        ));
    }

    let conn = db.conn.lock();
    let mut stmt = conn.prepare(
        "SELECT id, case_id, client_name, client_phone, client_id_card, consultation_type, 
         consultation_content, evidence_provided, registration_remark, registered_by, registered_at, 
         is_complete, created_at, updated_at FROM case_registration WHERE case_id = ?1",
    )?;

    let registration = stmt.query_row([case_id], |row| {
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
    })?;

    drop(conn);

    let (is_complete, missing) = check_registration_complete(&registration);

    let content = if is_complete {
        format!("用户 {} 核验了咨询登记信息，结果：信息完整", auth.user.real_name)
    } else {
        format!(
            "用户 {} 核验了咨询登记信息，结果：信息不完整，缺少: {}",
            auth.user.real_name,
            missing.join(", ")
        )
    };

    record_audit_note(
        db,
        case_id,
        Some("registration"),
        "registration_verified",
        &content,
        Some(auth.user.id),
    )?;

    if !is_complete {
        record_exception(
            db,
            case_id,
            "incomplete_registration",
            &format!("咨询登记信息不完整，缺少: {}", missing.join(", ")),
            Some("registration"),
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

use crate::auth::{can_access_case, AuthGuard};
use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{ApiResponse, AuditNote};
use crate::utils::{get_case, record_audit_note};
use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::Route;
use serde::Deserialize;

pub fn routes() -> Vec<Route> {
    rocket::routes![list_audit_notes, create_audit_note]
}

#[get("/cases/<case_id>/audit-notes")]
fn list_audit_notes(
    db: &Database,
    auth: AuthGuard,
    case_id: i64,
) -> Result<(Status, Json<ApiResponse<Vec<AuditNote>>>)> {
    let case = get_case(db, case_id)?;

    if !can_access_case(&auth.user, case.created_by, case.current_handler_id, &case.status) {
        return Err(AppError::PermissionError(
            "用户无权查看此案件的审计备注".to_string(),
        ));
    }

    let conn = db.conn.lock();
    let mut stmt = conn.prepare(
        "SELECT an.id, an.case_id, an.module, an.audit_type, an.content, 
                an.operator_id, an.created_at, u.real_name as operator_name
         FROM audit_notes an
         LEFT JOIN users u ON an.operator_id = u.id
         WHERE an.case_id = ?1
         ORDER BY an.created_at DESC",
    )?;

    let notes = stmt.query_map([case_id], |row| {
        Ok(AuditNote {
            id: row.get(0)?,
            case_id: row.get(1)?,
            module: row.get(2)?,
            audit_type: row.get(3)?,
            content: row.get(4)?,
            operator_id: row.get(5)?,
            operator_name: row.get(7)?,
            created_at: row.get(6)?,
        })
    })?;

    let mut list: Vec<AuditNote> = Vec::new();
    for note in notes {
        list.push(note?);
    }

    Ok((
        Status::Ok,
        Json(ApiResponse::success(list, "查询成功")),
    ))
}

#[derive(Debug, Deserialize)]
pub struct CreateAuditNoteRequest {
    pub module: Option<String>,
    pub audit_type: String,
    pub content: String,
}

#[post("/cases/<case_id>/audit-notes", data = "<req>")]
fn create_audit_note(
    db: &Database,
    auth: AuthGuard,
    case_id: i64,
    req: Json<CreateAuditNoteRequest>,
) -> Result<(Status, Json<ApiResponse<AuditNote>>)> {
    let case = get_case(db, case_id)?;

    if !can_access_case(&auth.user, case.created_by, case.current_handler_id, &case.status) {
        return Err(AppError::PermissionError(
            "用户无权为此案件添加审计备注".to_string(),
        ));
    }

    if req.content.trim().is_empty() {
        return Err(AppError::BadRequest("备注内容不能为空".to_string()));
    }

    if req.audit_type.trim().is_empty() {
        return Err(AppError::BadRequest("备注类型不能为空".to_string()));
    }

    record_audit_note(
        db,
        case_id,
        req.module.as_deref(),
        &req.audit_type,
        &req.content,
        Some(auth.user.id),
    )?;

    let conn = db.conn.lock();
    let mut stmt = conn.prepare(
        "SELECT an.id, an.case_id, an.module, an.audit_type, an.content, 
                an.operator_id, an.created_at, u.real_name as operator_name
         FROM audit_notes an
         LEFT JOIN users u ON an.operator_id = u.id
         WHERE an.case_id = ?1
         ORDER BY an.created_at DESC
         LIMIT 1",
    )?;

    let note = stmt.query_row([case_id], |row| {
        Ok(AuditNote {
            id: row.get(0)?,
            case_id: row.get(1)?,
            module: row.get(2)?,
            audit_type: row.get(3)?,
            content: row.get(4)?,
            operator_id: row.get(5)?,
            operator_name: row.get(7)?,
            created_at: row.get(6)?,
        })
    })?;

    Ok((
        Status::Created,
        Json(ApiResponse::success(note, "创建成功")),
    ))
}

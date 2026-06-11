use axum::{extract::{Path, State}, Json};
use crate::db::DbPool;
use crate::error::AppError;
use crate::middleware::AuthUser;
use crate::models::{Attachment, UploadAttachmentPayload};

pub async fn upload(
    State(pool): State<DbPool>,
    user: AuthUser,
    Path(request_id): Path<i64>,
    Json(payload): Json<UploadAttachmentPayload>,
) -> Result<Json<Attachment>, AppError> {
    let conn = pool.lock().await;

    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM creative_requests WHERE id = ?1",
            rusqlite::params![request_id],
            |row| row.get::<_, i64>(0).map(|c| c > 0),
        )
        .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound(format!(
            "Creative request {} not found",
            request_id
        )));
    }

    let now = chrono::Utc::now().naive_utc().format("%Y-%m-%d %H:%M:%S").to_string();
    let file_path = format!("/uploads/{}/{}", request_id, payload.file_name);

    conn.execute(
        "INSERT INTO attachments (request_id, file_name, file_path, file_type, category, uploaded_by, uploaded_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![request_id, payload.file_name, file_path, payload.file_type, payload.category, user.id, now],
    )?;

    let id = conn.last_insert_rowid();

    let attachment = conn
        .query_row(
            "SELECT id, request_id, file_name, file_path, file_type, category, uploaded_by, uploaded_at FROM attachments WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(Attachment {
                    id: row.get(0)?,
                    request_id: row.get(1)?,
                    file_name: row.get(2)?,
                    file_path: row.get(3)?,
                    file_type: row.get(4)?,
                    category: row.get(5)?,
                    uploaded_by: row.get(6)?,
                    uploaded_at: row.get(7)?,
                })
            },
        )
        .map_err(|_| AppError::Internal("Failed to read uploaded attachment".into()))?;

    Ok(Json(attachment))
}

pub async fn list(
    State(pool): State<DbPool>,
    Path(request_id): Path<i64>,
) -> Result<Json<Vec<Attachment>>, AppError> {
    let conn = pool.lock().await;

    let mut attachments = Vec::new();
    let mut stmt = conn.prepare(
        "SELECT id, request_id, file_name, file_path, file_type, category, uploaded_by, uploaded_at FROM attachments WHERE request_id = ?1 ORDER BY uploaded_at DESC"
    )?;
    let iter = stmt.query_map(rusqlite::params![request_id], |row| {
        Ok(Attachment {
            id: row.get(0)?,
            request_id: row.get(1)?,
            file_name: row.get(2)?,
            file_path: row.get(3)?,
            file_type: row.get(4)?,
            category: row.get(5)?,
            uploaded_by: row.get(6)?,
            uploaded_at: row.get(7)?,
        })
    })?;
    for a in iter {
        attachments.push(a?);
    }

    Ok(Json(attachments))
}

pub async fn delete(
    State(pool): State<DbPool>,
    user: AuthUser,
    Path(id): Path<i64>,
) -> Result<Json<serde_json::Value>, AppError> {
    let conn = pool.lock().await;

    let uploaded_by: i64 = conn
        .query_row(
            "SELECT uploaded_by FROM attachments WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|_| AppError::NotFound(format!("Attachment {} not found", id)))?;

    if uploaded_by != user.id && user.role != "review_supervisor" && user.role != "review_manager" {
        return Err(AppError::Forbidden(
            "Only the uploader or a reviewer can delete attachments".into(),
        ));
    }

    conn.execute(
        "DELETE FROM attachments WHERE id = ?1",
        rusqlite::params![id],
    )?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}

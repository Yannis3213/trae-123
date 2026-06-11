use axum::{extract::{Path, State}, Json};
use crate::db::DbPool;
use crate::error::AppError;
use crate::middleware::AuthUser;
use crate::models::{AddAuditNotePayload, AuditNote, ExceptionReason, ProcessingRecord};

#[derive(Debug, serde::Serialize)]
pub struct AuditTrail {
    pub processing_records: Vec<ProcessingRecord>,
    pub audit_notes: Vec<AuditNote>,
    pub exception_reasons: Vec<ExceptionReason>,
}

pub async fn get_audit_trail(
    State(pool): State<DbPool>,
    Path(id): Path<i64>,
) -> Result<Json<AuditTrail>, AppError> {
    let conn = pool.lock().await;

    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM creative_requests WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get::<_, i64>(0).map(|c| c > 0),
        )
        .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound(format!(
            "Creative request {} not found",
            id
        )));
    }

    let mut processing_records = Vec::new();
    {
        let mut stmt = conn.prepare(
            "SELECT id, request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at FROM processing_records WHERE request_id = ?1 ORDER BY created_at"
        )?;
        let iter = stmt.query_map(rusqlite::params![id], |row| {
            Ok(ProcessingRecord {
                id: row.get(0)?,
                request_id: row.get(1)?,
                handler_id: row.get(2)?,
                handler_role: row.get(3)?,
                action: row.get(4)?,
                opinion: row.get(5)?,
                from_status: row.get(6)?,
                to_status: row.get(7)?,
                created_at: row.get(8)?,
            })
        })?;
        for r in iter {
            processing_records.push(r?);
        }
    }

    let mut audit_notes = Vec::new();
    {
        let mut stmt = conn.prepare(
            "SELECT id, request_id, author_id, content, note_type, created_at FROM audit_notes WHERE request_id = ?1 ORDER BY created_at"
        )?;
        let iter = stmt.query_map(rusqlite::params![id], |row| {
            Ok(AuditNote {
                id: row.get(0)?,
                request_id: row.get(1)?,
                author_id: row.get(2)?,
                content: row.get(3)?,
                note_type: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;
        for n in iter {
            audit_notes.push(n?);
        }
    }

    let mut exception_reasons = Vec::new();
    {
        let mut stmt = conn.prepare(
            "SELECT id, request_id, reason_type, description, reported_by, resolved, resolved_at, created_at FROM exception_reasons WHERE request_id = ?1 ORDER BY created_at"
        )?;
        let iter = stmt.query_map(rusqlite::params![id], |row| {
            Ok(ExceptionReason {
                id: row.get(0)?,
                request_id: row.get(1)?,
                reason_type: row.get(2)?,
                description: row.get(3)?,
                reported_by: row.get(4)?,
                resolved: row.get::<_, i64>(5)? != 0,
                resolved_at: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;
        for e in iter {
            exception_reasons.push(e?);
        }
    }

    Ok(Json(AuditTrail {
        processing_records,
        audit_notes,
        exception_reasons,
    }))
}

pub async fn add_audit_note(
    State(pool): State<DbPool>,
    user: AuthUser,
    Path(id): Path<i64>,
    Json(payload): Json<AddAuditNotePayload>,
) -> Result<Json<AuditNote>, AppError> {
    let conn = pool.lock().await;

    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM creative_requests WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get::<_, i64>(0).map(|c| c > 0),
        )
        .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound(format!(
            "Creative request {} not found",
            id
        )));
    }

    let now = chrono::Utc::now().naive_utc().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO audit_notes (request_id, author_id, content, note_type, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![id, user.id, payload.content, payload.note_type, now],
    )?;

    let note_id = conn.last_insert_rowid();

    let note = conn
        .query_row(
            "SELECT id, request_id, author_id, content, note_type, created_at FROM audit_notes WHERE id = ?1",
            rusqlite::params![note_id],
            |row| {
                Ok(AuditNote {
                    id: row.get(0)?,
                    request_id: row.get(1)?,
                    author_id: row.get(2)?,
                    content: row.get(3)?,
                    note_type: row.get(4)?,
                    created_at: row.get(5)?,
                })
            },
        )
        .map_err(|_| AppError::Internal("Failed to read created audit note".into()))?;

    Ok(Json(note))
}

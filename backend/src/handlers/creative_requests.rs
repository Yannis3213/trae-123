use axum::{extract::{Path, Query, State}, Json};
use crate::db::DbPool;
use crate::error::AppError;
use crate::middleware::AuthUser;
use crate::models::*;

pub async fn list(
    State(pool): State<DbPool>,
    user: AuthUser,
    Query(params): Query<ListQueryParams>,
) -> Result<Json<Vec<CreativeRequestListItem>>, AppError> {
    let conn = pool.lock().await;

    let mut sql = String::from(
        "SELECT cr.id, cr.request_number, cr.title, cr.client_name, cr.brand, cr.campaign_name, \
         cr.brief_status, cr.schedule_status, cr.status, cr.current_handler_role, cr.current_handler_id, \
         cr.deadline, cr.version, cr.description, cr.created_by, cr.created_at, cr.updated_at \
         FROM creative_requests cr WHERE 1=1"
    );
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut param_idx = 0;

    if let Some(ref status) = params.status {
        param_idx += 1;
        sql.push_str(&format!(" AND cr.status = ?{}", param_idx));
        param_values.push(Box::new(status.clone()));
    }

    if let Some(ref role) = params.role {
        match role.as_str() {
            "creative_registrar" => {
                sql.push_str(" AND cr.current_handler_role = 'creative_registrar'");
            }
            "review_supervisor" => {
                sql.push_str(" AND cr.current_handler_role = 'review_supervisor'");
            }
            "review_manager" => {
                sql.push_str(" AND cr.current_handler_role = 'review_manager'");
            }
            "my" => {
                param_idx += 1;
                sql.push_str(&format!(" AND cr.current_handler_id = ?{}", param_idx));
                param_values.push(Box::new(user.id));
            }
            _ => {}
        }
    }

    if let Some(ref keyword) = params.keyword {
        param_idx += 1;
        let kw = format!("%{}%", keyword);
        sql.push_str(&format!(
            " AND (cr.title LIKE ?{p} OR cr.client_name LIKE ?{p} OR cr.brand LIKE ?{p} OR cr.campaign_name LIKE ?{p} OR cr.request_number LIKE ?{p})",
            p = param_idx
        ));
        param_values.push(Box::new(kw));
    }

    sql.push_str(" ORDER BY cr.updated_at DESC");

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();

    let mut stmt = conn.prepare(&sql)?;
    let request_iter = stmt.query_map(params_refs.as_slice(), |row| {
        Ok(CreativeRequest {
            id: row.get(0)?,
            request_number: row.get(1)?,
            title: row.get(2)?,
            client_name: row.get(3)?,
            brand: row.get(4)?,
            campaign_name: row.get(5)?,
            brief_status: row.get(6)?,
            schedule_status: row.get(7)?,
            status: row.get(8)?,
            current_handler_role: row.get(9)?,
            current_handler_id: row.get(10)?,
            deadline: row.get(11)?,
            version: row.get(12)?,
            description: row.get(13)?,
            created_by: row.get(14)?,
            created_at: row.get(15)?,
            updated_at: row.get(16)?,
        })
    })?;

    let mut results = Vec::new();
    for req_result in request_iter {
        let req = req_result?;
        let warning = compute_deadline_warning(&req.deadline);

        let handler_name: String = conn
            .query_row(
                "SELECT display_name FROM users WHERE id = ?1",
                rusqlite::params![req.current_handler_id],
                |row| row.get(0),
            )
            .unwrap_or_else(|_| "Unknown".to_string());

        let creator_name: String = conn
            .query_row(
                "SELECT display_name FROM users WHERE id = ?1",
                rusqlite::params![req.created_by],
                |row| row.get(0),
            )
            .unwrap_or_else(|_| "Unknown".to_string());

        if let Some(ref dw) = params.deadline_warning {
            if dw != warning.as_str() {
                continue;
            }
        }

        results.push(CreativeRequestListItem {
            request: req,
            deadline_warning: warning.as_str().to_string(),
            handler_name,
            creator_name,
        });
    }

    Ok(Json(results))
}

pub async fn detail(
    State(pool): State<DbPool>,
    Path(id): Path<i64>,
) -> Result<Json<CreativeRequestWithExtras>, AppError> {
    let conn = pool.lock().await;

    let req = conn
        .query_row(
            "SELECT id, request_number, title, client_name, brand, campaign_name, \
             brief_status, schedule_status, status, current_handler_role, current_handler_id, \
             deadline, version, description, created_by, created_at, updated_at \
             FROM creative_requests WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(CreativeRequest {
                    id: row.get(0)?,
                    request_number: row.get(1)?,
                    title: row.get(2)?,
                    client_name: row.get(3)?,
                    brand: row.get(4)?,
                    campaign_name: row.get(5)?,
                    brief_status: row.get(6)?,
                    schedule_status: row.get(7)?,
                    status: row.get(8)?,
                    current_handler_role: row.get(9)?,
                    current_handler_id: row.get(10)?,
                    deadline: row.get(11)?,
                    version: row.get(12)?,
                    description: row.get(13)?,
                    created_by: row.get(14)?,
                    created_at: row.get(15)?,
                    updated_at: row.get(16)?,
                })
            },
        )
        .map_err(|_| AppError::NotFound(format!("Creative request {} not found", id)))?;

    let warning = compute_deadline_warning(&req.deadline);

    let handler_name: String = conn
        .query_row(
            "SELECT display_name FROM users WHERE id = ?1",
            rusqlite::params![req.current_handler_id],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "Unknown".to_string());

    let creator_name: String = conn
        .query_row(
            "SELECT display_name FROM users WHERE id = ?1",
            rusqlite::params![req.created_by],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "Unknown".to_string());

    let mut attachments = Vec::new();
    {
        let mut stmt = conn.prepare(
            "SELECT id, request_id, file_name, file_path, file_type, category, uploaded_by, uploaded_at FROM attachments WHERE request_id = ?1"
        )?;
        let iter = stmt.query_map(rusqlite::params![id], |row| {
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

    Ok(Json(CreativeRequestWithExtras {
        request: req,
        deadline_warning: warning.as_str().to_string(),
        handler_name,
        creator_name,
        attachments,
        processing_records,
        audit_notes,
        exception_reasons,
    }))
}

pub async fn create(
    State(pool): State<DbPool>,
    user: AuthUser,
    Json(payload): Json<CreateRequestPayload>,
) -> Result<Json<CreativeRequest>, AppError> {
    if user.role != "creative_registrar" {
        return Err(AppError::Forbidden(
            "Only creative_registrar can create requests".into(),
        ));
    }

    let now = chrono::Utc::now().naive_utc();
    let now_str = now.format("%Y-%m-%d %H:%M:%S").to_string();

    let count: i64 = {
        let conn = pool.lock().await;
        conn.query_row("SELECT COUNT(*) FROM creative_requests", [], |row| row.get(0))
            .unwrap_or(0)
    };
    let request_number = format!("CR-2024-{:03}", count + 1);

    let brief_status = payload.brief_status.unwrap_or_else(|| "pending".to_string());
    let schedule_status = payload.schedule_status.unwrap_or_else(|| "pending".to_string());
    let description = payload.description.unwrap_or_default();
    let deadline = payload.deadline.unwrap_or_else(|| {
        (now + chrono::Duration::days(7)).format("%Y-%m-%d").to_string()
    });

    let conn = pool.lock().await;
    conn.execute(
        "INSERT INTO creative_requests (request_number, title, client_name, brand, campaign_name, brief_status, schedule_status, status, current_handler_role, current_handler_id, deadline, version, description, created_by, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'draft', 'creative_registrar', ?8, ?9, 1, ?10, ?11, ?12, ?13)",
        rusqlite::params![
            request_number, payload.title, payload.client_name, payload.brand,
            payload.campaign_name, brief_status, schedule_status,
            user.id, deadline, description, user.id, now_str, now_str
        ],
    )?;

    let id = conn.last_insert_rowid();

    let req = conn
        .query_row(
            "SELECT id, request_number, title, client_name, brand, campaign_name, \
             brief_status, schedule_status, status, current_handler_role, current_handler_id, \
             deadline, version, description, created_by, created_at, updated_at \
             FROM creative_requests WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(CreativeRequest {
                    id: row.get(0)?,
                    request_number: row.get(1)?,
                    title: row.get(2)?,
                    client_name: row.get(3)?,
                    brand: row.get(4)?,
                    campaign_name: row.get(5)?,
                    brief_status: row.get(6)?,
                    schedule_status: row.get(7)?,
                    status: row.get(8)?,
                    current_handler_role: row.get(9)?,
                    current_handler_id: row.get(10)?,
                    deadline: row.get(11)?,
                    version: row.get(12)?,
                    description: row.get(13)?,
                    created_by: row.get(14)?,
                    created_at: row.get(15)?,
                    updated_at: row.get(16)?,
                })
            },
        )
        .map_err(|_| AppError::Internal("Failed to read created request".into()))?;

    Ok(Json(req))
}

pub async fn update(
    State(pool): State<DbPool>,
    user: AuthUser,
    Path(id): Path<i64>,
    Json(payload): Json<UpdateRequestPayload>,
) -> Result<Json<CreativeRequest>, AppError> {
    if user.role != "creative_registrar" {
        return Err(AppError::Forbidden(
            "Only creative_registrar can update requests".into(),
        ));
    }

    let conn = pool.lock().await;

    let current = conn
        .query_row(
            "SELECT status, version FROM creative_requests WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                let status: String = row.get(0)?;
                let version: i64 = row.get(1)?;
                Ok((status, version))
            },
        )
        .map_err(|_| AppError::NotFound(format!("Creative request {} not found", id)))?;

    let allowed_statuses = ["draft", "pending_submit", "returned"];
    if !allowed_statuses.contains(&current.0.as_str()) {
        return Err(AppError::Conflict(format!(
            "Cannot update request in status '{}'. Only draft, pending_submit, or returned can be edited.",
            current.0
        )));
    }

    if current.1 != payload.version {
        return Err(AppError::Conflict(format!(
            "Version mismatch: expected {} but got {}. The request has been modified by another user.",
            current.1, payload.version
        )));
    }

    let now = chrono::Utc::now().naive_utc().format("%Y-%m-%d %H:%M:%S").to_string();
    let new_version = payload.version + 1;

    let mut updates = vec![
        "version = ?1".to_string(),
        "updated_at = ?2".to_string(),
    ];
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(new_version),
        Box::new(now),
    ];
    let mut idx = 3;

    if let Some(ref title) = payload.title {
        updates.push(format!("title = ?{}", idx));
        param_values.push(Box::new(title.clone()));
        idx += 1;
    }
    if let Some(ref client_name) = payload.client_name {
        updates.push(format!("client_name = ?{}", idx));
        param_values.push(Box::new(client_name.clone()));
        idx += 1;
    }
    if let Some(ref brand) = payload.brand {
        updates.push(format!("brand = ?{}", idx));
        param_values.push(Box::new(brand.clone()));
        idx += 1;
    }
    if let Some(ref campaign_name) = payload.campaign_name {
        updates.push(format!("campaign_name = ?{}", idx));
        param_values.push(Box::new(campaign_name.clone()));
        idx += 1;
    }
    if let Some(ref brief_status) = payload.brief_status {
        updates.push(format!("brief_status = ?{}", idx));
        param_values.push(Box::new(brief_status.clone()));
        idx += 1;
    }
    if let Some(ref schedule_status) = payload.schedule_status {
        updates.push(format!("schedule_status = ?{}", idx));
        param_values.push(Box::new(schedule_status.clone()));
        idx += 1;
    }
    if let Some(ref deadline) = payload.deadline {
        updates.push(format!("deadline = ?{}", idx));
        param_values.push(Box::new(deadline.clone()));
        idx += 1;
    }
    if let Some(ref description) = payload.description {
        updates.push(format!("description = ?{}", idx));
        param_values.push(Box::new(description.clone()));
        idx += 1;
    }

    param_values.push(Box::new(id));

    let sql = format!(
        "UPDATE creative_requests SET {} WHERE id = ?{}",
        updates.join(", "),
        idx
    );

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, params_refs.as_slice())?;

    let req = conn
        .query_row(
            "SELECT id, request_number, title, client_name, brand, campaign_name, \
             brief_status, schedule_status, status, current_handler_role, current_handler_id, \
             deadline, version, description, created_by, created_at, updated_at \
             FROM creative_requests WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(CreativeRequest {
                    id: row.get(0)?,
                    request_number: row.get(1)?,
                    title: row.get(2)?,
                    client_name: row.get(3)?,
                    brand: row.get(4)?,
                    campaign_name: row.get(5)?,
                    brief_status: row.get(6)?,
                    schedule_status: row.get(7)?,
                    status: row.get(8)?,
                    current_handler_role: row.get(9)?,
                    current_handler_id: row.get(10)?,
                    deadline: row.get(11)?,
                    version: row.get(12)?,
                    description: row.get(13)?,
                    created_by: row.get(14)?,
                    created_at: row.get(15)?,
                    updated_at: row.get(16)?,
                })
            },
        )
        .map_err(|_| AppError::Internal("Failed to read updated request".into()))?;

    Ok(Json(req))
}

pub async fn submit(
    State(pool): State<DbPool>,
    user: AuthUser,
    Path(id): Path<i64>,
    Json(payload): Json<SubmitRequestPayload>,
) -> Result<Json<CreativeRequest>, AppError> {
    if user.role != "creative_registrar" {
        return Err(AppError::Forbidden(
            "Only creative_registrar can submit requests".into(),
        ));
    }

    let conn = pool.lock().await;

    let current = conn
        .query_row(
            "SELECT status, version, brief_status FROM creative_requests WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .map_err(|_| AppError::NotFound(format!("Creative request {} not found", id)))?;

    let (current_status, current_version, brief_st) = current;

    if current_version != payload.version {
        return Err(AppError::Conflict(format!(
            "Version mismatch: expected {} but got {}",
            current_version, payload.version
        )));
    }

    let (from_status, to_status) = match current_status.as_str() {
        "draft" => ("draft", "submitted"),
        "pending_submit" => ("pending_submit", "submitted"),
        "returned" => ("returned", "resubmitted"),
        _ => {
            return Err(AppError::Validation(format!(
                "Cannot submit from status '{}'. Only draft, pending_submit, or returned can be submitted.",
                current_status
            )));
        }
    };

    if brief_st == "missing" {
        return Err(AppError::Validation(
            "Cannot submit: brief_status is 'missing'. Please supplement the brief first.".into(),
        ));
    }

    let now = chrono::Utc::now().naive_utc().format("%Y-%m-%d %H:%M:%S").to_string();
    let new_version = current_version + 1;

    conn.execute(
        "UPDATE creative_requests SET status = ?1, current_handler_role = 'review_supervisor', current_handler_id = (SELECT id FROM users WHERE role = 'review_supervisor' LIMIT 1), version = ?2, updated_at = ?3 WHERE id = ?4",
        rusqlite::params![to_status, new_version, now, id],
    )?;

    let action_label = if to_status == "resubmitted" { "resubmit" } else { "submit" };

    conn.execute(
        "INSERT INTO processing_records (request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![id, user.id, user.role, action_label, format!("{}需求单", to_status), from_status, to_status, now],
    )?;

    let req = conn
        .query_row(
            "SELECT id, request_number, title, client_name, brand, campaign_name, \
             brief_status, schedule_status, status, current_handler_role, current_handler_id, \
             deadline, version, description, created_by, created_at, updated_at \
             FROM creative_requests WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(CreativeRequest {
                    id: row.get(0)?,
                    request_number: row.get(1)?,
                    title: row.get(2)?,
                    client_name: row.get(3)?,
                    brand: row.get(4)?,
                    campaign_name: row.get(5)?,
                    brief_status: row.get(6)?,
                    schedule_status: row.get(7)?,
                    status: row.get(8)?,
                    current_handler_role: row.get(9)?,
                    current_handler_id: row.get(10)?,
                    deadline: row.get(11)?,
                    version: row.get(12)?,
                    description: row.get(13)?,
                    created_by: row.get(14)?,
                    created_at: row.get(15)?,
                    updated_at: row.get(16)?,
                })
            },
        )
        .map_err(|_| AppError::Internal("Failed to read submitted request".into()))?;

    Ok(Json(req))
}

pub async fn review(
    State(pool): State<DbPool>,
    user: AuthUser,
    Path(id): Path<i64>,
    Json(payload): Json<ReviewRequestPayload>,
) -> Result<Json<CreativeRequest>, AppError> {
    let conn = pool.lock().await;

    let current = conn
        .query_row(
            "SELECT status, version, schedule_status, brief_status FROM creative_requests WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                ))
            },
        )
        .map_err(|_| AppError::NotFound(format!("Creative request {} not found", id)))?;

    let (current_status, current_version, schedule_st, brief_st) = current;

    if current_version != payload.version {
        return Err(AppError::Conflict(format!(
            "Version mismatch: expected {} but got {}",
            current_version, payload.version
        )));
    }

    if payload.opinion.trim().is_empty() {
        return Err(AppError::Validation("Opinion text is required for review".into()));
    }

    let now = chrono::Utc::now().naive_utc().format("%Y-%m-%d %H:%M:%S").to_string();
    let new_version = current_version + 1;

    match payload.action.as_str() {
        "start_review" => {
            if user.role != "review_supervisor" {
                return Err(AppError::Forbidden(
                    "Only review_supervisor can start reviewing".into(),
                ));
            }
            if current_status != "submitted" && current_status != "resubmitted" {
                return Err(AppError::Validation(format!(
                    "Cannot start review from status '{}'. Expected 'submitted' or 'resubmitted'.",
                    current_status
                )));
            }
            conn.execute(
                "UPDATE creative_requests SET status = 'under_review', version = ?1, updated_at = ?2 WHERE id = ?3",
                rusqlite::params![new_version, now, id],
            )?;
            conn.execute(
                "INSERT INTO processing_records (request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                rusqlite::params![id, user.id, user.role, "start_review", payload.opinion, current_status, "under_review", now],
            )?;
        }
        "approve" => {
            if current_status == "under_review" {
                if user.role != "review_supervisor" {
                    return Err(AppError::Forbidden(
                        "Only review_supervisor can approve from under_review".into(),
                    ));
                }
                conn.execute(
                    "UPDATE creative_requests SET status = 'reviewed', current_handler_role = 'review_manager', current_handler_id = (SELECT id FROM users WHERE role = 'review_manager' LIMIT 1), version = ?1, updated_at = ?2 WHERE id = ?3",
                    rusqlite::params![new_version, now, id],
                )?;
                conn.execute(
                    "INSERT INTO processing_records (request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    rusqlite::params![id, user.id, user.role, "approve", payload.opinion, "under_review", "reviewed", now],
                )?;
            } else if current_status == "reviewed" {
                if user.role != "review_manager" {
                    return Err(AppError::Forbidden(
                        "Only review_manager can archive from reviewed".into(),
                    ));
                }
                if schedule_st == "missing" {
                    return Err(AppError::Validation(
                        "Cannot archive: schedule_status is 'missing'. Resolve schedule first.".into(),
                    ));
                }
                conn.execute(
                    "UPDATE creative_requests SET status = 'archived', version = ?1, updated_at = ?2 WHERE id = ?3",
                    rusqlite::params![new_version, now, id],
                )?;
                conn.execute(
                    "INSERT INTO processing_records (request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    rusqlite::params![id, user.id, user.role, "archive", payload.opinion, "reviewed", "archived", now],
                )?;
            } else {
                return Err(AppError::Validation(format!(
                    "Cannot approve from status '{}'. Expected 'under_review' or 'reviewed'.",
                    current_status
                )));
            }
        }
        "return" => {
            if user.role != "review_supervisor" && user.role != "review_manager" {
                return Err(AppError::Forbidden(
                    "Only review_supervisor or review_manager can return requests".into(),
                ));
            }
            let allowed = ["submitted", "resubmitted", "under_review", "reviewed"];
            if !allowed.contains(&current_status.as_str()) {
                return Err(AppError::Validation(format!(
                    "Cannot return from status '{}'. Expected 'submitted', 'resubmitted', 'under_review', or 'reviewed'.",
                    current_status
                )));
            }
            conn.execute(
                "UPDATE creative_requests SET status = 'returned', current_handler_role = 'creative_registrar', current_handler_id = (SELECT id FROM users WHERE role = 'creative_registrar' LIMIT 1), version = ?1, updated_at = ?2 WHERE id = ?3",
                rusqlite::params![new_version, now, id],
            )?;
            conn.execute(
                "INSERT INTO processing_records (request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                rusqlite::params![id, user.id, user.role, "return", payload.opinion, current_status, "returned", now],
            )?;
            if brief_st == "missing" || schedule_st == "missing" {
                conn.execute(
                    "INSERT INTO exception_reasons (request_id, reason_type, description, reported_by, resolved, created_at) VALUES (?1, ?2, ?3, ?4, 0, ?5)",
                    rusqlite::params![id, "return_deficiency", payload.opinion, user.id, now],
                )?;
            }
        }
        _ => {
            return Err(AppError::BadRequest(format!(
                "Unknown review action '{}'. Valid actions: start_review, approve, return.",
                payload.action
            )));
        }
    }

    let req = conn
        .query_row(
            "SELECT id, request_number, title, client_name, brand, campaign_name, \
             brief_status, schedule_status, status, current_handler_role, current_handler_id, \
             deadline, version, description, created_by, created_at, updated_at \
             FROM creative_requests WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(CreativeRequest {
                    id: row.get(0)?,
                    request_number: row.get(1)?,
                    title: row.get(2)?,
                    client_name: row.get(3)?,
                    brand: row.get(4)?,
                    campaign_name: row.get(5)?,
                    brief_status: row.get(6)?,
                    schedule_status: row.get(7)?,
                    status: row.get(8)?,
                    current_handler_role: row.get(9)?,
                    current_handler_id: row.get(10)?,
                    deadline: row.get(11)?,
                    version: row.get(12)?,
                    description: row.get(13)?,
                    created_by: row.get(14)?,
                    created_at: row.get(15)?,
                    updated_at: row.get(16)?,
                })
            },
        )
        .map_err(|_| AppError::Internal("Failed to read reviewed request".into()))?;

    Ok(Json(req))
}

pub async fn supplement(
    State(pool): State<DbPool>,
    user: AuthUser,
    Path(id): Path<i64>,
    Json(payload): Json<SupplementRequestPayload>,
) -> Result<Json<CreativeRequest>, AppError> {
    if user.role != "creative_registrar" {
        return Err(AppError::Forbidden(
            "Only creative_registrar can supplement requests".into(),
        ));
    }

    let conn = pool.lock().await;

    let current = conn
        .query_row(
            "SELECT status, version, brief_status, schedule_status FROM creative_requests WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                ))
            },
        )
        .map_err(|_| AppError::NotFound(format!("Creative request {} not found", id)))?;

    let (current_status, current_version, brief_st, schedule_st) = current;

    if current_version != payload.version {
        return Err(AppError::Conflict(format!(
            "Version mismatch: expected {} but got {}",
            current_version, payload.version
        )));
    }

    if current_status != "returned" {
        return Err(AppError::Validation(format!(
            "Cannot supplement from status '{}'. Only returned requests can be supplemented.",
            current_status
        )));
    }

    if brief_st != "missing" && schedule_st != "missing" {
        return Err(AppError::Validation(
            "Supplement is only allowed when brief_status=missing or schedule_status=missing".into(),
        ));
    }

    let now = chrono::Utc::now().naive_utc().format("%Y-%m-%d %H:%M:%S").to_string();
    let new_version = current_version + 1;

    let mut updates = vec![
        "version = ?1".to_string(),
        "updated_at = ?2".to_string(),
    ];
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(new_version),
        Box::new(now.clone()),
    ];
    let mut idx = 3;

    if let Some(ref new_brief) = payload.brief_status {
        if brief_st == "missing" {
            updates.push(format!("brief_status = ?{}", idx));
            param_values.push(Box::new(new_brief.clone()));
            idx += 1;
        }
    }

    if let Some(ref new_schedule) = payload.schedule_status {
        if schedule_st == "missing" {
            updates.push(format!("schedule_status = ?{}", idx));
            param_values.push(Box::new(new_schedule.clone()));
            idx += 1;
        }
    }

    if let Some(ref desc) = payload.description {
        updates.push(format!("description = ?{}", idx));
        param_values.push(Box::new(desc.clone()));
        idx += 1;
    }

    param_values.push(Box::new(id));

    let sql = format!(
        "UPDATE creative_requests SET {} WHERE id = ?{}",
        updates.join(", "),
        idx
    );

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, params_refs.as_slice())?;

    conn.execute(
        "INSERT INTO processing_records (request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![id, user.id, user.role, "supplement", payload.description.clone().unwrap_or_else(|| "补正材料".to_string()), "returned", "returned", now],
    )?;

    conn.execute(
        "UPDATE exception_reasons SET resolved = 1, resolved_at = ?1 WHERE request_id = ?2 AND resolved = 0",
        rusqlite::params![now, id],
    )?;

    let req = conn
        .query_row(
            "SELECT id, request_number, title, client_name, brand, campaign_name, \
             brief_status, schedule_status, status, current_handler_role, current_handler_id, \
             deadline, version, description, created_by, created_at, updated_at \
             FROM creative_requests WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(CreativeRequest {
                    id: row.get(0)?,
                    request_number: row.get(1)?,
                    title: row.get(2)?,
                    client_name: row.get(3)?,
                    brand: row.get(4)?,
                    campaign_name: row.get(5)?,
                    brief_status: row.get(6)?,
                    schedule_status: row.get(7)?,
                    status: row.get(8)?,
                    current_handler_role: row.get(9)?,
                    current_handler_id: row.get(10)?,
                    deadline: row.get(11)?,
                    version: row.get(12)?,
                    description: row.get(13)?,
                    created_by: row.get(14)?,
                    created_at: row.get(15)?,
                    updated_at: row.get(16)?,
                })
            },
        )
        .map_err(|_| AppError::Internal("Failed to read supplemented request".into()))?;

    Ok(Json(req))
}

pub async fn batch(
    State(pool): State<DbPool>,
    user: AuthUser,
    Json(payload): Json<BatchRequestPayload>,
) -> Result<Json<BatchResult>, AppError> {
    let mut results = Vec::new();

    for item in &payload.items {
        let result = process_batch_item(&pool, &user, item).await;
        results.push(result);
    }

    Ok(Json(BatchResult { results }))
}

async fn process_batch_item(pool: &DbPool, user: &AuthUser, item: &BatchItem) -> BatchItemResult {
    let conn = pool.lock().await;

    let current = match conn.query_row(
        "SELECT status, version, brief_status, schedule_status FROM creative_requests WHERE id = ?1",
        rusqlite::params![item.id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        },
    ) {
        Ok(r) => r,
        Err(_) => {
            return BatchItemResult {
                id: item.id,
                success: false,
                error: Some(format!("Request {} not found", item.id)),
                new_status: None,
            }
        }
    };

    let (current_status, current_version, brief_st, schedule_st) = current;

    if current_version != item.version {
        return BatchItemResult {
            id: item.id,
            success: false,
            error: Some(format!(
                "Version mismatch: expected {} but got {}",
                current_version, item.version
            )),
            new_status: None,
        };
    }

    let now = chrono::Utc::now().naive_utc().format("%Y-%m-%d %H:%M:%S").to_string();
    let new_version = current_version + 1;
    let opinion = item.opinion.clone().unwrap_or_default();

    match item.action.as_str() {
        "submit" => {
            if user.role != "creative_registrar" {
                return BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some("Only creative_registrar can submit".into()),
                    new_status: None,
                };
            }
            if current_status != "draft" && current_status != "pending_submit" && current_status != "returned" {
                return BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some(format!("Cannot submit from status '{}'", current_status)),
                    new_status: None,
                };
            }
            if brief_st == "missing" {
                return BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some("Cannot submit: brief_status is 'missing'".into()),
                    new_status: None,
                };
            }
            let to_status = if current_status == "returned" {
                "resubmitted"
            } else {
                "submitted"
            };
            match conn.execute(
                "UPDATE creative_requests SET status = ?1, current_handler_role = 'review_supervisor', current_handler_id = (SELECT id FROM users WHERE role = 'review_supervisor' LIMIT 1), version = ?2, updated_at = ?3 WHERE id = ?4",
                rusqlite::params![to_status, new_version, now, item.id],
            ) {
                Ok(_) => {
                    let _ = conn.execute(
                        "INSERT INTO processing_records (request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                        rusqlite::params![item.id, user.id, user.role, "submit", opinion, current_status, to_status, now],
                    );
                    BatchItemResult {
                        id: item.id,
                        success: true,
                        error: None,
                        new_status: Some(to_status.to_string()),
                    }
                }
                Err(e) => BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some(e.to_string()),
                    new_status: None,
                },
            }
        }
        "approve" => {
            if current_status == "under_review" && user.role == "review_supervisor" {
                match conn.execute(
                    "UPDATE creative_requests SET status = 'reviewed', current_handler_role = 'review_manager', current_handler_id = (SELECT id FROM users WHERE role = 'review_manager' LIMIT 1), version = ?1, updated_at = ?2 WHERE id = ?3",
                    rusqlite::params![new_version, now, item.id],
                ) {
                    Ok(_) => {
                        let _ = conn.execute(
                            "INSERT INTO processing_records (request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                            rusqlite::params![item.id, user.id, user.role, "approve", opinion, "under_review", "reviewed", now],
                        );
                        BatchItemResult {
                            id: item.id,
                            success: true,
                            error: None,
                            new_status: Some("reviewed".to_string()),
                        }
                    }
                    Err(e) => BatchItemResult {
                        id: item.id,
                        success: false,
                        error: Some(e.to_string()),
                        new_status: None,
                    },
                }
            } else if current_status == "reviewed" && user.role == "review_manager" {
                if schedule_st == "missing" {
                    return BatchItemResult {
                        id: item.id,
                        success: false,
                        error: Some("Cannot archive: schedule_status is 'missing'".into()),
                        new_status: None,
                    };
                }
                let warning = compute_deadline_warning(
                    &conn.query_row(
                        "SELECT deadline FROM creative_requests WHERE id = ?1",
                        rusqlite::params![item.id],
                        |row| row.get::<_, String>(0),
                    ).unwrap_or_default(),
                );
                if warning == DeadlineWarning::Overdue {
                    return BatchItemResult {
                        id: item.id,
                        success: false,
                        error: Some("Cannot archive overdue items".into()),
                        new_status: None,
                    };
                }
                match conn.execute(
                    "UPDATE creative_requests SET status = 'archived', version = ?1, updated_at = ?2 WHERE id = ?3",
                    rusqlite::params![new_version, now, item.id],
                ) {
                    Ok(_) => {
                        let _ = conn.execute(
                            "INSERT INTO processing_records (request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                            rusqlite::params![item.id, user.id, user.role, "archive", opinion, "reviewed", "archived", now],
                        );
                        BatchItemResult {
                            id: item.id,
                            success: true,
                            error: None,
                            new_status: Some("archived".to_string()),
                        }
                    }
                    Err(e) => BatchItemResult {
                        id: item.id,
                        success: false,
                        error: Some(e.to_string()),
                        new_status: None,
                    },
                }
            } else {
                BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some(format!(
                        "Cannot approve from status '{}' with role '{}'",
                        current_status, user.role
                    )),
                    new_status: None,
                }
            }
        }
        "return" => {
            if user.role != "review_supervisor" && user.role != "review_manager" {
                return BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some("Only review_supervisor or review_manager can return".into()),
                    new_status: None,
                };
            }
            let allowed = ["submitted", "resubmitted", "under_review", "reviewed"];
            if !allowed.contains(&current_status.as_str()) {
                return BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some(format!("Cannot return from status '{}'", current_status)),
                    new_status: None,
                };
            }
            if opinion.trim().is_empty() {
                return BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some("Opinion is required when returning".into()),
                    new_status: None,
                };
            }
            match conn.execute(
                "UPDATE creative_requests SET status = 'returned', current_handler_role = 'creative_registrar', current_handler_id = (SELECT id FROM users WHERE role = 'creative_registrar' LIMIT 1), version = ?1, updated_at = ?2 WHERE id = ?3",
                rusqlite::params![new_version, now, item.id],
            ) {
                Ok(_) => {
                    let _ = conn.execute(
                        "INSERT INTO processing_records (request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                        rusqlite::params![item.id, user.id, user.role, "return", opinion, current_status, "returned", now],
                    );
                    BatchItemResult {
                        id: item.id,
                        success: true,
                        error: None,
                        new_status: Some("returned".to_string()),
                    }
                }
                Err(e) => BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some(e.to_string()),
                    new_status: None,
                },
            }
        }
        _ => BatchItemResult {
            id: item.id,
            success: false,
            error: Some(format!("Unknown action '{}'", item.action)),
            new_status: None,
        },
    }
}

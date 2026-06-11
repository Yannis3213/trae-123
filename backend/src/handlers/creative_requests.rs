use axum::{extract::{Path, Query, State}, Json};
use crate::db::DbPool;
use crate::error::AppError;
use crate::middleware::AuthUser;
use crate::models::*;

fn log_exception(
    conn: &rusqlite::Connection,
    request_id: i64,
    reported_by: i64,
    reason_type: &str,
    description: &str,
    now: &str,
) {
    let _ = conn.execute(
        "INSERT INTO exception_reasons (request_id, reason_type, description, reported_by, resolved, created_at) VALUES (?1, ?2, ?3, ?4, 0, ?5)",
        rusqlite::params![request_id, reason_type, description, reported_by, now],
    );
}

fn log_audit_note(
    conn: &rusqlite::Connection,
    request_id: i64,
    author_id: i64,
    note_type: &str,
    content: &str,
    now: &str,
) {
    let _ = conn.execute(
        "INSERT INTO audit_notes (request_id, author_id, content, note_type, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![request_id, author_id, content, note_type, now],
    );
}

fn log_blocked_action(
    conn: &rusqlite::Connection,
    request_id: i64,
    user_id: i64,
    user_role: &str,
    attempted_action: &str,
    from_status: &str,
    reason_type: &str,
    reason_detail: &str,
    now: &str,
) {
    let _ = conn.execute(
        "INSERT INTO processing_records (request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![request_id, user_id, user_role, format!("blocked_{}", attempted_action), reason_detail, from_status, from_status, now],
    );
    log_exception(conn, request_id, user_id, reason_type, reason_detail, now);
    log_audit_note(conn, request_id, user_id, "exception", &format!("操作被拦截[{}]：{}", attempted_action, reason_type), now);
}

fn is_overdue(deadline_str: &str) -> bool {
    matches!(compute_deadline_warning(deadline_str), DeadlineWarning::Overdue)
}

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
            "SELECT status, version, current_handler_id FROM creative_requests WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            },
        )
        .map_err(|_| AppError::NotFound(format!("Creative request {} not found", id)))?;

    let (current_status, current_version, handler_id) = current;

    if current_version != payload.version {
        let now = chrono::Utc::now().naive_utc().format("%Y-%m-%d %H:%M:%S").to_string();
        log_blocked_action(
            &conn, id, user.id, &user.role, "update", &current_status,
            "version_conflict",
            &format!(
                "更新版本冲突：期望 v{}，收到 v{}，需求单状态 '{}' 下被拒绝",
                current_version, payload.version, current_status
            ),
            &now,
        );
        return Err(AppError::Conflict(format!(
            "Version mismatch: expected {} but got {}. The request has been modified by another user.",
            current_version, payload.version
        )));
    }

    if handler_id != user.id {
        let now = chrono::Utc::now().naive_utc().format("%Y-%m-%d %H:%M:%S").to_string();
        log_blocked_action(
            &conn, id, user.id, &user.role, "update", &current_status,
            "handler_mismatch",
            &format!(
                "越权更新：当前处理人 ID={}，操作者 ID={} ({})",
                handler_id, user.id, user.display_name
            ),
            &now,
        );
        return Err(AppError::Forbidden(format!(
            "You are not the current handler of request {}. Only handler ID={} can update.",
            id, handler_id
        )));
    }

    let allowed_statuses = ["draft", "pending_submit", "returned"];
    if !allowed_statuses.contains(&current_status.as_str()) {
        let now = chrono::Utc::now().naive_utc().format("%Y-%m-%d %H:%M:%S").to_string();
        log_blocked_action(
            &conn, id, user.id, &user.role, "update", &current_status,
            "status_conflict",
            &format!(
                "状态冲突：不允许从 '{}' 更新，允许状态 = {:?}",
                current_status, allowed_statuses
            ),
            &now,
        );
        return Err(AppError::Conflict(format!(
            "Cannot update request in status '{}'. Only draft, pending_submit, or returned can be edited.",
            current_status
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
        Box::new(now.clone()),
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
    let now = chrono::Utc::now().naive_utc().format("%Y-%m-%d %H:%M:%S").to_string();

    if user.role != "creative_registrar" {
        return Err(AppError::Forbidden(
            "Only creative_registrar can submit requests".into(),
        ));
    }

    let conn = pool.lock().await;

    let current = conn
        .query_row(
            "SELECT status, version, brief_status, schedule_status, current_handler_id, deadline FROM creative_requests WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, i64>(4)?,
                    row.get::<_, String>(5)?,
                ))
            },
        )
        .map_err(|_| AppError::NotFound(format!("Creative request {} not found", id)))?;

    let (current_status, current_version, brief_st, schedule_st, handler_id, deadline_str) = current;

    if current_version != payload.version {
        log_blocked_action(
            &conn, id, user.id, &user.role, "submit", &current_status,
            "version_conflict",
            &format!(
                "提交版本冲突：期望 v{}，收到 v{}",
                current_version, payload.version
            ),
            &now,
        );
        return Err(AppError::Conflict(format!(
            "Version mismatch: expected {} but got {}",
            current_version, payload.version
        )));
    }

    if handler_id != user.id {
        log_blocked_action(
            &conn, id, user.id, &user.role, "submit", &current_status,
            "handler_mismatch",
            &format!(
                "越权提交：当前处理人 ID={}，操作者 ID={} ({})",
                handler_id, user.id, user.display_name
            ),
            &now,
        );
        return Err(AppError::Forbidden(format!(
            "You are not the current handler (ID={}) of request {}.",
            handler_id, id
        )));
    }

    let (from_status, to_status) = match current_status.as_str() {
        "draft" => ("draft", "submitted"),
        "pending_submit" => ("pending_submit", "submitted"),
        "returned" => ("returned", "resubmitted"),
        _ => {
            log_blocked_action(
                &conn, id, user.id, &user.role, "submit", &current_status,
                "status_conflict",
                &format!(
                    "提交状态冲突：'{}' 不可提交，仅允许 draft/pending_submit/returned",
                    current_status
                ),
                &now,
            );
            return Err(AppError::Validation(format!(
                "Cannot submit from status '{}'. Only draft, pending_submit, or returned can be submitted.",
                current_status
            )));
        }
    };

    if brief_st == "missing" {
        log_blocked_action(
            &conn, id, user.id, &user.role, "submit", &current_status,
            "brief_missing", "提交被拦截：Brief缺失 (brief_status=missing)", &now,
        );
        return Err(AppError::Validation(
            "Cannot submit: brief_status is 'missing'. Please supplement the brief first.".into(),
        ));
    }

    if schedule_st == "missing" {
        log_blocked_action(&conn, id, user.id, &user.role, "submit", &current_status,
            "schedule_missing", "提交被拦截：排期缺失 (schedule_status=missing)", &now);
        return Err(AppError::Validation(
            "Cannot submit: schedule_status is 'missing'. Please supplement the schedule first.".into(),
        ));
    }

    if is_overdue(&deadline_str) {
        log_blocked_action(
            &conn, id, user.id, &user.role, "submit", &current_status,
            "overdue_blocked",
            &format!(
                "提交被拦截：需求单已逾期（截止日期 {}），仅允许补正或退回",
                deadline_str
            ),
            &now,
        );
        return Err(AppError::Validation(format!(
            "Cannot submit: request is overdue (deadline={}). Only supplement or return is allowed.",
            deadline_str
        )));
    }

    let new_version = current_version + 1;

    conn.execute(
        "UPDATE creative_requests SET status = ?1, current_handler_role = 'review_supervisor', current_handler_id = (SELECT id FROM users WHERE role = 'review_supervisor' LIMIT 1), version = ?2, updated_at = ?3 WHERE id = ?4",
        rusqlite::params![to_status, new_version, now, id],
    )?;

    let action_label = if to_status == "resubmitted" { "resubmit" } else { "submit" };
    let default_opinion = if to_status == "resubmitted" {
        "补正后重新提交审核"
    } else {
        "提交审核"
    };

    conn.execute(
        "INSERT INTO processing_records (request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![id, user.id, user.role, action_label, default_opinion, from_status, to_status, now],
    )?;

    if to_status == "resubmitted" {
        log_audit_note(
            &conn, id, user.id, "resubmit",
            "补正后重新提交审核，进入复审流程", &now,
        );
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
        .map_err(|_| AppError::Internal("Failed to read submitted request".into()))?;

    Ok(Json(req))
}

pub async fn review(
    State(pool): State<DbPool>,
    user: AuthUser,
    Path(id): Path<i64>,
    Json(payload): Json<ReviewRequestPayload>,
) -> Result<Json<CreativeRequest>, AppError> {
    let now = chrono::Utc::now().naive_utc().format("%Y-%m-%d %H:%M:%S").to_string();
    let conn = pool.lock().await;

    let current = conn
        .query_row(
            "SELECT status, version, schedule_status, brief_status, current_handler_id, deadline FROM creative_requests WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, i64>(4)?,
                    row.get::<_, String>(5)?,
                ))
            },
        )
        .map_err(|_| AppError::NotFound(format!("Creative request {} not found", id)))?;

    let (current_status, current_version, schedule_st, brief_st, handler_id, deadline_str) = current;

    if current_version != payload.version {
        log_blocked_action(
            &conn, id, user.id, &user.role, &payload.action, &current_status,
            "version_conflict",
            &format!(
                "审核版本冲突：期望 v{}，收到 v{}，动作={}",
                current_version, payload.version, payload.action
            ),
            &now,
        );
        return Err(AppError::Conflict(format!(
            "Version mismatch: expected {} but got {}",
            current_version, payload.version
        )));
    }

    if handler_id != user.id {
        log_blocked_action(
            &conn, id, user.id, &user.role, &payload.action, &current_status,
            "handler_mismatch",
            &format!(
                "越权审核：当前处理人 ID={}，操作者 ID={} ({})，动作={}",
                handler_id, user.id, user.display_name, payload.action
            ),
            &now,
        );
        return Err(AppError::Forbidden(format!(
            "You are not the current handler (ID={}) of request {}. Cannot perform '{}'.",
            handler_id, id, payload.action
        )));
    }

    if payload.opinion.trim().is_empty() {
        log_blocked_action(
            &conn, id, user.id, &user.role, &payload.action, &current_status,
            "opinion_required",
            &format!(
                "审核意见缺失：动作 {} 必须填写处理意见",
                payload.action
            ),
            &now,
        );
        return Err(AppError::Validation(
            "Opinion text is required for review actions (start_review / approve / return)".into(),
        ));
    }

    let overdue = is_overdue(&deadline_str);
    let is_return_action = payload.action == "return";
    if overdue && !is_return_action {
        log_blocked_action(
            &conn, id, user.id, &user.role, &payload.action, &current_status,
            "overdue_blocked",
            &format!(
                "逾期拦截：{} 操作被拒绝，截止日期 {} 已过，仅允许退回或补正",
                payload.action, deadline_str
            ),
            &now,
        );
        return Err(AppError::Validation(format!(
            "Cannot perform '{}': request is overdue (deadline={}). Only return or supplement is allowed.",
            payload.action, deadline_str
        )));
    }

    let new_version = current_version + 1;

    match payload.action.as_str() {
        "start_review" => {
            if user.role != "review_supervisor" {
                log_blocked_action(
                    &conn, id, user.id, &user.role, "start_review", &current_status,
                    "role_mismatch",
                    &format!("开始审核角色不匹配：期望 review_supervisor，当前={}", user.role),
                    &now,
                );
                return Err(AppError::Forbidden(
                    "Only review_supervisor can start reviewing".into(),
                ));
            }
            if current_status != "submitted" && current_status != "resubmitted" {
                log_blocked_action(
                    &conn, id, user.id, &user.role, "start_review", &current_status,
                    "status_conflict",
                    &format!("开始审核状态冲突：期望 submitted/resubmitted，当前={}", current_status),
                    &now,
                );
                return Err(AppError::Validation(format!(
                    "Cannot start review from status '{}'. Expected 'submitted' or 'resubmitted'.",
                    current_status
                )));
            }
            if brief_st == "missing" {
                log_blocked_action(
                    &conn, id, user.id, &user.role, "start_review", &current_status,
                    "brief_missing",
                    "开始审核被拦截：Brief 缺失 (brief_status=missing)", &now,
                );
                return Err(AppError::Validation(
                    "Cannot start review: brief_status is 'missing'. Return to registrar to supplement.".into(),
                ));
            }
            if schedule_st == "missing" {
                log_blocked_action(
                    &conn, id, user.id, &user.role, "start_review", &current_status,
                    "schedule_missing",
                    "开始审核被拦截：排期缺失 (schedule_status=missing)", &now,
                );
                return Err(AppError::Validation(
                    "Cannot start review: schedule_status is 'missing'. Return to registrar to supplement.".into(),
                ));
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
                    log_blocked_action(
                        &conn, id, user.id, &user.role, "approve", "under_review",
                        "role_mismatch",
                        &format!("通过审核角色不匹配：期望 review_supervisor，当前={}", user.role), &now,
                    );
                    return Err(AppError::Forbidden(
                        "Only review_supervisor can approve from under_review".into(),
                    ));
                }
                if brief_st == "missing" {
                    log_blocked_action(&conn, id, user.id, &user.role, "approve", "under_review",
                        "brief_missing", "审核通过被拦截：Brief 仍为 missing", &now);
                    return Err(AppError::Validation(
                        "Cannot approve: brief_status is 'missing'. Return to supplement first.".into(),
                    ));
                }
                if schedule_st == "missing" {
                    log_blocked_action(&conn, id, user.id, &user.role, "approve", "under_review",
                        "schedule_missing", "审核通过被拦截：排期缺失 (schedule_status=missing)", &now);
                    return Err(AppError::Validation(
                        "Cannot approve: schedule_status is 'missing'. Resolve schedule first.".into(),
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
                    log_blocked_action(
                        &conn, id, user.id, &user.role, "approve", "reviewed",
                        "role_mismatch",
                        &format!("归档角色不匹配：期望 review_manager，当前={}", user.role), &now,
                    );
                    return Err(AppError::Forbidden(
                        "Only review_manager can archive from reviewed".into(),
                    ));
                }
                if schedule_st == "missing" {
                    log_blocked_action(&conn, id, user.id, &user.role, "approve", "reviewed",
                        "schedule_missing", "归档被拦截：排期缺失 (schedule_status=missing)", &now);
                    return Err(AppError::Validation(
                        "Cannot archive: schedule_status is 'missing'. Resolve schedule first.".into(),
                    ));
                }
                if brief_st == "missing" {
                    log_blocked_action(&conn, id, user.id, &user.role, "approve", "reviewed",
                        "brief_missing", "归档被拦截：Brief 缺失 (brief_status=missing)", &now);
                    return Err(AppError::Validation(
                        "Cannot archive: brief_status is 'missing'. Resolve brief first.".into(),
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
                log_blocked_action(
                    &conn, id, user.id, &user.role, "approve", &current_status,
                    "status_conflict",
                    &format!("approve 状态冲突：期望 under_review/reviewed，当前={}", current_status), &now,
                );
                return Err(AppError::Validation(format!(
                    "Cannot approve from status '{}'. Expected 'under_review' or 'reviewed'.",
                    current_status
                )));
            }
        }
        "return" => {
            if user.role != "review_supervisor" && user.role != "review_manager" {
                log_blocked_action(
                    &conn, id, user.id, &user.role, "return", &current_status,
                    "role_mismatch",
                    &format!("退回角色不匹配：期望 review_supervisor/review_manager，当前={}", user.role), &now,
                );
                return Err(AppError::Forbidden(
                    "Only review_supervisor or review_manager can return requests".into(),
                ));
            }
            let allowed = ["submitted", "resubmitted", "under_review", "reviewed"];
            if !allowed.contains(&current_status.as_str()) {
                log_blocked_action(
                    &conn, id, user.id, &user.role, "return", &current_status,
                    "status_conflict",
                    &format!("退回状态冲突：当前={}，允许={:?}", current_status, allowed), &now,
                );
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
                rusqlite::params![id, user.id, user.role, "return", payload.opinion.clone(), current_status.clone(), "returned", now.clone()],
            )?;
            if brief_st == "missing" || schedule_st == "missing" {
                conn.execute(
                    "INSERT INTO exception_reasons (request_id, reason_type, description, reported_by, resolved, created_at) VALUES (?1, ?2, ?3, ?4, 0, ?5)",
                    rusqlite::params![id, "return_deficiency", payload.opinion, user.id, now],
                )?;
            } else {
                log_exception(
                    &conn, id, user.id, "return_with_other_reason",
                    &payload.opinion, &now,
                );
            }
            log_audit_note(
                &conn, id, user.id, "audit",
                &format!("退回登记员：{}", payload.opinion), &now,
            );
        }
        _ => {
            log_blocked_action(
                &conn, id, user.id, &user.role, &payload.action, &current_status,
                "unknown_action",
                &format!("未知审核动作：'{}'", payload.action), &now,
            );
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
    let now = chrono::Utc::now().naive_utc().format("%Y-%m-%d %H:%M:%S").to_string();

    if user.role != "creative_registrar" {
        return Err(AppError::Forbidden(
            "Only creative_registrar can supplement requests".into(),
        ));
    }

    let conn = pool.lock().await;

    let current = conn
        .query_row(
            "SELECT status, version, brief_status, schedule_status, current_handler_id FROM creative_requests WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, i64>(4)?,
                ))
            },
        )
        .map_err(|_| AppError::NotFound(format!("Creative request {} not found", id)))?;

    let (current_status, current_version, brief_st, schedule_st, handler_id) = current;

    if current_version != payload.version {
        log_blocked_action(
            &conn, id, user.id, &user.role, "supplement", &current_status,
            "version_conflict",
            &format!("补正版本冲突：期望 v{}，收到 v{}", current_version, payload.version), &now,
        );
        return Err(AppError::Conflict(format!(
            "Version mismatch: expected {} but got {}",
            current_version, payload.version
        )));
    }

    if handler_id != user.id {
        log_blocked_action(
            &conn, id, user.id, &user.role, "supplement", &current_status,
            "handler_mismatch",
            &format!("越权补正：当前处理人 ID={}，操作者 ID={} ({})", handler_id, user.id, user.display_name), &now,
        );
        return Err(AppError::Forbidden(format!(
            "You are not the current handler (ID={}) of request {}. Only handler can supplement.",
            handler_id, id
        )));
    }

    if current_status != "returned" {
        log_blocked_action(
            &conn, id, user.id, &user.role, "supplement", &current_status,
            "status_conflict",
            &format!("补正状态冲突：期望 returned，当前={}", current_status), &now,
        );
        return Err(AppError::Validation(format!(
            "Cannot supplement from status '{}'. Only returned requests can be supplemented.",
            current_status
        )));
    }

    if brief_st != "missing" && schedule_st != "missing" {
        log_blocked_action(
            &conn, id, user.id, &user.role, "supplement", &current_status,
            "supplement_not_needed",
            format!(
                "补正条件不满足：brief={}, schedule={}，两者都不为 missing，无需补正",
                brief_st, schedule_st
            ).as_str(),
            &now,
        );
        return Err(AppError::Validation(
            "Supplement is only allowed when brief_status=missing or schedule_status=missing".into(),
        ));
    }

    let has_brief_supplement = payload.brief_status.as_ref().map(|s| !s.is_empty()).unwrap_or(false);
    let has_schedule_supplement = payload.schedule_status.as_ref().map(|s| !s.is_empty()).unwrap_or(false);
    let has_description = payload.description.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false);

    if brief_st == "missing" && !has_brief_supplement && !has_description {
        log_blocked_action(
            &conn, id, user.id, &user.role, "supplement", &current_status,
            "insufficient_supplement",
            "补正失败：Brief 为 missing，但未提供 brief_status 补正或补充说明", &now,
        );
        return Err(AppError::Validation(
            "Brief is missing: must provide brief_status supplement or description".into(),
        ));
    }
    if schedule_st == "missing" && !has_schedule_supplement && !has_description {
        log_blocked_action(
            &conn, id, user.id, &user.role, "supplement", &current_status,
            "insufficient_supplement",
            "补正失败：排期为 missing，但未提供 schedule_status 补正或补充说明", &now,
        );
        return Err(AppError::Validation(
            "Schedule is missing: must provide schedule_status supplement or description".into(),
        ));
    }

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
        if brief_st == "missing" && !new_brief.is_empty() {
            updates.push(format!("brief_status = ?{}", idx));
            param_values.push(Box::new(new_brief.clone()));
            idx += 1;
        }
    }

    if let Some(ref new_schedule) = payload.schedule_status {
        if schedule_st == "missing" && !new_schedule.is_empty() {
            updates.push(format!("schedule_status = ?{}", idx));
            param_values.push(Box::new(new_schedule.clone()));
            idx += 1;
        }
    }

    if let Some(ref desc) = payload.description {
        if !desc.trim().is_empty() {
            updates.push(format!("description = ?{}", idx));
            param_values.push(Box::new(desc.clone()));
            idx += 1;
        }
    }

    param_values.push(Box::new(id));

    let sql = format!(
        "UPDATE creative_requests SET {} WHERE id = ?{}",
        updates.join(", "),
        idx
    );

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, params_refs.as_slice())?;

    let brief_diff = if has_brief_supplement && brief_st == "missing" {
        let new_brief = payload.brief_status.clone().unwrap_or_default();
        format!("Brief: {} → {}", brief_st, new_brief)
    } else {
        String::new()
    };
    let schedule_diff = if has_schedule_supplement && schedule_st == "missing" {
        let new_schedule = payload.schedule_status.clone().unwrap_or_default();
        format!("排期: {} → {}", schedule_st, new_schedule)
    } else {
        String::new()
    };
    let desc_part = payload.description.clone().unwrap_or_default();
    let supplement_detail = match (brief_diff.is_empty(), schedule_diff.is_empty(), desc_part.is_empty()) {
        (false, false, false) => format!("{}，{}；补充说明：{}", brief_diff, schedule_diff, desc_part),
        (false, false, true) => format!("{}，{}", brief_diff, schedule_diff),
        (false, true, false) => format!("{}；补充说明：{}", brief_diff, desc_part),
        (false, true, true) => brief_diff,
        (true, false, false) => format!("{}；补充说明：{}", schedule_diff, desc_part),
        (true, false, true) => schedule_diff,
        (true, true, false) => format!("补充说明：{}", desc_part),
        (true, true, true) => "无补正内容".to_string(),
    };

    conn.execute(
        "INSERT INTO processing_records (request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            id, user.id, user.role, "supplement",
            supplement_detail.clone(),
            "returned", "returned", now.clone()
        ],
    )?;

    conn.execute(
        "UPDATE exception_reasons SET resolved = 1, resolved_at = ?1 WHERE request_id = ?2 AND resolved = 0 AND reason_type = 'return_deficiency'",
        rusqlite::params![now, id],
    )?;

    log_audit_note(
        &conn, id, user.id, "supplement",
        &format!("补正完成：{}", supplement_detail), &now,
    );

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
    let now = chrono::Utc::now().naive_utc().format("%Y-%m-%d %H:%M:%S").to_string();

    let current = match conn.query_row(
        "SELECT status, version, brief_status, schedule_status, current_handler_id, deadline FROM creative_requests WHERE id = ?1",
        rusqlite::params![item.id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, String>(5)?,
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

    let (current_status, current_version, brief_st, schedule_st, handler_id, deadline_str) = current;

    if current_version != item.version {
        let err = format!(
            "Version mismatch: expected {} but got {}",
            current_version, item.version
        );
        log_blocked_action(&conn, item.id, user.id, &user.role, &item.action, &current_status,
            "version_conflict", &format!("批量{}：{}", item.action, err), &now);
        return BatchItemResult {
            id: item.id,
            success: false,
            error: Some(err),
            new_status: None,
        };
    }

    if handler_id != user.id {
        let err = format!(
            "Not the current handler (ID={}) for request {}",
            handler_id, item.id
        );
        log_blocked_action(&conn, item.id, user.id, &user.role, &item.action, &current_status,
            "handler_mismatch",
            &format!("批量{}越权：操作者={} (ID={})，处理人ID={}",
                item.action, user.display_name, user.id, handler_id), &now);
        return BatchItemResult {
            id: item.id,
            success: false,
            error: Some(err),
            new_status: None,
        };
    }

    let opinion = item.opinion.clone().unwrap_or_default();
    let overdue = is_overdue(&deadline_str);
    let is_return = item.action == "return";
    let is_supplement_like = false;

    if overdue && !is_return && !is_supplement_like {
        let err = format!(
            "Overdue request (deadline={}). Only return or supplement allowed.",
            deadline_str
        );
        log_blocked_action(&conn, item.id, user.id, &user.role, &item.action, &current_status,
            "overdue_blocked",
            &format!("批量 {} 逾期拦截：{}，截止 {}，仅允许退回补正",
                item.action, user.display_name, deadline_str), &now);
        return BatchItemResult {
            id: item.id,
            success: false,
            error: Some(err),
            new_status: None,
        };
    }

    let new_version = current_version + 1;

    match item.action.as_str() {
        "submit" => {
            if user.role != "creative_registrar" {
                let err = "Only creative_registrar can submit".to_string();
                log_blocked_action(&conn, item.id, user.id, &user.role, "submit", &current_status,
                    "role_mismatch",
                    &format!("批量提交：角色 {} 不匹配 creative_registrar", user.role), &now);
                return BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some(err),
                    new_status: None,
                };
            }
            if current_status != "draft" && current_status != "pending_submit" && current_status != "returned" {
                let err = format!("Cannot submit from status '{}'", current_status);
                log_blocked_action(&conn, item.id, user.id, &user.role, "submit", &current_status,
                    "status_conflict", &format!("批量提交状态冲突：{}", err), &now);
                return BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some(err),
                    new_status: None,
                };
            }
            if brief_st == "missing" {
                let err = "Cannot submit: brief_status is 'missing'".to_string();
                log_blocked_action(&conn, item.id, user.id, &user.role, "submit", &current_status,
                    "brief_missing", "批量提交拦截：Brief 缺失", &now);
                return BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some(err),
                    new_status: None,
                };
            }
            if schedule_st == "missing" {
                let err = "Cannot submit: schedule_status is 'missing'".to_string();
                log_blocked_action(&conn, item.id, user.id, &user.role, "submit", &current_status,
                    "schedule_missing", "批量提交拦截：排期缺失", &now);
                return BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some(err),
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
                    let default_opinion = if to_status == "resubmitted" {
                        if opinion.is_empty() { "批量补正后重新提交".to_string() } else { opinion.clone() }
                    } else {
                        if opinion.is_empty() { "批量提交审核".to_string() } else { opinion.clone() }
                    };
                    let action_label = if to_status == "resubmitted" { "resubmit" } else { "submit" };
                    let _ = conn.execute(
                        "INSERT INTO processing_records (request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                        rusqlite::params![item.id, user.id, user.role, action_label, default_opinion, current_status, to_status, now],
                    );
                    BatchItemResult {
                        id: item.id,
                        success: true,
                        error: None,
                        new_status: Some(to_status.to_string()),
                    }
                }
                Err(e) => {
                    log_blocked_action(&conn, item.id, user.id, &user.role, "submit", &current_status,
                        "db_error", &format!("批量提交数据库错误：{}", e), &now);
                    BatchItemResult {
                        id: item.id,
                        success: false,
                        error: Some(e.to_string()),
                        new_status: None,
                    }
                }
            }
        }
        "start_review" => {
            if opinion.trim().is_empty() {
                let err = "Opinion is required for batch start_review".to_string();
                log_blocked_action(&conn, item.id, user.id, &user.role, "start_review", &current_status,
                    "opinion_required", "批量开始审核：意见为空", &now);
                return BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some(err),
                    new_status: None,
                };
            }
            if user.role != "review_supervisor" {
                let err = format!("Only review_supervisor can start_review, got role '{}'", user.role);
                log_blocked_action(&conn, item.id, user.id, &user.role, "start_review", &current_status,
                    "role_mismatch", &format!("批量开始审核：{}", err), &now);
                return BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some(err),
                    new_status: None,
                };
            }
            if current_status != "submitted" && current_status != "resubmitted" {
                let err = format!("Cannot start_review from status '{}'", current_status);
                log_blocked_action(&conn, item.id, user.id, &user.role, "start_review", &current_status,
                    "status_conflict", &format!("批量开始审核状态冲突：{}", err), &now);
                return BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some(err),
                    new_status: None,
                };
            }
            if brief_st == "missing" {
                let err = "Cannot start_review: brief_status is 'missing'".to_string();
                log_blocked_action(&conn, item.id, user.id, &user.role, "start_review", &current_status,
                    "brief_missing", "批量开始审核拦截：Brief 缺失", &now);
                return BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some(err),
                    new_status: None,
                };
            }
            if schedule_st == "missing" {
                let err = "Cannot start_review: schedule_status is 'missing'".to_string();
                log_blocked_action(&conn, item.id, user.id, &user.role, "start_review", &current_status,
                    "schedule_missing", "批量开始审核拦截：排期缺失", &now);
                return BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some(err),
                    new_status: None,
                };
            }
            match conn.execute(
                "UPDATE creative_requests SET status = 'under_review', version = ?1, updated_at = ?2 WHERE id = ?3",
                rusqlite::params![new_version, now, item.id],
            ) {
                Ok(_) => {
                    let _ = conn.execute(
                        "INSERT INTO processing_records (request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                        rusqlite::params![item.id, user.id, user.role, "start_review", opinion, current_status, "under_review", now],
                    );
                    BatchItemResult {
                        id: item.id,
                        success: true,
                        error: None,
                        new_status: Some("under_review".to_string()),
                    }
                }
                Err(e) => {
                    log_blocked_action(&conn, item.id, user.id, &user.role, "start_review", &current_status,
                        "db_error", &format!("批量开始审核数据库错误：{}", e), &now);
                    BatchItemResult {
                        id: item.id,
                        success: false,
                        error: Some(e.to_string()),
                        new_status: None,
                    }
                }
            }
        }
        "approve" => {
            if opinion.trim().is_empty() {
                let err = "Opinion is required for batch approve".to_string();
                log_blocked_action(&conn, item.id, user.id, &user.role, "approve", &current_status,
                    "opinion_required", "批量通过/归档：意见为空", &now);
                return BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some(err),
                    new_status: None,
                };
            }
            if current_status == "under_review" && user.role == "review_supervisor" {
                if brief_st == "missing" {
                    let err = "Cannot approve: brief_status is 'missing'".to_string();
                    log_blocked_action(&conn, item.id, user.id, &user.role, "approve", &current_status,
                        "brief_missing", "批量审核通过拦截：Brief 缺失", &now);
                    return BatchItemResult {
                        id: item.id,
                        success: false,
                        error: Some(err),
                        new_status: None,
                    };
                }
                if schedule_st == "missing" {
                    let err = "Cannot approve: schedule_status is 'missing'".to_string();
                    log_blocked_action(&conn, item.id, user.id, &user.role, "approve", &current_status,
                        "schedule_missing", "批量审核通过拦截：排期缺失", &now);
                    return BatchItemResult {
                        id: item.id,
                        success: false,
                        error: Some(err),
                        new_status: None,
                    };
                }
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
                    Err(e) => {
                        log_blocked_action(&conn, item.id, user.id, &user.role, "approve", &current_status,
                            "db_error", &format!("批量审核通过数据库错误：{}", e), &now);
                        BatchItemResult {
                            id: item.id,
                            success: false,
                            error: Some(e.to_string()),
                            new_status: None,
                        }
                    }
                }
            } else if current_status == "reviewed" && user.role == "review_manager" {
                if schedule_st == "missing" {
                    let err = "Cannot archive: schedule_status is 'missing'".to_string();
                    log_blocked_action(&conn, item.id, user.id, &user.role, "approve", "reviewed",
                        "schedule_missing", "批量归档拦截：排期缺失", &now);
                    return BatchItemResult {
                        id: item.id,
                        success: false,
                        error: Some(err),
                        new_status: None,
                    };
                }
                if brief_st == "missing" {
                    let err = "Cannot archive: brief_status is 'missing'".to_string();
                    log_blocked_action(&conn, item.id, user.id, &user.role, "approve", "reviewed",
                        "brief_missing", "批量归档拦截：Brief 缺失", &now);
                    return BatchItemResult {
                        id: item.id,
                        success: false,
                        error: Some(err),
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
                    Err(e) => {
                        log_blocked_action(&conn, item.id, user.id, &user.role, "approve", "reviewed",
                            "db_error", &format!("批量归档数据库错误：{}", e), &now);
                        BatchItemResult {
                            id: item.id,
                            success: false,
                            error: Some(e.to_string()),
                            new_status: None,
                        }
                    }
                }
            } else {
                let err = format!(
                    "Cannot approve from status '{}' with role '{}'",
                    current_status, user.role
                );
                log_blocked_action(&conn, item.id, user.id, &user.role, "approve", &current_status,
                    "status_conflict", &format!("批量 approve：{}", err), &now);
                BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some(err),
                    new_status: None,
                }
            }
        }
        "return" => {
            if opinion.trim().is_empty() {
                let err = "Opinion is required when returning".to_string();
                log_blocked_action(&conn, item.id, user.id, &user.role, "return", &current_status,
                    "opinion_required", "批量退回：意见为空", &now);
                return BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some(err),
                    new_status: None,
                };
            }
            if user.role != "review_supervisor" && user.role != "review_manager" {
                let err = format!(
                    "Only review_supervisor or review_manager can return, got '{}'",
                    user.role
                );
                log_blocked_action(&conn, item.id, user.id, &user.role, "return", &current_status,
                    "role_mismatch", &format!("批量退回：{}", err), &now);
                return BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some(err),
                    new_status: None,
                };
            }
            let allowed = ["submitted", "resubmitted", "under_review", "reviewed"];
            if !allowed.contains(&current_status.as_str()) {
                let err = format!("Cannot return from status '{}'", current_status);
                log_blocked_action(&conn, item.id, user.id, &user.role, "return", &current_status,
                    "status_conflict", &format!("批量退回状态冲突：{}", err), &now);
                return BatchItemResult {
                    id: item.id,
                    success: false,
                    error: Some(err),
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
                        rusqlite::params![item.id, user.id, user.role, "return", opinion.clone(), current_status, "returned", now.clone()],
                    );
                    if brief_st == "missing" || schedule_st == "missing" {
                        let _ = conn.execute(
                            "INSERT INTO exception_reasons (request_id, reason_type, description, reported_by, resolved, created_at) VALUES (?1, ?2, ?3, ?4, 0, ?5)",
                            rusqlite::params![item.id, "return_deficiency", opinion, user.id, now],
                        );
                    } else {
                        log_exception(&conn, item.id, user.id, "return_with_other_reason", &opinion, &now);
                    }
                    log_audit_note(&conn, item.id, user.id, "audit",
                        &format!("批量退回登记员：{}", opinion), &now);
                    BatchItemResult {
                        id: item.id,
                        success: true,
                        error: None,
                        new_status: Some("returned".to_string()),
                    }
                }
                Err(e) => {
                    log_blocked_action(&conn, item.id, user.id, &user.role, "return", &current_status,
                        "db_error", &format!("批量退回数据库错误：{}", e), &now);
                    BatchItemResult {
                        id: item.id,
                        success: false,
                        error: Some(e.to_string()),
                        new_status: None,
                    }
                }
            }
        }
        _ => {
            let err = format!("Unknown action '{}'", item.action);
            log_blocked_action(&conn, item.id, user.id, &user.role, &item.action, &current_status,
                "unknown_action", &err, &now);
            BatchItemResult {
                id: item.id,
                success: false,
                error: Some(err),
                new_status: None,
            }
        }
    }
}
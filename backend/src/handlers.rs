use chrono::Utc;
use poem::handler;
use poem::web::{Data, Json, Path, Query};
use rusqlite::Connection;
use serde::Deserialize;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

use crate::db::*;
use crate::error::AppError;
use crate::middleware::*;
use crate::models::*;

#[derive(Clone)]
pub struct AppState {
    pub conn: Arc<Mutex<Connection>>,
}

fn now_iso() -> String {
    Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

fn status_label(status: &str) -> String {
    match status {
        "pending" => "待处理".to_string(),
        "processing" => "处理中".to_string(),
        "reviewing" => "复核中".to_string(),
        "correction_needed" => "待补正".to_string(),
        "completed" => "已办结".to_string(),
        "withdrawn" => "已撤回".to_string(),
        _ => status.to_string(),
    }
}

fn action_label(action: &str) -> String {
    match action {
        "advance" => "推进".to_string(),
        "return_correction" => "退回补正".to_string(),
        "review_pass" => "复核通过".to_string(),
        "complete" => "办结".to_string(),
        _ => action.to_string(),
    }
}

fn compute_expiry_status(expiry_date: &str) -> String {
    let today = Utc::now().date_naive();
    let expiry = chrono::NaiveDate::parse_from_str(expiry_date, "%Y-%m-%d");
    match expiry {
        Ok(exp) => {
            let diff = (exp - today).num_days();
            if diff <= 0 {
                "overdue".to_string()
            } else if diff <= 7 {
                "expiring_soon".to_string()
            } else {
                "normal".to_string()
            }
        }
        Err(_) => "normal".to_string(),
    }
}

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub status: Option<String>,
    pub expiry_status: Option<String>,
    pub role_queue: Option<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
}

#[handler]
pub async fn login(state: Data<&AppState>, Json(req): Json<LoginRequest>) -> Result<Json<LoginResponse>, AppError> {
    let conn = state.conn.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let user = query_user_by_username(&conn, &req.username)?
        .ok_or(AppError::Unauthorized)?;

    if user.password_hash != req.password {
        return Err(AppError::Unauthorized);
    }

    let token = encode_token(&user.id, &user.role);
    Ok(Json(LoginResponse {
        token,
        role: user.role,
        username: user.username,
    }))
}

#[handler]
pub async fn list_audits(
    state: Data<&AppState>,
    auth: AuthInfo,
    Query(query): Query<ListQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let conn = state.conn.lock().map_err(|e| AppError::Internal(e.to_string()))?;

    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.page_size.unwrap_or(10).max(1).min(100);
    let offset = (page - 1) * page_size;

    let mut where_clauses: Vec<String> = Vec::new();
    let mut param_values: Vec<String> = Vec::new();
    let mut param_idx = 1;

    if let Some(ref status) = query.status {
        where_clauses.push(format!("o.status = ?{}", param_idx));
        param_values.push(status.clone());
        param_idx += 1;
    }

    if let Some(ref role_queue) = query.role_queue {
        match role_queue.as_str() {
            "dispatcher" => {
                where_clauses.push(format!("o.creator_id = ?{}", param_idx));
                param_values.push(auth.user_id.clone());
                param_idx += 1;
            }
            "supervisor" => {
                where_clauses
                    .push("o.status IN ('pending', 'processing', 'correction_needed')".to_string());
            }
            "manager" => {
                where_clauses.push("o.status IN ('reviewing')".to_string());
            }
            _ => {}
        }
    }

    let where_str = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let count_sql = format!("SELECT COUNT(*) FROM audit_orders o {}", where_str);
    let params: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|s| s as &dyn rusqlite::types::ToSql).collect();
    let total: i64 = conn.query_row(&count_sql, params.as_slice(), |row| row.get(0))?;

    let data_sql = format!(
        "SELECT o.id, o.order_no, o.status, o.expiry_date, o.creator_id, o.current_handler_id, o.version, o.created_at, o.updated_at FROM audit_orders o {} ORDER BY o.updated_at DESC LIMIT ?{} OFFSET ?{}",
        where_str, param_idx, param_idx + 1
    );

    let mut all_params: Vec<Box<dyn rusqlite::types::ToSql>> = param_values.into_iter().map(|s| Box::new(s) as Box<dyn rusqlite::types::ToSql>).collect();
    all_params.push(Box::new(page_size));
    all_params.push(Box::new(offset));
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = all_params.iter().map(|p| p.as_ref()).collect();

    let mut stmt = conn.prepare(&data_sql)?;
    let audit_rows: Vec<AuditOrder> = stmt
        .query_map(param_refs.as_slice(), |row| {
            Ok(AuditOrder {
                id: row.get(0)?,
                order_no: row.get(1)?,
                status: row.get(2)?,
                expiry_date: row.get(3)?,
                creator_id: row.get(4)?,
                current_handler_id: row.get(5)?,
                version: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    let mut items_json: Vec<serde_json::Value> = Vec::new();
    for audit in audit_rows {
        if let Some(ref expiry_status) = query.expiry_status {
            let computed = compute_expiry_status(&audit.expiry_date);
            if &computed != expiry_status {
                continue;
            }
        }

        let nanny = query_nanny_profile(&conn, &audit.id).ok().flatten();
        let creator_name = query_user_by_id(&conn, &audit.creator_id)
            .ok()
            .flatten()
            .map(|u| u.display_name);
        let handler_name = audit
            .current_handler_id
            .as_ref()
            .and_then(|hid| query_user_by_id(&conn, hid).ok().flatten())
            .map(|u| u.display_name);

        let expiry_status_val = compute_expiry_status(&audit.expiry_date);

        let mut item = serde_json::to_value(&audit).unwrap_or_default();
        if let Some(obj) = item.as_object_mut() {
            if let Some(np) = nanny {
                let mut np_val = serde_json::to_value(&np).unwrap_or_default();
                if let Some(np_obj) = np_val.as_object_mut() {
                    np_obj.remove("id");
                    np_obj.remove("audit_id");
                }
                obj.insert("nanny_profile".to_string(), np_val);
            } else {
                obj.insert("nanny_profile".into(), serde_json::Value::Null);
            }
            obj.insert("creator_name".into(), serde_json::Value::String(creator_name.unwrap_or_default()));
            obj.insert("current_handler_name".into(), handler_name.map(serde_json::Value::String).unwrap_or(serde_json::Value::Null));
            obj.insert("expiry_status".into(), serde_json::Value::String(expiry_status_val));
        }
        items_json.push(item);
    }

    let filtered_total = if query.expiry_status.is_some() {
        items_json.len() as i64
    } else {
        total
    };

    Ok(Json(serde_json::json!({
        "total": filtered_total,
        "items": items_json,
        "page": page,
        "page_size": page_size,
    })))
}

#[handler]
pub async fn create_audit(
    state: Data<&AppState>,
    auth: AuthInfo,
    Json(req): Json<CreateAuditRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    if auth.role != "dispatcher" {
        return Err(AppError::Forbidden);
    }

    let conn = state.conn.lock().map_err(|e| AppError::Internal(e.to_string()))?;

    let audit_id = Uuid::new_v4().to_string();
    let now = now_iso();
    let short_uuid = &Uuid::new_v4().to_string()[..6];
    let year = &now[..4];
    let order_no = format!("AUD-{}-{}", year, short_uuid);

    conn.execute(
        "INSERT INTO audit_orders (id, order_no, status, expiry_date, creator_id, current_handler_id, version, created_at, updated_at) VALUES (?1, ?2, 'pending', ?3, ?4, NULL, 1, ?5, ?6)",
        rusqlite::params![audit_id, order_no, req.expiry_date, auth.user_id, now, now],
    )?;

    let profile_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO nanny_profiles (id, audit_id, name, id_card, phone, service_type, work_experience) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![profile_id, audit_id, req.nanny_profile.name, req.nanny_profile.id_card, req.nanny_profile.phone, req.nanny_profile.service_type, req.nanny_profile.work_experience],
    )?;

    let log_id = Uuid::new_v4().to_string();
    let operator_name = query_user_by_id(&conn, &auth.user_id)
        .ok()
        .flatten()
        .map(|u| u.display_name)
        .unwrap_or_default();
    conn.execute(
        "INSERT INTO audit_logs (id, audit_id, operator_id, operator_name, operator_role, action, from_status, to_status, comment, exception_reason, created_at) VALUES (?1, ?2, ?3, ?4, ?5, 'create', '', 'pending', '创建审核单', '', ?6)",
        rusqlite::params![log_id, audit_id, auth.user_id, operator_name, auth.role, now],
    )?;

    Ok(Json(serde_json::json!({
        "success": true,
        "id": audit_id,
        "order_no": order_no,
    })))
}

#[handler]
pub async fn get_audit(
    state: Data<&AppState>,
    _auth: AuthInfo,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let conn = state.conn.lock().map_err(|e| AppError::Internal(e.to_string()))?;

    let audit = query_audit_by_id(&conn, &id)?.ok_or(AppError::NotFound("审核单不存在".to_string()))?;
    let nanny = query_nanny_profile(&conn, &id).ok().flatten();
    let qual = query_qualification_review(&conn, &id).ok().flatten();
    let on_duty = query_on_duty_confirmation(&conn, &id).ok().flatten();
    let logs = query_audit_logs(&conn, &id).unwrap_or_default();
    let creator_name = query_user_by_id(&conn, &audit.creator_id)
        .ok()
        .flatten()
        .map(|u| u.display_name);
    let handler_name = audit
        .current_handler_id
        .as_ref()
        .and_then(|hid| query_user_by_id(&conn, hid).ok().flatten())
        .map(|u| u.display_name);

    let mut result = serde_json::to_value(&audit).unwrap_or_default();
    if let Some(obj) = result.as_object_mut() {
        if let Some(np) = nanny {
            let mut np_val = serde_json::to_value(&np).unwrap_or_default();
            if let Some(np_obj) = np_val.as_object_mut() {
                np_obj.remove("id");
                np_obj.remove("audit_id");
            }
            obj.insert("nanny_profile".to_string(), np_val);
        } else {
            obj.insert("nanny_profile".into(), serde_json::Value::Null);
        }
        if let Some(qr_val) = qual {
            let mut qr_json = serde_json::to_value(&qr_val).unwrap_or_default();
            if let Some(qr_obj) = qr_json.as_object_mut() {
                qr_obj.remove("id");
                qr_obj.remove("audit_id");
            }
            obj.insert("qualification_review".to_string(), qr_json);
        } else {
            obj.insert("qualification_review".into(), serde_json::Value::Null);
        }
        if let Some(od_val) = on_duty {
            let mut od_json = serde_json::to_value(&od_val).unwrap_or_default();
            if let Some(od_obj) = od_json.as_object_mut() {
                od_obj.remove("id");
                od_obj.remove("audit_id");
            }
            obj.insert("on_duty_confirmation".to_string(), od_json);
        } else {
            obj.insert("on_duty_confirmation".into(), serde_json::Value::Null);
        }
        obj.insert("audit_logs".to_string(), serde_json::to_value(&logs).unwrap_or_default());
        obj.insert("creator_name".into(), creator_name.map(serde_json::Value::String).unwrap_or(serde_json::Value::Null));
        obj.insert("current_handler_name".into(), handler_name.map(serde_json::Value::String).unwrap_or(serde_json::Value::Null));
    }

    Ok(Json(result))
}

#[handler]
pub async fn process_audit(
    state: Data<&AppState>,
    auth: AuthInfo,
    Path(id): Path<String>,
    Json(req): Json<ProcessAuditRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let conn = state.conn.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    do_process_audit(&conn, &auth, &id, &req)
}

fn do_process_audit(
    conn: &Connection,
    auth: &AuthInfo,
    id: &str,
    req: &ProcessAuditRequest,
) -> Result<Json<serde_json::Value>, AppError> {
    let audit = query_audit_by_id(conn, id)?.ok_or(AppError::NotFound("审核单不存在".to_string()))?;

    if req.version != audit.version {
        return Err(AppError::VersionConflict);
    }

    if let Some(ref handler_id) = audit.current_handler_id {
        if handler_id != &auth.user_id {
            return Err(AppError::NotHandler);
        }
    }

    let new_status;
    let new_handler_id: Option<String>;

    match req.action.as_str() {
        "advance" => {
            if auth.role != "supervisor" {
                return Err(AppError::Forbidden);
            }
            match audit.status.as_str() {
                "pending" => {
                    new_status = "processing".to_string();
                    new_handler_id = Some(auth.user_id.clone());
                }
                "correction_needed" => {
                    new_status = "processing".to_string();
                    new_handler_id = Some(auth.user_id.clone());
                }
                "processing" => {
                    new_status = "reviewing".to_string();
                    new_handler_id = None;
                }
                "reviewing" => {
                    return Err(AppError::InvalidStatusWithReason(format!(
                        "当前状态为复核中，服务督导无法推进，需城市经理处理（{}→{}）",
                        status_label(&audit.status), action_label(&req.action)
                    )));
                }
                "completed" | "withdrawn" => {
                    return Err(AppError::InvalidStatusWithReason(format!(
                        "审核单已{}，无法再{}",
                        status_label(&audit.status), action_label(&req.action)
                    )));
                }
                _ => return Err(AppError::InvalidStatus),
            }
        }
        "return_correction" => {
            if auth.role != "supervisor" && auth.role != "manager" {
                return Err(AppError::Forbidden);
            }
            match audit.status.as_str() {
                "processing" | "reviewing" => {
                    new_status = "correction_needed".to_string();
                    new_handler_id = None;
                }
                "pending" => {
                    return Err(AppError::InvalidStatusWithReason(format!(
                        "当前状态为待处理，无需退回补正，可直接推进"
                    )));
                }
                "correction_needed" => {
                    return Err(AppError::InvalidStatusWithReason(format!(
                        "当前状态已为待补正，无需重复退回"
                    )));
                }
                "completed" | "withdrawn" => {
                    return Err(AppError::InvalidStatusWithReason(format!(
                        "审核单已{}，无法退回补正",
                        status_label(&audit.status)
                    )));
                }
                _ => return Err(AppError::InvalidStatus),
            }
        }
        "review_pass" => {
            if auth.role != "manager" {
                return Err(AppError::Forbidden);
            }
            if audit.status != "reviewing" {
                return Err(AppError::InvalidStatusWithReason(format!(
                    "当前状态为{}，需在复核中才能复核通过",
                    status_label(&audit.status)
                )));
            }
            new_status = "reviewing".to_string();
            new_handler_id = audit.current_handler_id.clone();
        }
        "complete" => {
            if auth.role != "manager" {
                return Err(AppError::Forbidden);
            }
            if audit.status != "reviewing" {
                return Err(AppError::InvalidStatusWithReason(format!(
                    "当前状态为{}，需在复核中才能办结",
                    status_label(&audit.status)
                )));
            }
            new_status = "completed".to_string();
            new_handler_id = None;
        }
        _ => return Err(AppError::BadRequest("未知操作".to_string())),
    }

    let now = now_iso();
    let new_version = audit.version + 1;

    if let Some(ref np) = req.nanny_profile {
        conn.execute(
            "UPDATE nanny_profiles SET name = ?1, id_card = ?2, phone = ?3, service_type = ?4, work_experience = ?5 WHERE audit_id = ?6",
            rusqlite::params![np.name, np.id_card, np.phone, np.service_type, np.work_experience, id],
        )?;
    }

    if let Some(ref qr) = req.qualification_review {
        let existing = query_qualification_review(conn, id).ok().flatten();
        if existing.is_some() {
            update_qualification_review(conn, id, qr)?;
        } else {
            insert_qualification_review(conn, id, qr)?;
        }
    }

    if let Some(ref od) = req.on_duty_confirmation {
        let existing = query_on_duty_confirmation(conn, id).ok().flatten();
        if existing.is_some() {
            update_on_duty_confirmation(conn, id, od)?;
        } else {
            insert_on_duty_confirmation(conn, id, od)?;
        }
    }

    if req.action == "complete" {
        let missing = check_completion_evidence(conn, id);
        if !missing.is_empty() {
            return Err(AppError::MissingEvidence(missing.join(", ")));
        }
    }

    conn.execute(
        "UPDATE audit_orders SET status = ?1, current_handler_id = ?2, version = ?3, updated_at = ?4 WHERE id = ?5",
        rusqlite::params![new_status, new_handler_id, new_version, now, id],
    )?;

    let log_id = Uuid::new_v4().to_string();
    let comment = req.comment.clone().unwrap_or_default();
    let exception_reason = req.exception_reason.clone().unwrap_or_default();
    let operator_name = query_user_by_id(conn, &auth.user_id)
        .ok()
        .flatten()
        .map(|u| u.display_name)
        .unwrap_or_default();
    conn.execute(
        "INSERT INTO audit_logs (id, audit_id, operator_id, operator_name, operator_role, action, from_status, to_status, comment, exception_reason, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![log_id, id, auth.user_id, operator_name, auth.role, req.action, audit.status, new_status, comment, exception_reason, now],
    )?;

    Ok(Json(serde_json::json!({
        "success": true,
        "id": id,
        "status": new_status,
        "version": new_version,
    })))
}

fn check_completion_evidence(conn: &Connection, id: &str) -> Vec<String> {
    let mut missing: Vec<String> = Vec::new();
    let nanny = query_nanny_profile(conn, id).ok().flatten();
    if let Some(ref np) = nanny {
        if np.name.is_empty() {
            missing.push("nanny_profile.name".to_string());
        }
        if np.id_card.is_empty() {
            missing.push("nanny_profile.id_card".to_string());
        }
        if np.phone.is_empty() {
            missing.push("nanny_profile.phone".to_string());
        }
    } else {
        missing.push("nanny_profile".to_string());
    }
    let qual = query_qualification_review(conn, id).ok().flatten();
    if let Some(ref qr) = qual {
        if qr.health_cert.is_empty() {
            missing.push("qualification_review.health_cert".to_string());
        }
        if qr.training_cert.is_empty() {
            missing.push("qualification_review.training_cert".to_string());
        }
    } else {
        missing.push("qualification_review".to_string());
    }
    let on_duty = query_on_duty_confirmation(conn, id).ok().flatten();
    if let Some(ref od) = on_duty {
        if od.on_duty_date.is_empty() {
            missing.push("on_duty_confirmation.on_duty_date".to_string());
        }
        if od.service_area.is_empty() {
            missing.push("on_duty_confirmation.service_area".to_string());
        }
    } else {
        missing.push("on_duty_confirmation".to_string());
    }
    missing
}

fn update_qualification_review(conn: &Connection, audit_id: &str, qr: &QualificationReviewInput) -> Result<(), AppError> {
    conn.execute(
        "UPDATE qualification_reviews SET health_cert = COALESCE(?1, health_cert), health_cert_expiry = COALESCE(?2, health_cert_expiry), training_cert = COALESCE(?3, training_cert), training_cert_expiry = COALESCE(?4, training_cert_expiry), background_check = COALESCE(?5, background_check), background_check_result = COALESCE(?6, background_check_result) WHERE audit_id = ?7",
        rusqlite::params![qr.health_cert, qr.health_cert_expiry, qr.training_cert, qr.training_cert_expiry, qr.background_check, qr.background_check_result, audit_id],
    )?;
    Ok(())
}

fn insert_qualification_review(conn: &Connection, audit_id: &str, qr: &QualificationReviewInput) -> Result<(), AppError> {
    let qr_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO qualification_reviews (id, audit_id, health_cert, health_cert_expiry, training_cert, training_cert_expiry, background_check, background_check_result) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![qr_id, audit_id, qr.health_cert.as_deref().unwrap_or(""), qr.health_cert_expiry.as_deref().unwrap_or(""), qr.training_cert.as_deref().unwrap_or(""), qr.training_cert_expiry.as_deref().unwrap_or(""), qr.background_check.as_deref().unwrap_or(""), qr.background_check_result.as_deref().unwrap_or("")],
    )?;
    Ok(())
}

fn update_on_duty_confirmation(conn: &Connection, audit_id: &str, od: &OnDutyConfirmationInput) -> Result<(), AppError> {
    conn.execute(
        "UPDATE on_duty_confirmations SET on_duty_date = COALESCE(?1, on_duty_date), service_area = COALESCE(?2, service_area), contract_no = COALESCE(?3, contract_no), confirmation_status = COALESCE(?4, confirmation_status) WHERE audit_id = ?5",
        rusqlite::params![od.on_duty_date, od.service_area, od.contract_no, od.confirmation_status, audit_id],
    )?;
    Ok(())
}

fn insert_on_duty_confirmation(conn: &Connection, audit_id: &str, od: &OnDutyConfirmationInput) -> Result<(), AppError> {
    let od_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO on_duty_confirmations (id, audit_id, on_duty_date, service_area, contract_no, confirmation_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![od_id, audit_id, od.on_duty_date.as_deref().unwrap_or(""), od.service_area.as_deref().unwrap_or(""), od.contract_no.as_deref().unwrap_or(""), od.confirmation_status.as_deref().unwrap_or("")],
    )?;
    Ok(())
}

#[handler]
pub async fn withdraw_audit(
    state: Data<&AppState>,
    auth: AuthInfo,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    if auth.role != "dispatcher" {
        return Err(AppError::Forbidden);
    }

    let conn = state.conn.lock().map_err(|e| AppError::Internal(e.to_string()))?;

    let audit = query_audit_by_id(&conn, &id)?.ok_or(AppError::NotFound("审核单不存在".to_string()))?;

    if audit.status != "pending" {
        return Err(AppError::InvalidStatus);
    }
    if audit.creator_id != auth.user_id {
        return Err(AppError::Forbidden);
    }

    let now = now_iso();
    let new_version = audit.version + 1;

    conn.execute(
        "UPDATE audit_orders SET status = 'withdrawn', version = ?1, updated_at = ?2, current_handler_id = NULL WHERE id = ?3",
        rusqlite::params![new_version, now, id],
    )?;

    let log_id = Uuid::new_v4().to_string();
    let operator_name = query_user_by_id(&conn, &auth.user_id)
        .ok()
        .flatten()
        .map(|u| u.display_name)
        .unwrap_or_default();
    conn.execute(
        "INSERT INTO audit_logs (id, audit_id, operator_id, operator_name, operator_role, action, from_status, to_status, comment, exception_reason, created_at) VALUES (?1, ?2, ?3, ?4, ?5, 'withdraw', 'pending', 'withdrawn', '撤回审核单', '', ?6)",
        rusqlite::params![log_id, id, auth.user_id, operator_name, auth.role, now],
    )?;

    Ok(Json(serde_json::json!({
        "success": true,
        "id": id,
        "status": "withdrawn",
        "version": new_version,
    })))
}

#[handler]
pub async fn batch_process(
    state: Data<&AppState>,
    auth: AuthInfo,
    Json(req): Json<BatchProcessRequest>,
) -> Result<Json<BatchProcessResponse>, AppError> {
    let total = req.audit_ids.len() as i64;
    let mut success_count: i64 = 0;
    let mut fail_count: i64 = 0;
    let mut results: Vec<BatchProcessResultItem> = Vec::new();

    let conn = state.conn.lock().map_err(|e| AppError::Internal(e.to_string()))?;

    for audit_id in &req.audit_ids {
        let audit = match query_audit_by_id(&conn, audit_id) {
            Ok(Some(a)) => a,
            _ => {
                fail_count += 1;
                results.push(BatchProcessResultItem {
                    audit_id: audit_id.clone(),
                    order_no: String::new(),
                    success: false,
                    error_code: Some("ERR_NOT_FOUND".to_string()),
                    error_message: Some("审核单不存在".to_string()),
                });
                continue;
            }
        };

        let process_req = ProcessAuditRequest {
            action: req.action.clone(),
            comment: req.comment.clone(),
            exception_reason: req.exception_reason.clone(),
            version: audit.version,
            nanny_profile: None,
            qualification_review: None,
            on_duty_confirmation: None,
        };

        match do_process_audit(&conn, &auth, audit_id, &process_req) {
            Ok(_) => {
                success_count += 1;
                results.push(BatchProcessResultItem {
                    audit_id: audit_id.clone(),
                    order_no: audit.order_no,
                    success: true,
                    error_code: None,
                    error_message: None,
                });
            }
            Err(e) => {
                fail_count += 1;
                results.push(BatchProcessResultItem {
                    audit_id: audit_id.clone(),
                    order_no: audit.order_no,
                    success: false,
                    error_code: Some(e.error_code().to_string()),
                    error_message: Some(e.to_string()),
                });
            }
        }
    }

    Ok(Json(BatchProcessResponse {
        total,
        success_count,
        fail_count,
        results,
    }))
}

#[handler]
pub async fn expiry_dashboard(
    state: Data<&AppState>,
    _auth: AuthInfo,
) -> Result<Json<serde_json::Value>, AppError> {
    let conn = state.conn.lock().map_err(|e| AppError::Internal(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, order_no, status, expiry_date, creator_id, current_handler_id, version, created_at, updated_at FROM audit_orders WHERE status != 'withdrawn' AND status != 'completed' ORDER BY expiry_date ASC"
    )?;
    let audits: Vec<AuditOrder> = stmt
        .query_map([], |row| {
            Ok(AuditOrder {
                id: row.get(0)?,
                order_no: row.get(1)?,
                status: row.get(2)?,
                expiry_date: row.get(3)?,
                creator_id: row.get(4)?,
                current_handler_id: row.get(5)?,
                version: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    let mut normal: Vec<serde_json::Value> = Vec::new();
    let mut expiring_soon: Vec<serde_json::Value> = Vec::new();
    let mut overdue: Vec<serde_json::Value> = Vec::new();

    for audit in audits {
        let nanny = query_nanny_profile(&conn, &audit.id).ok().flatten();
        let creator = query_user_by_id(&conn, &audit.creator_id).ok().flatten();
        let creator_name = creator.as_ref().map(|u| u.display_name.clone()).unwrap_or_default();
        let handler_name = audit
            .current_handler_id
            .as_ref()
            .and_then(|hid| query_user_by_id(&conn, hid).ok().flatten())
            .map(|u| u.display_name);

        let responsible_name = match audit.status.as_str() {
            "pending" => creator_name.clone(),
            "processing" | "correction_needed" => handler_name.clone().unwrap_or_else(|| "服务督导".to_string()),
            "reviewing" => handler_name.clone().unwrap_or_else(|| "城市经理".to_string()),
            _ => creator_name.clone(),
        };

        let expiry_status = compute_expiry_status(&audit.expiry_date);

        let mut item = serde_json::to_value(&audit).unwrap_or_default();
        if let Some(obj) = item.as_object_mut() {
            if let Some(np) = nanny {
                let mut np_val = serde_json::to_value(&np).unwrap_or_default();
                if let Some(np_obj) = np_val.as_object_mut() {
                    np_obj.remove("id");
                    np_obj.remove("audit_id");
                }
                obj.insert("nanny_profile".to_string(), np_val);
            } else {
                obj.insert("nanny_profile".into(), serde_json::Value::Null);
            }
            obj.insert("creator_name".into(), serde_json::Value::String(creator_name));
            obj.insert("current_handler_name".into(), handler_name.map(serde_json::Value::String).unwrap_or(serde_json::Value::Null));
            obj.insert("responsible_name".into(), serde_json::Value::String(responsible_name));
            obj.insert("expiry_status".into(), serde_json::Value::String(expiry_status.clone()));
        }

        match expiry_status.as_str() {
            "overdue" => overdue.push(item),
            "expiring_soon" => expiring_soon.push(item),
            _ => normal.push(item),
        }
    }

    Ok(Json(serde_json::json!({
        "normal": normal,
        "expiring_soon": expiring_soon,
        "overdue": overdue,
    })))
}

#[handler]
pub async fn dashboard_stats(
    state: Data<&AppState>,
    _auth: AuthInfo,
) -> Result<Json<DashboardStats>, AppError> {
    let conn = state.conn.lock().map_err(|e| AppError::Internal(e.to_string()))?;

    let pending_count: i64 = conn.query_row("SELECT COUNT(*) FROM audit_orders WHERE status = 'pending'", [], |r| r.get(0))?;
    let processing_count: i64 = conn.query_row("SELECT COUNT(*) FROM audit_orders WHERE status = 'processing'", [], |r| r.get(0))?;
    let reviewing_count: i64 = conn.query_row("SELECT COUNT(*) FROM audit_orders WHERE status = 'reviewing'", [], |r| r.get(0))?;
    let correction_needed_count: i64 = conn.query_row("SELECT COUNT(*) FROM audit_orders WHERE status = 'correction_needed'", [], |r| r.get(0))?;
    let completed_count: i64 = conn.query_row("SELECT COUNT(*) FROM audit_orders WHERE status = 'completed'", [], |r| r.get(0))?;

    let mut overdue_count: i64 = 0;
    let mut expiring_soon_count: i64 = 0;

    let mut stmt = conn.prepare(
        "SELECT expiry_date FROM audit_orders WHERE status NOT IN ('withdrawn', 'completed')"
    )?;
    let expiry_dates: Vec<String> = stmt.query_map([], |row| row.get(0))?.filter_map(|r| r.ok()).collect();
    for ed in expiry_dates {
        match compute_expiry_status(&ed).as_str() {
            "overdue" => overdue_count += 1,
            "expiring_soon" => expiring_soon_count += 1,
            _ => {}
        }
    }

    Ok(Json(DashboardStats {
        pending_count,
        processing_count,
        reviewing_count,
        correction_needed_count,
        completed_count,
        overdue_count,
        expiring_soon_count,
    }))
}

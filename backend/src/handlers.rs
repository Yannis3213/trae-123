use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

use poem::web::{Data, Json, Path, Query};
use serde::{Deserialize, Serialize};

use crate::db::Db;
use crate::error::AppError;
use crate::models::*;
use crate::validators::*;

pub struct DedupState {
    pub last_action: Mutex<HashMap<String, Instant>>,
}

pub fn new_dedup_state() -> DedupState {
    DedupState {
        last_action: Mutex::new(HashMap::new()),
    }
}

fn check_dedup(dedup: &DedupState, key: &str) -> Result<(), AppError> {
    let mut map = dedup.last_action.lock().unwrap();
    let now = Instant::now();
    if let Some(last) = map.get(key) {
        if now.duration_since(*last).as_secs() < 5 {
            return Err(AppError::Conflict("操作过于频繁，请5秒后重试".to_string()));
        }
    }
    map.insert(key.to_string(), now);
    Ok(())
}

fn query_inspection(conn: &rusqlite::Connection, id: &str) -> Result<Inspection, AppError> {
    conn.query_row(
        "SELECT id, pond_id, pond_name, inspector, inspector_role, status, current_handler, current_handler_role, deadline, version, created_at, updated_at FROM inspection WHERE id = ?1",
        [id],
        |r| Ok(Inspection {
            id: r.get(0)?,
            pond_id: r.get(1)?,
            pond_name: r.get(2)?,
            inspector: r.get(3)?,
            inspector_role: r.get(4)?,
            status: r.get(5)?,
            current_handler: r.get(6)?,
            current_handler_role: r.get(7)?,
            deadline: r.get(8)?,
            version: r.get(9)?,
            created_at: r.get(10)?,
            updated_at: r.get(11)?,
        }),
    ).map_err(|_| AppError::NotFound(format!("检测单 {} 不存在", id)))
}

fn query_indicators(conn: &rusqlite::Connection, inspection_id: &str) -> Result<Vec<TestIndicator>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, inspection_id, name, value, unit, standard, is_qualified FROM test_indicator WHERE inspection_id = ?1"
    )?;
    let rows = stmt.query_map([inspection_id], |r| Ok(TestIndicator {
        id: r.get(0)?,
        inspection_id: r.get(1)?,
        name: r.get(2)?,
        value: r.get(3)?,
        unit: r.get(4)?,
        standard: r.get(5)?,
        is_qualified: r.get::<_, i32>(6)? != 0,
    }))?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

fn query_attachments(conn: &rusqlite::Connection, inspection_id: &str) -> Result<Vec<Attachment>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, inspection_id, filename, file_type, file_size, uploaded_by, uploaded_at FROM attachment WHERE inspection_id = ?1"
    )?;
    let rows = stmt.query_map([inspection_id], |r| Ok(Attachment {
        id: r.get(0)?,
        inspection_id: r.get(1)?,
        filename: r.get(2)?,
        file_type: r.get(3)?,
        file_size: r.get(4)?,
        uploaded_by: r.get(5)?,
        uploaded_at: r.get(6)?,
    }))?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

fn query_audit_records(conn: &rusqlite::Connection, inspection_id: &str) -> Result<Vec<AuditRecord>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, inspection_id, action, operator, operator_role, comment, created_at FROM audit_record WHERE inspection_id = ?1 ORDER BY created_at"
    )?;
    let rows = stmt.query_map([inspection_id], |r| Ok(AuditRecord {
        id: r.get(0)?,
        inspection_id: r.get(1)?,
        action: r.get(2)?,
        operator: r.get(3)?,
        operator_role: r.get(4)?,
        comment: r.get(5)?,
        created_at: r.get(6)?,
    }))?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

fn query_exception_reasons(conn: &rusqlite::Connection, inspection_id: &str) -> Result<Vec<ExceptionReason>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, inspection_id, audit_record_id, reason, created_at FROM exception_reason WHERE inspection_id = ?1 ORDER BY created_at"
    )?;
    let rows = stmt.query_map([inspection_id], |r| Ok(ExceptionReason {
        id: r.get(0)?,
        inspection_id: r.get(1)?,
        audit_record_id: r.get(2)?,
        reason: r.get(3)?,
        created_at: r.get(4)?,
    }))?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

fn query_attachment_count(conn: &rusqlite::Connection, inspection_id: &str) -> Result<usize, AppError> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM attachment WHERE inspection_id = ?1",
        [inspection_id],
        |r| r.get(0),
    )?;
    Ok(count as usize)
}

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub status: Option<String>,
    pub pond_id: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub role: Option<String>,
    pub overdue_type: Option<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
}

pub async fn list_inspections(
    Data(db): Data<&Db>,
    Query(params): Query<ListQuery>,
) -> Result<Json<ApiResponse<InspectionListResponse>>, AppError> {
    let conn = db.0.lock().unwrap();
    let page = params.page.unwrap_or(1).max(1);
    let page_size = params.page_size.unwrap_or(10).max(1).min(100);
    let offset = (page - 1) * page_size;

    let mut where_clauses = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(ref s) = params.status {
        where_clauses.push(format!("status = ?{}", idx));
        param_values.push(Box::new(s.clone()));
        idx += 1;
    }
    if let Some(ref p) = params.pond_id {
        where_clauses.push(format!("pond_id = ?{}", idx));
        param_values.push(Box::new(p.clone()));
        idx += 1;
    }
    if let Some(ref d) = params.date_from {
        where_clauses.push(format!("created_at >= ?{}", idx));
        param_values.push(Box::new(d.clone()));
        idx += 1;
    }
    if let Some(ref d) = params.date_to {
        where_clauses.push(format!("created_at <= ?{}", idx));
        param_values.push(Box::new(d.clone()));
        idx += 1;
    }

    let where_str = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let count_sql = format!("SELECT COUNT(*) FROM inspection {}", where_str);
    let total: i64 = conn.query_row(&count_sql, rusqlite::params_from_iter(param_values.iter().map(|p| p.as_ref())), |r| r.get(0))?;

    let query_sql = format!(
        "SELECT id, pond_id, pond_name, inspector, inspector_role, status, current_handler, current_handler_role, deadline, version, created_at, updated_at FROM inspection {} ORDER BY created_at DESC LIMIT ?{} OFFSET ?{}",
        where_str, idx, idx + 1
    );
    param_values.push(Box::new(page_size));
    param_values.push(Box::new(offset));

    let mut stmt = conn.prepare(&query_sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(param_values.iter().map(|p| p.as_ref())), |r| Ok(Inspection {
        id: r.get(0)?,
        pond_id: r.get(1)?,
        pond_name: r.get(2)?,
        inspector: r.get(3)?,
        inspector_role: r.get(4)?,
        status: r.get(5)?,
        current_handler: r.get(6)?,
        current_handler_role: r.get(7)?,
        deadline: r.get(8)?,
        version: r.get(9)?,
        created_at: r.get(10)?,
        updated_at: r.get(11)?,
    }))?;

    let mut items = Vec::new();
    for row in rows {
        let ins = row?;
        if let Some(ref ot) = params.overdue_type {
            let computed = compute_overdue_type(&ins.deadline);
            if computed.as_str() != ot.as_str() {
                continue;
            }
        }
        if let Some(ref role) = params.role {
            if ins.current_handler_role != *role {
                continue;
            }
        }
        items.push(ins);
    }

    let total_pages = (total as f64 / page_size as f64).ceil() as i64;

    Ok(Json(ApiResponse::ok(InspectionListResponse {
        items,
        pagination: Pagination {
            page,
            page_size,
            total,
            total_pages,
        },
    })))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InspectionDetail {
    pub inspection: Inspection,
    pub indicators: Vec<TestIndicator>,
    pub attachments: Vec<Attachment>,
    pub audit_trail: Vec<AuditRecord>,
    pub exception_reasons: Vec<ExceptionReason>,
    pub process_flow: Vec<ProcessNode>,
    pub overdue_type: String,
}

pub async fn get_inspection(
    Data(db): Data<&Db>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<InspectionDetail>>, AppError> {
    let conn = db.0.lock().unwrap();
    let ins = query_inspection(&conn, &id)?;
    let indicators = query_indicators(&conn, &id)?;
    let attachments = query_attachments(&conn, &id)?;
    let audit_trail = query_audit_records(&conn, &id)?;
    let exception_reasons = query_exception_reasons(&conn, &id)?;
    let process_flow = build_process_flow(&ins, &audit_trail);
    let overdue_type = compute_overdue_type(&ins.deadline);

    Ok(Json(ApiResponse::ok(InspectionDetail {
        inspection: ins,
        indicators,
        attachments,
        audit_trail,
        exception_reasons,
        process_flow,
        overdue_type: overdue_type.as_str().to_string(),
    })))
}

pub async fn create_inspection(
    Data(db): Data<&Db>,
    Data(dedup): Data<&DedupState>,
    Json(req): Json<CreateInspectionRequest>,
) -> Result<Json<ApiResponse<Inspection>>, AppError> {
    let action = Action::Submit;

    validate_role_action(&req.inspector_role, &action)?;

    if req.attachments.is_empty() {
        return Err(AppError::Validation("登记时必须至少上传1个附件作为证据".to_string()));
    }
    if req.indicators.is_empty() {
        return Err(AppError::Validation("登记时必须填写至少1个检测指标".to_string()));
    }
    if req.pond_id.trim().is_empty() || req.pond_name.trim().is_empty() {
        return Err(AppError::Validation("塘口信息不能为空".to_string()));
    }
    if req.deadline.trim().is_empty() {
        return Err(AppError::Validation("截止日期不能为空".to_string()));
    }

    let dedup_key = format!("create:{}:{}", req.inspector, req.pond_id);
    check_dedup(&dedup, &dedup_key)?;

    let conn = db.0.lock().unwrap();
    let id = format!("ins-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap());
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let initial_version = 1;

    let initial_status = "pending_review";
    let initial_handler_name = "李工";
    let initial_handler_role = "quality_engineer";

    conn.execute(
        "INSERT INTO inspection (id, pond_id, pond_name, inspector, inspector_role, status, current_handler, current_handler_role, deadline, version, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
        rusqlite::params![
            id, req.pond_id, req.pond_name, req.inspector, req.inspector_role,
            initial_status, initial_handler_name, initial_handler_role,
            req.deadline, initial_version, now, now
        ],
    )?;

    for ind in &req.indicators {
        let ind_id = format!("ind-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap());
        conn.execute(
            "INSERT INTO test_indicator (id, inspection_id, name, value, unit, standard, is_qualified) VALUES (?1,?2,?3,?4,?5,?6,?7)",
            rusqlite::params![ind_id, id, ind.name, ind.value, ind.unit, ind.standard, ind.is_qualified as i32],
        )?;
    }

    for att in &req.attachments {
        let att_id = format!("att-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap());
        conn.execute(
            "INSERT INTO attachment (id, inspection_id, filename, file_type, file_size, uploaded_by, uploaded_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",
            rusqlite::params![att_id, id, att.filename, att.file_type, att.file_size, req.inspector, now],
        )?;
    }

    let audit_id = format!("aud-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap());
    let audit_comment = req.comment.clone().unwrap_or_default();
    conn.execute(
        "INSERT INTO audit_record (id, inspection_id, action, operator, operator_role, comment, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        rusqlite::params![audit_id, id, action.as_str(), req.inspector, req.inspector_role, audit_comment, now],
    )?;

    let ins = query_inspection(&conn, &id)?;
    Ok(Json(ApiResponse::ok(ins)))
}

pub async fn process_inspection(
    Data(db): Data<&Db>,
    Data(dedup): Data<&DedupState>,
    Path(id): Path<String>,
    Json(req): Json<ProcessRequest>,
) -> Result<Json<ApiResponse<Inspection>>, AppError> {
    let action = Action::from_str(&req.action)
        .ok_or_else(|| AppError::Validation(format!("无效操作: {}", req.action)))?;

    validate_role_action(&req.operator_role, &action)?;

    let dedup_key = format!("{}:{}:{}", id, req.operator, req.action);
    check_dedup(&dedup, &dedup_key)?;

    let conn = db.0.lock().unwrap();
    let ins = query_inspection(&conn, &id)?;

    validate_current_handler_role(&ins.current_handler_role, &action, &req.operator_role)?;
    validate_version(ins.version, req.version)?;

    let attachment_count = match &req.attachments {
        Some(att) => att.len(),
        None => query_attachment_count(&conn, &id)?,
    };
    validate_evidence_required(&action, attachment_count)?;
    validate_reject_requires_reason(&action, req.exception_reason.as_deref())?;

    let new_status = validate_status_transition(&ins.status, &action)?;

    let (next_handler_name, next_handler_role) = get_next_handler(&action);

    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let new_version = ins.version + 1;

    conn.execute(
        "UPDATE inspection SET status = ?1, current_handler = ?2, current_handler_role = ?3, version = ?4, updated_at = ?5 WHERE id = ?6",
        rusqlite::params![new_status, next_handler_name, next_handler_role, new_version, now, id],
    )?;

    if let Some(ref attachments) = req.attachments {
        for att in attachments {
            let att_id = format!("att-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap());
            conn.execute(
                "INSERT INTO attachment (id, inspection_id, filename, file_type, file_size, uploaded_by, uploaded_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",
                rusqlite::params![att_id, id, att.filename, att.file_type, att.file_size, req.operator, now],
            )?;
        }
    }

    let audit_id = format!("aud-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap());
    conn.execute(
        "INSERT INTO audit_record (id, inspection_id, action, operator, operator_role, comment, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        rusqlite::params![audit_id, id, req.action, req.operator, req.operator_role, req.comment, now],
    )?;

    if matches!(action, Action::Reject) {
        if let Some(ref reason) = req.exception_reason {
            let exc_id = format!("exc-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap());
            conn.execute(
                "INSERT INTO exception_reason (id, inspection_id, audit_record_id, reason, created_at) VALUES (?1,?2,?3,?4,?5)",
                rusqlite::params![exc_id, id, audit_id, reason, now],
            )?;
        }
    }

    let updated = query_inspection(&conn, &id)?;
    Ok(Json(ApiResponse::ok(updated)))
}

pub async fn batch_process(
    Data(db): Data<&Db>,
    Data(dedup): Data<&DedupState>,
    Json(req): Json<BatchProcessRequest>,
) -> Result<Json<ApiResponse<Vec<BatchResult>>>, AppError> {
    let action = Action::from_str(&req.action)
        .ok_or_else(|| AppError::Validation(format!("无效操作: {}", req.action)))?;

    validate_role_action(&req.operator_role, &action)?;
    validate_reject_requires_reason(&action, req.exception_reason.as_deref())?;

    let mut results = Vec::new();

    for item in &req.items {
        let result = process_single_batch(&db, &dedup, item, &action, &req);
        results.push(result);
    }

    Ok(Json(ApiResponse::ok(results)))
}

fn process_single_batch(db: &Db, dedup: &DedupState, item: &BatchItem, action: &Action, req: &BatchProcessRequest) -> BatchResult {
    let dedup_key = format!("{}:{}:{}", item.id, req.operator, req.action);
    if let Err(e) = check_dedup(dedup, &dedup_key) {
        return BatchResult {
            id: item.id.clone(),
            success: false,
            message: Some(e.message()),
        };
    }

    let conn = match db.0.lock() {
        Ok(c) => c,
        Err(e) => return BatchResult {
            id: item.id.clone(),
            success: false,
            message: Some(e.to_string()),
        },
    };

    let ins = match query_inspection(&conn, &item.id) {
        Ok(i) => i,
        Err(e) => return BatchResult {
            id: item.id.clone(),
            success: false,
            message: Some(e.message()),
        },
    };

    if let Err(e) = validate_current_handler_role(&ins.current_handler_role, action, &req.operator_role) {
        return BatchResult {
            id: item.id.clone(),
            success: false,
            message: Some(e.message()),
        };
    }

    if let Err(e) = validate_version(ins.version, item.version) {
        return BatchResult {
            id: item.id.clone(),
            success: false,
            message: Some(e.message()),
        };
    }

    let new_status = match validate_status_transition(&ins.status, action) {
        Ok(s) => s,
        Err(e) => return BatchResult {
            id: item.id.clone(),
            success: false,
            message: Some(e.message()),
        },
    };

    if matches!(action, Action::Submit | Action::Correct) {
        let attachment_count = if matches!(action, Action::Correct) {
            match &req.attachments {
                Some(att) => att.len(),
                None => {
                    match conn.query_row(
                        "SELECT COUNT(*) FROM attachment WHERE inspection_id = ?1",
                        [&item.id],
                        |r| r.get::<_, i64>(0),
                    ) {
                        Ok(c) => c as usize,
                        Err(e) => return BatchResult {
                            id: item.id.clone(),
                            success: false,
                            message: Some(format!("附件校验失败: {}", e)),
                        },
                    }
                }
            }
        } else {
            match conn.query_row(
                "SELECT COUNT(*) FROM attachment WHERE inspection_id = ?1",
                [&item.id],
                |r| r.get::<_, i64>(0),
            ) {
                Ok(c) => c as usize,
                Err(e) => return BatchResult {
                    id: item.id.clone(),
                    success: false,
                    message: Some(format!("附件校验失败: {}", e)),
                },
            }
        };
        if let Err(e) = validate_evidence_required(action, attachment_count) {
            return BatchResult {
                id: item.id.clone(),
                success: false,
                message: Some(e.message()),
            };
        }
    }

    let (next_handler_name, next_handler_role) = get_next_handler(action);

    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let new_version = ins.version + 1;

    if let Err(e) = conn.execute(
        "UPDATE inspection SET status = ?1, current_handler = ?2, current_handler_role = ?3, version = ?4, updated_at = ?5 WHERE id = ?6",
        rusqlite::params![new_status, next_handler_name, next_handler_role, new_version, now, item.id],
    ) {
        return BatchResult {
            id: item.id.clone(),
            success: false,
            message: Some(e.to_string()),
        };
    }

    let audit_id = format!("aud-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap());
    if let Err(e) = conn.execute(
        "INSERT INTO audit_record (id, inspection_id, action, operator, operator_role, comment, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        rusqlite::params![audit_id, item.id, action.as_str(), req.operator, req.operator_role, req.comment, now],
    ) {
        return BatchResult {
            id: item.id.clone(),
            success: false,
            message: Some(e.to_string()),
        };
    }

    if matches!(action, Action::Reject) {
        if let Some(ref reason) = req.exception_reason {
            let exc_id = format!("exc-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap());
            let _ = conn.execute(
                "INSERT INTO exception_reason (id, inspection_id, audit_record_id, reason, created_at) VALUES (?1,?2,?3,?4,?5)",
                rusqlite::params![exc_id, item.id, audit_id, reason, now],
            );
        }
    }

    if matches!(action, Action::Correct) {
        if let Some(ref attachments) = req.attachments {
            for att in attachments {
                let att_id = format!("att-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap());
                let _ = conn.execute(
                    "INSERT INTO attachment (id, inspection_id, filename, file_type, file_size, uploaded_by, uploaded_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",
                    rusqlite::params![att_id, item.id, att.filename, att.file_type, att.file_size, req.operator, now],
                );
            }
        }
    }

    BatchResult {
        id: item.id.clone(),
        success: true,
        message: None,
    }
}

pub async fn get_audit_trail(
    Data(db): Data<&Db>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Vec<AuditRecord>>>, AppError> {
    let conn = db.0.lock().unwrap();
    let records = query_audit_records(&conn, &id)?;
    Ok(Json(ApiResponse::ok(records)))
}

#[derive(Debug, Deserialize)]
pub struct UploadAttachmentRequest {
    pub filename: String,
    pub file_type: String,
    pub file_size: i64,
    pub uploaded_by: String,
}

pub async fn upload_attachment(
    Data(db): Data<&Db>,
    Path(id): Path<String>,
    Json(req): Json<UploadAttachmentRequest>,
) -> Result<Json<ApiResponse<Attachment>>, AppError> {
    let conn = db.0.lock().unwrap();
    let _ = query_inspection(&conn, &id)?;

    let att_id = format!("att-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap());
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO attachment (id, inspection_id, filename, file_type, file_size, uploaded_by, uploaded_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        rusqlite::params![att_id, id, req.filename, req.file_type, req.file_size, req.uploaded_by, now],
    )?;

    let attachment = Attachment {
        id: att_id,
        inspection_id: id,
        filename: req.filename,
        file_type: req.file_type,
        file_size: req.file_size,
        uploaded_by: req.uploaded_by,
        uploaded_at: now,
    };

    Ok(Json(ApiResponse::ok(attachment)))
}

#[derive(Debug, Deserialize)]
pub struct StatsQuery {
    pub role: Option<String>,
}

pub async fn get_stats(
    Data(db): Data<&Db>,
    Query(params): Query<StatsQuery>,
) -> Result<Json<ApiResponse<Stats>>, AppError> {
    let conn = db.0.lock().unwrap();

    let role_filter = params.role.as_deref().unwrap_or("");

    let count_sql = |status: &str| -> String {
        if role_filter.is_empty() {
            format!("SELECT COUNT(*) FROM inspection WHERE status = '{}'", status)
        } else {
            format!("SELECT COUNT(*) FROM inspection WHERE status = '{}' AND current_handler_role = ?", status)
        }
    };

    let total: i64 = if role_filter.is_empty() {
        conn.query_row("SELECT COUNT(*) FROM inspection", [], |r| r.get(0))?
    } else {
        conn.query_row("SELECT COUNT(*) FROM inspection WHERE current_handler_role = ?1", [role_filter], |r| r.get(0))?
    };

    let pending_review: i64 = if role_filter.is_empty() {
        conn.query_row(&count_sql("pending_review"), [], |r| r.get(0))?
    } else {
        conn.query_row(&count_sql("pending_review"), [role_filter], |r| r.get(0))?
    };

    let under_review: i64 = if role_filter.is_empty() {
        conn.query_row(&count_sql("under_review"), [], |r| r.get(0))?
    } else {
        conn.query_row(&count_sql("under_review"), [role_filter], |r| r.get(0))?
    };

    let approved: i64 = if role_filter.is_empty() {
        conn.query_row(&count_sql("approved"), [], |r| r.get(0))?
    } else {
        conn.query_row(&count_sql("approved"), [role_filter], |r| r.get(0))?
    };

    let pending_correction: i64 = if role_filter.is_empty() {
        conn.query_row(&count_sql("pending_correction"), [], |r| r.get(0))?
    } else {
        conn.query_row(&count_sql("pending_correction"), [role_filter], |r| r.get(0))?
    };

    let synced: i64 = if role_filter.is_empty() {
        conn.query_row(&count_sql("synced"), [], |r| r.get(0))?
    } else {
        conn.query_row(&count_sql("synced"), [role_filter], |r| r.get(0))?
    };

    let mut overdue: i64 = 0;
    let mut approaching: i64 = 0;

    let deadline_sql = if role_filter.is_empty() {
        "SELECT deadline FROM inspection".to_string()
    } else {
        "SELECT deadline FROM inspection WHERE current_handler_role = ?1".to_string()
    };

    let mut stmt = conn.prepare(&deadline_sql)?;
    let rows: Vec<String> = if role_filter.is_empty() {
        stmt.query_map([], |r| r.get::<_, String>(0))?.filter_map(|r| r.ok()).collect()
    } else {
        stmt.query_map([role_filter], |r| r.get::<_, String>(0))?.filter_map(|r| r.ok()).collect()
    };
    for deadline in &rows {
        let ot = compute_overdue_type(deadline);
        match ot {
            OverdueType::Overdue => overdue += 1,
            OverdueType::Approaching => approaching += 1,
            _ => {}
        }
    }

    Ok(Json(ApiResponse::ok(Stats {
        total,
        pending_review,
        under_review,
        approved,
        pending_correction,
        synced,
        overdue,
        approaching,
    })))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OverdueItem {
    pub inspection: Inspection,
    pub overdue_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OverdueQuery {
    pub role: Option<String>,
    pub overdue_type: Option<String>,
}

pub async fn get_overdue_queue(
    Data(db): Data<&Db>,
    Query(query): Query<OverdueQuery>,
) -> Result<Json<ApiResponse<Vec<OverdueItem>>>, AppError> {
    let conn = db.0.lock().unwrap();

    let mut sql = String::from(
        "SELECT id, pond_id, pond_name, inspector, inspector_role, status, current_handler, current_handler_role, deadline, version, created_at, updated_at FROM inspection WHERE status != 'synced'"
    );
    let mut sql_params: Vec<String> = Vec::new();

    if let Some(ref role) = query.role {
        sql.push_str(" AND current_handler_role = ?");
        sql_params.push(role.clone());
    }

    sql.push_str(" ORDER BY deadline ASC");

    let mut stmt = conn.prepare(&sql)?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = sql_params.iter().map(|p| p as &dyn rusqlite::ToSql).collect();

    let rows = stmt.query_map(rusqlite::params_from_iter(param_refs), |r| Ok(Inspection {
        id: r.get(0)?,
        pond_id: r.get(1)?,
        pond_name: r.get(2)?,
        inspector: r.get(3)?,
        inspector_role: r.get(4)?,
        status: r.get(5)?,
        current_handler: r.get(6)?,
        current_handler_role: r.get(7)?,
        deadline: r.get(8)?,
        version: r.get(9)?,
        created_at: r.get(10)?,
        updated_at: r.get(11)?,
    }))?;

    let mut items = Vec::new();
    for row in rows {
        let ins = row?;
        let ot = compute_overdue_type(&ins.deadline);
        let ot_str = ot.as_str().to_string();

        if let Some(ref filter_type) = query.overdue_type {
            if &ot_str != filter_type {
                continue;
            }
        }

        items.push(OverdueItem {
            inspection: ins,
            overdue_type: ot_str,
        });
    }

    Ok(Json(ApiResponse::ok(items)))
}

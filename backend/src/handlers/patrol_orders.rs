use poem::web::Data;
use poem_openapi::{OpenApi, payload::Json, param::Header};
use std::sync::Arc;

use crate::db::{AppState, json_from_row};
use crate::error::AppError;
use crate::middleware::{UserContext, check_version};
use crate::models::*;

fn row_to_patrol_order(row: &rusqlite::Row) -> Result<PatrolOrder, rusqlite::Error> {
    let evidence_val = row.get::<_, rusqlite::types::Value>(15)?;
    let patrol_evidence: Option<Vec<String>> = if matches!(evidence_val, rusqlite::types::Value::Null) {
        None
    } else {
        json_from_row(&evidence_val).ok()
    };

    let current_handler_name_val = row.get::<_, rusqlite::types::Value>(13)?;
    let current_handler_name: Option<String> = if matches!(current_handler_name_val, rusqlite::types::Value::Null) {
        None
    } else {
        row.get(13).ok()
    };

    Ok(PatrolOrder {
        id: row.get(0)?,
        order_no: row.get(1)?,
        station_id: row.get(2)?,
        station_name: row.get(3).ok(),
        status: row.get(4)?,
        priority: row.get(5)?,
        inspector_id: row.get(6).ok(),
        inspector_name: row.get(7).ok(),
        engineer_id: row.get(8).ok(),
        engineer_name: row.get(9).ok(),
        manager_id: row.get(10).ok(),
        manager_name: row.get(11).ok(),
        current_handler: row.get(12)?,
        current_handler_name,
        patrol_date: row.get(14)?,
        due_date: row.get(16)?,
        patrol_content: row.get(17).ok(),
        weather: row.get(18).ok(),
        temperature: row.get(19).ok(),
        patrol_evidence,
        defect_count: row.get(20)?,
        version: row.get(21)?,
        previous_handler_id: row.get(22).ok(),
        previous_opinion: row.get(23).ok(),
        previous_attachment: row.get(24).ok(),
        audit_remark: row.get(25).ok(),
        anomaly_reason: row.get(26).ok(),
        is_overdue: row.get(27)?,
        overdue_level: row.get(28).ok(),
        created_at: row.get(29)?,
        updated_at: row.get(30)?,
    })
}

fn current_handler_name_sql() -> &'static str {
    "CASE po.current_handler \
        WHEN 'inspector' THEN ui.name \
        WHEN 'engineer' THEN ue.name \
        WHEN 'manager' THEN um.name \
        ELSE NULL \
    END"
}

fn get_patrol_order(
    conn: &rusqlite::Connection,
    id: i64,
) -> Result<PatrolOrder, AppError> {
    let ch_name = current_handler_name_sql();
    let sql = format!("
        SELECT po.id, po.order_no, po.station_id, s.name, po.status, po.priority,
               po.inspector_id, ui.name, po.engineer_id, ue.name, po.manager_id, um.name,
               po.current_handler, {ch_name}, po.patrol_date, po.patrol_evidence, po.due_date,
               po.patrol_content, po.weather, po.temperature,
               po.defect_count, po.version, po.previous_handler_id, po.previous_opinion,
               po.previous_attachment, po.audit_remark, po.anomaly_reason,
               po.is_overdue, po.overdue_level, po.created_at, po.updated_at
        FROM patrol_orders po
        LEFT JOIN stations s ON po.station_id = s.id
        LEFT JOIN users ui ON po.inspector_id = ui.id
        LEFT JOIN users ue ON po.engineer_id = ue.id
        LEFT JOIN users um ON po.manager_id = um.id
        WHERE po.id = ?1
    ");
    let mut stmt = conn.prepare(&sql)?;
    stmt.query_row([id], |row| row_to_patrol_order(row))
        .map_err(|_| AppError::not_found(format!("巡检单 {} 不存在", id)))
}

fn write_audit_trail(
    conn: &rusqlite::Connection,
    patrol_order_id: i64,
    action: &str,
    from_status: Option<&str>,
    to_status: Option<&str>,
    actor_id: i64,
    actor_role: &str,
    remark: Option<&str>,
    anomaly_reason: Option<&str>,
    evidence: Option<&Vec<String>>,
    previous_opinion: Option<&str>,
    previous_attachment: Option<&str>,
) -> Result<(), AppError> {
    let evidence_json = evidence.map(|e| serde_json::to_string(e).unwrap_or_default());
    let sql = "
        INSERT INTO audit_trails (patrol_order_id, action, from_status, to_status, actor_id, actor_role,
                                   remark, anomaly_reason, evidence, previous_opinion, previous_attachment)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
    ";
    conn.execute(sql, rusqlite::params![
        patrol_order_id, action, from_status, to_status, actor_id, actor_role,
        remark, anomaly_reason, evidence_json, previous_opinion, previous_attachment
    ])?;
    Ok(())
}

fn record_anomaly(
    conn: &rusqlite::Connection,
    order: &PatrolOrder,
    action: &str,
    actor_id: i64,
    actor_role: &str,
    reason: &str,
    remark: Option<&str>,
) -> Result<(), AppError> {
    write_audit_trail(
        conn,
        order.id,
        action,
        Some(&order.status),
        Some(&order.status),
        actor_id,
        actor_role,
        remark,
        Some(reason),
        None,
        order.previous_opinion.as_deref(),
        order.previous_attachment.as_deref(),
    )?;
    let anomaly_sql = "UPDATE patrol_orders SET anomaly_reason = ?1 WHERE id = ?2";
    conn.execute(anomaly_sql, rusqlite::params![reason, order.id])?;
    Ok(())
}

struct UpdateStepParams {
    status_val: Option<String>,
    handler_id_val: Option<i64>,
    handler_role_val: Option<String>,
    opinion_val: Option<String>,
    evidence_val: Option<String>,
    correction_note_val: Option<String>,
}

fn update_process_record_step(
    conn: &rusqlite::Connection,
    patrol_order_id: i64,
    step_order: i64,
    status: Option<&str>,
    handler_id: Option<i64>,
    handler_role: Option<&str>,
    opinion: Option<&str>,
    evidence: Option<&Vec<String>>,
    started_at: bool,
    finished_at: bool,
    correction_note: Option<&str>,
) -> Result<(), AppError> {
    let mut sets: Vec<String> = Vec::new();
    let params_data = UpdateStepParams {
        status_val: status.map(|s| s.to_string()),
        handler_id_val: handler_id,
        handler_role_val: handler_role.map(|s| s.to_string()),
        opinion_val: opinion.map(|s| s.to_string()),
        evidence_val: evidence.map(|e| serde_json::to_string(e).unwrap_or_default()),
        correction_note_val: correction_note.map(|s| format!("\n{}", s)),
    };

    if params_data.status_val.is_some() {
        sets.push("status = ?".to_string());
    }
    if params_data.handler_id_val.is_some() {
        sets.push("handler_id = ?".to_string());
    }
    if params_data.handler_role_val.is_some() {
        sets.push("handler_role = ?".to_string());
    }
    if params_data.opinion_val.is_some() {
        sets.push("opinion = ?".to_string());
    }
    if params_data.evidence_val.is_some() {
        sets.push("evidence = ?".to_string());
    }
    if started_at {
        sets.push("started_at = datetime('now')".to_string());
    }
    if finished_at {
        sets.push("finished_at = datetime('now')".to_string());
    }
    if params_data.correction_note_val.is_some() {
        sets.push("correction_note = COALESCE(correction_note, '') || ?".to_string());
    }

    if sets.is_empty() {
        return Ok(());
    }

    let sql = format!(
        "UPDATE process_records SET {} WHERE patrol_order_id = ? AND step_order = ?",
        sets.join(", ")
    );

    let mut params: Vec<&dyn rusqlite::ToSql> = Vec::new();
    if let Some(v) = &params_data.status_val { params.push(v); }
    if let Some(v) = &params_data.handler_id_val { params.push(v); }
    if let Some(v) = &params_data.handler_role_val { params.push(v); }
    if let Some(v) = &params_data.opinion_val { params.push(v); }
    if let Some(v) = &params_data.evidence_val { params.push(v); }
    if let Some(v) = &params_data.correction_note_val { params.push(v); }
    params.push(&patrol_order_id);
    params.push(&step_order);

    conn.execute(&sql, rusqlite::params_from_iter(params))?;
    Ok(())
}

pub struct PatrolOrdersApi;

#[OpenApi]
impl PatrolOrdersApi {
    #[oai(path = "/patrol-orders", method = "get", tag = "PatrolOrders")]
    async fn list(
        &self,
        state: Data<&Arc<AppState>>,
        x_user_id: Header<i64>,
        x_user_role: Header<String>,
        status: Option<String>,
        overdue_level: Option<String>,
        station_id: Option<i64>,
        handler: Option<String>,
        keyword: Option<String>,
        page: Option<i64>,
        page_size: Option<i64>,
    ) -> Result<Json<PatrolOrderListResponse>, AppError> {
        let conn = state.db.lock().map_err(|_| AppError::internal("锁错误"))?;

        let page = page.unwrap_or(1).max(1);
        let page_size = page_size.unwrap_or(20).clamp(1, 100);
        let offset = (page - 1) * page_size;

        let mut conditions: Vec<String> = Vec::new();
        let status_s = status.clone();
        let overdue_level_s = overdue_level.clone();
        let handler_s = handler.clone();
        let kw1 = keyword.as_ref().map(|k| format!("%{}%", k));
        let kw2 = keyword.as_ref().map(|k| format!("%{}%", k));

        if status_s.is_some() {
            conditions.push("po.status = ?".to_string());
        }
        if overdue_level_s.is_some() {
            conditions.push("po.overdue_level = ?".to_string());
        }
        if station_id.is_some() {
            conditions.push("po.station_id = ?".to_string());
        }
        if handler_s.is_some() {
            conditions.push("po.current_handler = ?".to_string());
        }
        if keyword.is_some() {
            conditions.push("(po.order_no LIKE ? OR s.name LIKE ?)".to_string());
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        let ch_name = current_handler_name_sql();
        let sql_base = format!("
            FROM patrol_orders po
            LEFT JOIN stations s ON po.station_id = s.id
            LEFT JOIN users ui ON po.inspector_id = ui.id
            LEFT JOIN users ue ON po.engineer_id = ue.id
            LEFT JOIN users um ON po.manager_id = um.id
        ");

        let count_sql = format!("SELECT COUNT(*) {}{}", sql_base, where_clause);

        let mut count_params: Vec<&dyn rusqlite::ToSql> = Vec::new();
        if let Some(v) = &status_s { count_params.push(v); }
        if let Some(v) = &overdue_level_s { count_params.push(v); }
        if let Some(v) = &station_id { count_params.push(v); }
        if let Some(v) = &handler_s { count_params.push(v); }
        if let Some(v) = &kw1 { count_params.push(v); }
        if let Some(v) = &kw2 { count_params.push(v); }

        let total: i64 = conn.query_row(&count_sql, rusqlite::params_from_iter(count_params.iter().copied()), |r| r.get(0))?;

        let select_sql = format!(
            "SELECT po.id, po.order_no, po.station_id, s.name, po.status, po.priority,
                    po.inspector_id, ui.name, po.engineer_id, ue.name, po.manager_id, um.name,
                    po.current_handler, {ch_name}, po.patrol_date, po.patrol_evidence, po.due_date,
                    po.patrol_content, po.weather, po.temperature,
                    po.defect_count, po.version, po.previous_handler_id, po.previous_opinion,
                    po.previous_attachment, po.audit_remark, po.anomaly_reason,
                    po.is_overdue, po.overdue_level, po.created_at, po.updated_at
             {} {} ORDER BY po.id DESC LIMIT ? OFFSET ?",
            sql_base, where_clause
        );

        let mut query_params: Vec<&dyn rusqlite::ToSql> = Vec::new();
        if let Some(v) = &status_s { query_params.push(v); }
        if let Some(v) = &overdue_level_s { query_params.push(v); }
        if let Some(v) = &station_id { query_params.push(v); }
        if let Some(v) = &handler_s { query_params.push(v); }
        if let Some(v) = &kw1 { query_params.push(v); }
        if let Some(v) = &kw2 { query_params.push(v); }
        query_params.push(&page_size);
        query_params.push(&offset);

        let mut stmt = conn.prepare(&select_sql)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(query_params.iter().copied()), |row| row_to_patrol_order(row))?;
        let items: Result<Vec<PatrolOrder>, _> = rows.collect();
        let mut items = items?;

        for item in &mut items {
            let (level, is_ov) = calculate_overdue_level(&item.due_date);
            item.overdue_level = Some(level);
            item.is_overdue = if is_ov { 1 } else { 0 };
        }

        let group_stats_sql = format!(
            "SELECT 
                COALESCE(SUM(CASE WHEN po.overdue_level = 'normal' OR (po.overdue_level IS NULL AND julianday(po.due_date) - julianday('now') > 3) THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN po.overdue_level = 'near' OR (po.overdue_level IS NULL AND julianday(po.due_date) - julianday('now') BETWEEN 0 AND 3) THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN po.overdue_level = 'overdue' OR (po.overdue_level IS NULL AND julianday(po.due_date) <= julianday('now')) THEN 1 ELSE 0 END), 0)
             {} {}",
            sql_base, where_clause
        );

        let mut stats_params: Vec<&dyn rusqlite::ToSql> = Vec::new();
        if let Some(v) = &status_s { stats_params.push(v); }
        if let Some(v) = &overdue_level_s { stats_params.push(v); }
        if let Some(v) = &station_id { stats_params.push(v); }
        if let Some(v) = &handler_s { stats_params.push(v); }
        if let Some(v) = &kw1 { stats_params.push(v); }
        if let Some(v) = &kw2 { stats_params.push(v); }

        let stats: DueGroupStats = conn.query_row(
            &group_stats_sql,
            rusqlite::params_from_iter(stats_params.iter().copied()),
            |row| {
                Ok(DueGroupStats {
                    normal: row.get(0)?,
                    near: row.get(1)?,
                    overdue: row.get(2)?,
                })
            },
        )?;

        Ok(Json(PatrolOrderListResponse {
            items,
            pagination: Pagination { page, page_size, total },
            group_stats: stats,
        }))
    }

    #[oai(path = "/patrol-orders/:id", method = "get", tag = "PatrolOrders")]
    async fn detail(
        &self,
        state: Data<&Arc<AppState>>,
        x_user_id: Header<i64>,
        x_user_role: Header<String>,
        id: i64,
    ) -> Result<Json<PatrolOrderDetail>, AppError> {
        let conn = state.db.lock().map_err(|_| AppError::internal("锁错误"))?;

        let mut order = get_patrol_order(&conn, id)?;
        let (level, is_ov) = calculate_overdue_level(&order.due_date);
        order.overdue_level = Some(level);
        order.is_overdue = if is_ov { 1 } else { 0 };

        let defects_sql = "
            SELECT d.id, d.patrol_order_id, d.defect_no, d.location, d.description, d.severity,
                   d.category, d.reported_at, d.deadline, d.status, d.reporter_id, ur.name,
                   d.assignee_id, ua.name, d.evidence, d.anomaly_reason, d.version,
                   d.created_at, d.updated_at
            FROM defect_reports d
            LEFT JOIN users ur ON d.reporter_id = ur.id
            LEFT JOIN users ua ON d.assignee_id = ua.id
            WHERE d.patrol_order_id = ?1
            ORDER BY d.id
        ";
        let mut defect_stmt = conn.prepare(defects_sql)?;
        let defects = defect_stmt.query_map([id], |row| {
            let evidence_val = row.get::<_, rusqlite::types::Value>(14)?;
            let evidence: Option<Vec<String>> = if matches!(evidence_val, rusqlite::types::Value::Null) {
                None
            } else {
                json_from_row(&evidence_val).ok()
            };
            Ok(DefectReport {
                id: row.get(0)?,
                patrol_order_id: row.get(1)?,
                defect_no: row.get(2)?,
                location: row.get(3)?,
                description: row.get(4)?,
                severity: row.get(5)?,
                category: row.get(6)?,
                reported_at: row.get(7)?,
                deadline: row.get(8).ok(),
                status: row.get(9)?,
                reporter_id: row.get(10).ok(),
                reporter_name: row.get(11).ok(),
                assignee_id: row.get(12).ok(),
                assignee_name: row.get(13).ok(),
                evidence,
                anomaly_reason: row.get(15).ok(),
                version: row.get(16)?,
                created_at: row.get(17)?,
                updated_at: row.get(18)?,
            })
        })?;
        let defects: Result<Vec<DefectReport>, _> = defects.collect();
        let defects = defects?;

        let attach_sql = "
            SELECT a.id, a.patrol_order_id, a.defect_id, a.file_name, a.file_path, a.file_size,
                   a.file_type, a.uploaded_by, u.name, a.created_at
            FROM attachments a
            LEFT JOIN users u ON a.uploaded_by = u.id
            WHERE a.patrol_order_id = ?1 OR a.defect_id IN (SELECT id FROM defect_reports WHERE patrol_order_id = ?1)
            ORDER BY a.id
        ";
        let mut attach_stmt = conn.prepare(attach_sql)?;
        let attachments = attach_stmt.query_map([id], |row| {
            Ok(Attachment {
                id: row.get(0)?,
                patrol_order_id: row.get(1).ok(),
                defect_id: row.get(2).ok(),
                file_name: row.get(3)?,
                file_path: row.get(4)?,
                file_size: row.get(5)?,
                file_type: row.get(6)?,
                uploaded_by: row.get(7).ok(),
                uploaded_by_name: row.get(8).ok(),
                created_at: row.get(9)?,
            })
        })?;
        let attachments: Result<Vec<Attachment>, _> = attachments.collect();
        let attachments = attachments?;

        let proc_sql = "
            SELECT p.id, p.patrol_order_id, p.step_order, p.step_name, p.handler_id, u.name,
                   p.handler_role, p.status, p.opinion, p.evidence, p.started_at, p.finished_at,
                   p.anomaly_reason, p.correction_note, p.created_at
            FROM process_records p
            LEFT JOIN users u ON p.handler_id = u.id
            WHERE p.patrol_order_id = ?1
            ORDER BY p.step_order, p.id
        ";
        let mut proc_stmt = conn.prepare(proc_sql)?;
        let proc_records = proc_stmt.query_map([id], |row| {
            let evidence_val = row.get::<_, rusqlite::types::Value>(9)?;
            let evidence: Option<Vec<String>> = if matches!(evidence_val, rusqlite::types::Value::Null) {
                None
            } else {
                json_from_row(&evidence_val).ok()
            };
            Ok(ProcessRecord {
                id: row.get(0)?,
                patrol_order_id: row.get(1)?,
                step_order: row.get(2)?,
                step_name: row.get(3)?,
                handler_id: row.get(4).ok(),
                handler_name: row.get(5).ok(),
                handler_role: row.get(6).ok(),
                status: row.get(7)?,
                opinion: row.get(8).ok(),
                evidence,
                started_at: row.get(10).ok(),
                finished_at: row.get(11).ok(),
                anomaly_reason: row.get(12).ok(),
                correction_note: row.get(13).ok(),
                created_at: row.get(14)?,
            })
        })?;
        let process_records: Result<Vec<ProcessRecord>, _> = proc_records.collect();
        let process_records = process_records?;

        let acc_sql = "
            SELECT a.id, a.defect_id, a.patrol_order_id, a.result, a.evidence, a.remark,
                   a.acceptor_id, u.name, a.accepted_at, a.anomaly_reason
            FROM acceptance_records a
            LEFT JOIN users u ON a.acceptor_id = u.id
            WHERE a.patrol_order_id = ?1
            ORDER BY a.accepted_at DESC
        ";
        let mut acc_stmt = conn.prepare(acc_sql)?;
        let acc_records = acc_stmt.query_map([id], |row| {
            let evidence_val = row.get::<_, rusqlite::types::Value>(4)?;
            let evidence: Option<Vec<String>> = if matches!(evidence_val, rusqlite::types::Value::Null) {
                None
            } else {
                json_from_row(&evidence_val).ok()
            };
            Ok(AcceptanceRecord {
                id: row.get(0)?,
                defect_id: row.get(1)?,
                patrol_order_id: row.get(2)?,
                result: row.get(3)?,
                evidence,
                remark: row.get(5).ok(),
                acceptor_id: row.get(6).ok(),
                acceptor_name: row.get(7).ok(),
                accepted_at: row.get(8)?,
                anomaly_reason: row.get(9).ok(),
            })
        })?;
        let acceptance_records: Result<Vec<AcceptanceRecord>, _> = acc_records.collect();
        let acceptance_records = acceptance_records?;

        Ok(Json(PatrolOrderDetail {
            order,
            defects,
            attachments,
            process_records,
            acceptance_records,
        }))
    }

    #[oai(path = "/patrol-orders", method = "post", tag = "PatrolOrders")]
    async fn create(
        &self,
        state: Data<&Arc<AppState>>,
        x_user_id: Header<i64>,
        x_user_role: Header<String>,
        req: Json<CreatePatrolOrderRequest>,
    ) -> Result<Json<PatrolOrder>, AppError> {
        let ctx = UserContext::new(x_user_id.0, x_user_role.0);
        let conn = state.db.lock().map_err(|_| AppError::internal("锁错误"))?;

        if ctx.user_role != "admin" {
            ctx.require_inspector()?;
        }

        let order_no = generate_order_no();
        let priority = req.priority.clone().unwrap_or_else(|| "medium".to_string());
        let (overdue_level, is_overdue) = calculate_overdue_level(&req.due_date);
        let initial_status = state_machine::PENDING_DISPATCH;
        let initial_handler = "inspector";

        let sql = "
            INSERT INTO patrol_orders (order_no, station_id, status, priority, inspector_id, manager_id,
                                        current_handler, patrol_date, due_date, patrol_content,
                                        is_overdue, overdue_level)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
        ";
        conn.execute(sql, rusqlite::params![
            order_no, req.station_id, initial_status, priority, req.inspector_id, req.manager_id,
            initial_handler, req.patrol_date, req.due_date, req.patrol_content,
            if is_overdue { 1 } else { 0 }, overdue_level
        ])?;

        let id = conn.last_insert_rowid();

        let process_sql = "
            INSERT INTO process_records (patrol_order_id, step_order, step_name, handler_id, handler_role, status, started_at)
            VALUES (?1, ?2, '站点巡检员补齐材料', ?3, ?4, ?5, datetime('now'))
        ";
        conn.execute(process_sql, rusqlite::params![
            id, state_machine::STEP_INSPECTOR,
            req.inspector_id.unwrap_or(x_user_id.0), "inspector",
            state_machine::STATUS_IN_PROGRESS
        ])?;
        let process_sql2 = "
            INSERT INTO process_records (patrol_order_id, step_order, step_name, status)
            VALUES (?1, ?2, '运维工程师办理', ?3)
        ";
        conn.execute(process_sql2, rusqlite::params![id, state_machine::STEP_ENGINEER, state_machine::STATUS_PENDING])?;
        let process_sql3 = "
            INSERT INTO process_records (patrol_order_id, step_order, step_name, status)
            VALUES (?1, ?2, '区域负责人收口', ?3)
        ";
        conn.execute(process_sql3, rusqlite::params![id, state_machine::STEP_MANAGER, state_machine::STATUS_PENDING])?;

        write_audit_trail(
            &conn, id, "创建巡检单", None, Some(initial_status),
            x_user_id.0, &ctx.user_role, None, None, None, None, None
        )?;

        let order = get_patrol_order(&conn, id)?;
        Ok(Json(order))
    }

    #[oai(path = "/patrol-orders/:id", method = "put", tag = "PatrolOrders")]
    async fn update(
        &self,
        state: Data<&Arc<AppState>>,
        x_user_id: Header<i64>,
        x_user_role: Header<String>,
        id: i64,
        req: Json<UpdatePatrolOrderRequest>,
    ) -> Result<Json<PatrolOrder>, AppError> {
        let ctx = UserContext::new(x_user_id.0, x_user_role.0);
        let conn = state.db.lock().map_err(|_| AppError::internal("锁错误"))?;

        let order = get_patrol_order(&conn, id)?;

        if ctx.user_role != "admin" {
            ctx.require_inspector().map_err(|e| {
                let _ = record_anomaly(&conn, &order, "更新失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
                e
            })?;
            if !ctx.is_handler(order.inspector_id) {
                let reason = "只有该巡检单的巡检员可以更新";
                record_anomaly(&conn, &order, "更新失败", x_user_id.0, &ctx.user_role, reason, None)?;
                return Err(AppError::forbidden(reason));
            }
        }

        state_machine::check_transition(&order.status, "update").map_err(|e| {
            let _ = record_anomaly(&conn, &order, "更新失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
            e
        })?;

        if ctx.user_role != "admin" && order.current_handler != "inspector" {
            let reason = format!("当前处理人是「{}」，不是巡检员", order.current_handler);
            record_anomaly(&conn, &order, "更新失败", x_user_id.0, &ctx.user_role, &reason, None)?;
            return Err(AppError::forbidden(reason));
        }

        check_version(order.version, req.version).map_err(|e| {
            let _ = record_anomaly(&conn, &order, "更新失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
            e
        })?;

        let evidence_json = req.patrol_evidence.as_ref().map(|e| serde_json::to_string(e).unwrap_or_default());

        let sql = "
            UPDATE patrol_orders
            SET patrol_content = COALESCE(?1, patrol_content),
                weather = COALESCE(?2, weather),
                temperature = COALESCE(?3, temperature),
                patrol_evidence = COALESCE(?4, patrol_evidence),
                version = version + 1,
                updated_at = datetime('now')
            WHERE id = ?5
        ";
        conn.execute(sql, rusqlite::params![
            req.patrol_content, req.weather, req.temperature, evidence_json, id
        ])?;

        if let Some(note) = &req.correction_note {
            update_process_record_step(
                &conn, id, state_machine::STEP_INSPECTOR,
                None, None, None,
                None, None,
                false, false,
                Some(note),
            )?;
        }

        write_audit_trail(
            &conn, id, "更新巡检单", Some(&order.status), Some(&order.status),
            x_user_id.0, &ctx.user_role, None, None,
            req.patrol_evidence.as_ref(),
            order.previous_opinion.as_deref(),
            order.previous_attachment.as_deref(),
        )?;

        let updated = get_patrol_order(&conn, id)?;
        Ok(Json(updated))
    }

    #[oai(path = "/patrol-orders/:id/submit", method = "put", tag = "PatrolOrders")]
    async fn submit(
        &self,
        state: Data<&Arc<AppState>>,
        x_user_id: Header<i64>,
        x_user_role: Header<String>,
        id: i64,
        req: Json<SubmitPatrolRequest>,
    ) -> Result<Json<PatrolOrder>, AppError> {
        let ctx = UserContext::new(x_user_id.0, x_user_role.0);
        let conn = state.db.lock().map_err(|_| AppError::internal("锁错误"))?;

        let order = get_patrol_order(&conn, id)?;

        if ctx.user_role != "admin" {
            ctx.require_inspector().map_err(|e| {
                let _ = record_anomaly(&conn, &order, "提交失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
                e
            })?;
            if !ctx.is_handler(order.inspector_id) {
                let reason = "只有该巡检单的巡检员可以提交";
                record_anomaly(&conn, &order, "提交失败", x_user_id.0, &ctx.user_role, reason, None)?;
                return Err(AppError::forbidden(reason));
            }
        }

        state_machine::check_transition(&order.status, "submit").map_err(|e| {
            let _ = record_anomaly(&conn, &order, "提交失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
            e
        })?;

        if ctx.user_role != "admin" && order.current_handler != "inspector" {
            let reason = format!("当前处理人是「{}」，不是巡检员", order.current_handler);
            record_anomaly(&conn, &order, "提交失败", x_user_id.0, &ctx.user_role, &reason, None)?;
            return Err(AppError::forbidden(reason));
        }

        check_version(order.version, req.version).map_err(|e| {
            let _ = record_anomaly(&conn, &order, "提交失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
            e
        })?;

        let has_content = req.patrol_content.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false)
            || order.patrol_content.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false);
        let has_weather = req.weather.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false)
            || order.weather.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false);
        let has_temp = req.temperature.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false)
            || order.temperature.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false);
        let has_evidence = req.patrol_evidence.as_ref().map(|e| !e.is_empty()).unwrap_or(false)
            || order.patrol_evidence.as_ref().map(|e| !e.is_empty()).unwrap_or(false);

        if !(has_content && has_weather && has_temp && has_evidence) {
            let reason = "巡检材料不完整: patrol_content、weather、temperature、patrol_evidence 均不能为空";
            record_anomaly(&conn, &order, "提交失败", x_user_id.0, &ctx.user_role, reason, None)?;
            return Err(AppError::bad_request(reason));
        }

        let evidence_json = req.patrol_evidence.as_ref().map(|e| serde_json::to_string(e).unwrap_or_default());
        let from_status = order.status.clone();
        let to_status = state_machine::next_status_after_submit();
        let next_handler = state_machine::next_handler_after_submit();
        let action = if from_status == state_machine::RETURNED { "补正提交" } else { "提交巡检材料" };

        let sql = "
            UPDATE patrol_orders
            SET patrol_content = COALESCE(?1, patrol_content),
                weather = COALESCE(?2, weather),
                temperature = COALESCE(?3, temperature),
                patrol_evidence = COALESCE(?4, patrol_evidence),
                status = ?5,
                current_handler = ?6,
                previous_handler_id = ?7,
                version = version + 1,
                updated_at = datetime('now')
            WHERE id = ?8
        ";
        conn.execute(sql, rusqlite::params![
            req.patrol_content, req.weather, req.temperature, evidence_json,
            to_status, next_handler, x_user_id.0, id
        ])?;

        update_process_record_step(
            &conn, id, state_machine::STEP_INSPECTOR,
            Some(state_machine::STATUS_COMPLETED),
            None, None,
            Some("巡检材料已提交"),
            req.patrol_evidence.as_ref(),
            false, true,
            None,
        )?;

        let submitted_evidence = req.patrol_evidence.as_ref().or(order.patrol_evidence.as_ref());
        write_audit_trail(
            &conn, id, action, Some(&from_status), Some(to_status),
            x_user_id.0, &ctx.user_role, Some("巡检材料已提交"), None,
            submitted_evidence,
            order.previous_opinion.as_deref(),
            order.previous_attachment.as_deref(),
        )?;

        let updated = get_patrol_order(&conn, id)?;
        Ok(Json(updated))
    }

    #[oai(path = "/patrol-orders/:id/dispatch", method = "put", tag = "PatrolOrders")]
    async fn dispatch(
        &self,
        state: Data<&Arc<AppState>>,
        x_user_id: Header<i64>,
        x_user_role: Header<String>,
        id: i64,
        req: Json<DispatchRequest>,
    ) -> Result<Json<PatrolOrder>, AppError> {
        let ctx = UserContext::new(x_user_id.0, x_user_role.0);
        let conn = state.db.lock().map_err(|_| AppError::internal("锁错误"))?;

        let order = get_patrol_order(&conn, id)?;

        if ctx.user_role != "admin" {
            ctx.require_manager().map_err(|e| {
                let _ = record_anomaly(&conn, &order, "派发失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
                e
            })?;
            if !ctx.is_handler(order.manager_id) {
                let reason = "只有该巡检单的区域负责人可以派发";
                record_anomaly(&conn, &order, "派发失败", x_user_id.0, &ctx.user_role, reason, None)?;
                return Err(AppError::forbidden(reason));
            }
        }

        if order.status == state_machine::IN_PROGRESS && order.engineer_id.is_some() {
            let reason = format!("状态冲突：当前状态「{}」且已指派工程师，不允许重新派发", state_machine::status_label(&order.status));
            record_anomaly(&conn, &order, "派发失败", x_user_id.0, &ctx.user_role, &reason, None)?;
            return Err(AppError::bad_request(reason));
        }

        state_machine::check_transition(&order.status, "dispatch").map_err(|e| {
            let _ = record_anomaly(&conn, &order, "派发失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
            e
        })?;

        if ctx.user_role != "admin" && order.current_handler != "manager" {
            let reason = format!("当前处理人是「{}」，不是区域负责人", order.current_handler);
            record_anomaly(&conn, &order, "派发失败", x_user_id.0, &ctx.user_role, &reason, None)?;
            return Err(AppError::forbidden(reason));
        }

        check_version(order.version, req.version).map_err(|e| {
            let _ = record_anomaly(&conn, &order, "派发失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
            e
        })?;

        let engineer_valid: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM users WHERE id = ?1 AND role = 'engineer')",
            [req.engineer_id],
            |row| row.get(0),
        ).unwrap_or(false);
        if !engineer_valid {
            let reason = "无效的工程师ID".to_string();
            record_anomaly(&conn, &order, "派发失败", x_user_id.0, &ctx.user_role, &reason, None)?;
            return Err(AppError::bad_request(reason));
        }

        let from_status = order.status.clone();
        let to_status = state_machine::next_status_after_dispatch();
        let next_handler = state_machine::next_handler_after_dispatch();

        let sql = "
            UPDATE patrol_orders
            SET engineer_id = ?1,
                current_handler = ?2,
                status = ?3,
                previous_handler_id = ?4,
                version = version + 1,
                updated_at = datetime('now')
            WHERE id = ?5
        ";
        conn.execute(sql, rusqlite::params![
            req.engineer_id, next_handler, to_status, x_user_id.0, id
        ])?;

        update_process_record_step(
            &conn, id, state_machine::STEP_ENGINEER,
            Some(state_machine::STATUS_IN_PROGRESS),
            Some(req.engineer_id), Some("engineer"),
            None, None,
            true, false,
            None,
        )?;

        write_audit_trail(
            &conn, id, "派发工程师", Some(&from_status), Some(to_status),
            x_user_id.0, &ctx.user_role, req.remark.as_deref(), None,
            None,
            order.previous_opinion.as_deref(),
            order.previous_attachment.as_deref(),
        )?;

        let updated = get_patrol_order(&conn, id)?;
        Ok(Json(updated))
    }

    #[oai(path = "/patrol-orders/:id/process", method = "put", tag = "PatrolOrders")]
    async fn process(
        &self,
        state: Data<&Arc<AppState>>,
        x_user_id: Header<i64>,
        x_user_role: Header<String>,
        id: i64,
        req: Json<ProcessRequest>,
    ) -> Result<Json<PatrolOrder>, AppError> {
        let ctx = UserContext::new(x_user_id.0, x_user_role.0);
        let conn = state.db.lock().map_err(|_| AppError::internal("锁错误"))?;

        let order = get_patrol_order(&conn, id)?;

        if ctx.user_role != "admin" {
            ctx.require_engineer().map_err(|e| {
                let _ = record_anomaly(&conn, &order, "办理失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
                e
            })?;
            if !ctx.is_handler(order.engineer_id) {
                let reason = "只有该巡检单的工程师可以办理";
                record_anomaly(&conn, &order, "办理失败", x_user_id.0, &ctx.user_role, reason, None)?;
                return Err(AppError::forbidden(reason));
            }
        }

        state_machine::check_transition(&order.status, "process").map_err(|e| {
            let _ = record_anomaly(&conn, &order, "办理失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
            e
        })?;

        if ctx.user_role != "admin" && order.current_handler != "engineer" {
            let reason = format!("当前处理人是「{}」，不是工程师", order.current_handler);
            record_anomaly(&conn, &order, "办理失败", x_user_id.0, &ctx.user_role, &reason, None)?;
            return Err(AppError::forbidden(reason));
        }

        check_version(order.version, req.version).map_err(|e| {
            let _ = record_anomaly(&conn, &order, "办理失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
            e
        })?;

        if req.defect_evidences.is_empty() {
            let reason = "办理失败: 缺少缺陷消缺证据";
            record_anomaly(&conn, &order, "办理失败", x_user_id.0, &ctx.user_role, reason, None)?;
            return Err(AppError::bad_request(reason));
        }

        let unverified_sql = "SELECT defect_no FROM defect_reports WHERE patrol_order_id = ?1 AND status NOT IN ('verified', 'rejected')";
        let mut missing_defects: Vec<String> = Vec::new();
        {
            let mut unverified_stmt = conn.prepare(unverified_sql)?;
            let unverified_rows = unverified_stmt.query_map([id], |row| row.get::<_, String>(0))?;
            let unverified_defects: Vec<String> = unverified_rows.filter_map(|r| r.ok()).collect();
            for defect_no in &unverified_defects {
                if !req.defect_evidences.contains_key(defect_no) {
                    missing_defects.push(defect_no.clone());
                }
            }
        }
        if !missing_defects.is_empty() {
            let reason = format!("未覆盖的缺陷: {}", missing_defects.join(", "));
            record_anomaly(&conn, &order, "办理失败", x_user_id.0, &ctx.user_role, &reason, None)?;
            return Err(AppError::bad_request(&reason));
        }

        for (defect_no, evidence) in &req.defect_evidences {
            if evidence.is_empty() {
                let reason = format!("缺陷 {} 缺少消缺证据", defect_no);
                record_anomaly(&conn, &order, "办理失败", x_user_id.0, &ctx.user_role, &reason, None)?;
                return Err(AppError::bad_request(&reason));
            }
        }

        for (defect_no, evidence) in &req.defect_evidences {
            let evidence_json = serde_json::to_string(evidence).unwrap_or_default();
            let defect_sql = "
                UPDATE defect_reports
                SET status = 'resolved', evidence = ?1, version = version + 1, updated_at = datetime('now')
                WHERE defect_no = ?2 AND patrol_order_id = ?3
            ";
            conn.execute(defect_sql, rusqlite::params![evidence_json, defect_no, id])?;
        }

        let from_status = order.status.clone();
        let to_status = state_machine::next_status_after_process();
        let next_handler = state_machine::next_handler_after_process();
        let all_evidence: Vec<String> = req.defect_evidences.values().flatten().cloned().collect();

        let sql = "
            UPDATE patrol_orders
            SET status = ?1,
                current_handler = ?2,
                previous_handler_id = ?3,
                previous_opinion = ?4,
                version = version + 1,
                updated_at = datetime('now')
            WHERE id = ?5
        ";
        conn.execute(sql, rusqlite::params![
            to_status, next_handler, x_user_id.0, req.opinion, id
        ])?;

        update_process_record_step(
            &conn, id, state_machine::STEP_ENGINEER,
            Some(state_machine::STATUS_COMPLETED),
            None, None,
            req.opinion.as_deref(),
            Some(&all_evidence),
            false, true,
            None,
        )?;

        update_process_record_step(
            &conn, id, state_machine::STEP_MANAGER,
            Some(state_machine::STATUS_IN_PROGRESS),
            order.manager_id, Some("manager"),
            None, None,
            true, false,
            None,
        )?;

        write_audit_trail(
            &conn, id, "消缺完成", Some(&from_status), Some(to_status),
            x_user_id.0, &ctx.user_role, req.opinion.as_deref(), None,
            Some(&all_evidence),
            order.previous_opinion.as_deref(),
            order.previous_attachment.as_deref(),
        )?;

        let updated = get_patrol_order(&conn, id)?;
        Ok(Json(updated))
    }

    #[oai(path = "/patrol-orders/:id/return", method = "put", tag = "PatrolOrders")]
    async fn return_order(
        &self,
        state: Data<&Arc<AppState>>,
        x_user_id: Header<i64>,
        x_user_role: Header<String>,
        id: i64,
        req: Json<ReturnRequest>,
    ) -> Result<Json<PatrolOrder>, AppError> {
        let ctx = UserContext::new(x_user_id.0, x_user_role.0);
        let conn = state.db.lock().map_err(|_| AppError::internal("锁错误"))?;

        let order = get_patrol_order(&conn, id)?;

        if ctx.user_role != "admin" {
            ctx.require_role(&["engineer", "manager"]).map_err(|e| {
                let _ = record_anomaly(&conn, &order, "退回失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
                e
            })?;
            if ctx.user_role == "engineer" && !ctx.is_handler(order.engineer_id) {
                let reason = "只有该巡检单的工程师可以退回";
                record_anomaly(&conn, &order, "退回失败", x_user_id.0, &ctx.user_role, reason, None)?;
                return Err(AppError::forbidden(reason));
            }
            if ctx.user_role == "manager" && !ctx.is_handler(order.manager_id) {
                let reason = "只有该巡检单的区域负责人可以退回";
                record_anomaly(&conn, &order, "退回失败", x_user_id.0, &ctx.user_role, reason, None)?;
                return Err(AppError::forbidden(reason));
            }
        }

        state_machine::check_transition(&order.status, "return").map_err(|e| {
            let _ = record_anomaly(&conn, &order, "退回失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
            e
        })?;

        let expected_handler = if ctx.user_role == "manager" || (ctx.user_role == "admin" && order.current_handler == "manager") {
            "manager"
        } else {
            "engineer"
        };
        if ctx.user_role != "admin" && order.current_handler != expected_handler {
            let reason = format!("当前处理人是「{}」，不是{}", order.current_handler, expected_handler);
            record_anomaly(&conn, &order, "退回失败", x_user_id.0, &ctx.user_role, &reason, None)?;
            return Err(AppError::forbidden(reason));
        }

        check_version(order.version, req.version).map_err(|e| {
            let _ = record_anomaly(&conn, &order, "退回失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
            e
        })?;

        let from_status = order.status.clone();
        let to_status = state_machine::next_status_after_return();
        let returner_role = if ctx.user_role == "admin" {
            &order.current_handler
        } else {
            &ctx.user_role
        };
        let next_handler = state_machine::return_target_handler(returner_role);
        let return_step = state_machine::return_step(returner_role);

        let sql = "
            UPDATE patrol_orders
            SET status = ?1,
                current_handler = ?2,
                previous_handler_id = ?3,
                previous_opinion = ?4,
                previous_attachment = ?5,
                version = version + 1,
                updated_at = datetime('now')
            WHERE id = ?6
        ";
        conn.execute(sql, rusqlite::params![
            to_status, next_handler, x_user_id.0, req.opinion, req.attachment, id
        ])?;

        update_process_record_step(
            &conn, id, return_step,
            None, None, None,
            None, None,
            false, false,
            Some(&req.opinion),
        )?;

        write_audit_trail(
            &conn, id, "退回补正", Some(&from_status), Some(to_status),
            x_user_id.0, &ctx.user_role, Some(&req.opinion), None,
            None,
            order.previous_opinion.as_deref(),
            order.previous_attachment.as_deref(),
        )?;

        let updated = get_patrol_order(&conn, id)?;
        Ok(Json(updated))
    }

    #[oai(path = "/patrol-orders/:id/review", method = "put", tag = "PatrolOrders")]
    async fn review(
        &self,
        state: Data<&Arc<AppState>>,
        x_user_id: Header<i64>,
        x_user_role: Header<String>,
        id: i64,
        req: Json<ReviewRequest>,
    ) -> Result<Json<PatrolOrder>, AppError> {
        let ctx = UserContext::new(x_user_id.0, x_user_role.0);
        let conn = state.db.lock().map_err(|_| AppError::internal("锁错误"))?;

        let order = get_patrol_order(&conn, id)?;

        if ctx.user_role != "admin" {
            ctx.require_manager().map_err(|e| {
                let _ = record_anomaly(&conn, &order, "复核失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
                e
            })?;
            if !ctx.is_handler(order.manager_id) {
                let reason = "只有该巡检单的区域负责人可以复核";
                record_anomaly(&conn, &order, "复核失败", x_user_id.0, &ctx.user_role, reason, None)?;
                return Err(AppError::forbidden(reason));
            }
        }

        state_machine::check_transition(&order.status, "review").map_err(|e| {
            let _ = record_anomaly(&conn, &order, "复核失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
            e
        })?;

        if ctx.user_role != "admin" && order.current_handler != "manager" {
            let reason = format!("当前处理人是「{}」，不是区域负责人", order.current_handler);
            record_anomaly(&conn, &order, "复核失败", x_user_id.0, &ctx.user_role, &reason, None)?;
            return Err(AppError::forbidden(reason));
        }

        check_version(order.version, req.version).map_err(|e| {
            let _ = record_anomaly(&conn, &order, "复核失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
            e
        })?;

        let is_pass = req.result == "pass";
        let from_status = order.status.clone();
        let to_status = if is_pass {
            state_machine::next_status_after_review_pass()
        } else {
            state_machine::next_status_after_review_fail()
        };
        let next_handler = if is_pass {
            state_machine::next_handler_after_review_pass()
        } else {
            state_machine::next_handler_after_review_fail()
        };
        let action = if is_pass { "复核通过" } else { "复核退回" };

        let sql = "
            UPDATE patrol_orders
            SET status = ?1,
                current_handler = ?2,
                previous_handler_id = ?3,
                previous_opinion = ?4,
                audit_remark = ?5,
                version = version + 1,
                updated_at = datetime('now')
            WHERE id = ?6
        ";
        conn.execute(sql, rusqlite::params![
            to_status, next_handler, x_user_id.0, req.remark, req.remark, id
        ])?;

        if is_pass {
            update_process_record_step(
                &conn, id, state_machine::STEP_MANAGER,
                Some(state_machine::STATUS_COMPLETED),
                None, None,
                req.remark.as_deref(),
                None,
                false, true,
                None,
            )?;
        } else {
            update_process_record_step(
                &conn, id, state_machine::STEP_ENGINEER,
                None, None, None,
                None, None,
                false, false,
                Some(&format!("复核退回: {}", req.remark.as_deref().unwrap_or(""))),
            )?;
        }

        write_audit_trail(
            &conn, id, action, Some(&from_status), Some(to_status),
            x_user_id.0, &ctx.user_role, req.remark.as_deref(), None,
            None,
            order.previous_opinion.as_deref(),
            order.previous_attachment.as_deref(),
        )?;

        let updated = get_patrol_order(&conn, id)?;
        Ok(Json(updated))
    }

    #[oai(path = "/patrol-orders/batch-process", method = "post", tag = "PatrolOrders")]
    async fn batch_process(
        &self,
        state: Data<&Arc<AppState>>,
        x_user_id: Header<i64>,
        x_user_role: Header<String>,
        req: Json<BatchProcessRequest>,
    ) -> Result<Json<Vec<BatchResultItem>>, AppError> {
        let ctx = UserContext::new(x_user_id.0, x_user_role.0);
        let conn = state.db.lock().map_err(|_| AppError::internal("锁错误"))?;

        let mut results = Vec::new();

        for item in &req.items {
            let id = item.id;
            let order = match get_patrol_order(&conn, id) {
                Ok(o) => o,
                Err(e) => {
                    results.push(BatchResultItem {
                        id,
                        success: false,
                        message: e.to_string(),
                    });
                    continue;
                }
            };

            let mut error_msg: Option<String> = None;

            if ctx.user_role != "admin" {
                if let Err(e) = ctx.require_engineer() {
                    let _ = record_anomaly(&conn, &order, "批量办理失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
                    error_msg = Some(e.to_string());
                }
                if error_msg.is_none() && !ctx.is_handler(order.engineer_id) {
                    let reason = "只有该巡检单的工程师可以办理";
                    let _ = record_anomaly(&conn, &order, "批量办理失败", x_user_id.0, &ctx.user_role, reason, None);
                    error_msg = Some(reason.to_string());
                }
            }

            if error_msg.is_none() {
                if let Err(e) = state_machine::check_transition(&order.status, "process") {
                    let _ = record_anomaly(&conn, &order, "批量办理失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
                    error_msg = Some(e.to_string());
                }
            }

            if error_msg.is_none() && ctx.user_role != "admin" && order.current_handler != "engineer" {
                let reason = format!("当前处理人是「{}」，不是工程师", order.current_handler);
                let _ = record_anomaly(&conn, &order, "批量办理失败", x_user_id.0, &ctx.user_role, &reason, None);
                error_msg = Some(reason);
            }

            if error_msg.is_none() {
                if let Err(e) = check_version(order.version, item.version) {
                    let _ = record_anomaly(&conn, &order, "批量办理失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
                    error_msg = Some(e.to_string());
                }
            }

            if let Some(msg) = error_msg {
                results.push(BatchResultItem {
                    id,
                    success: false,
                    message: msg,
                });
                continue;
            }

            let evidences = match &item.defect_evidences {
                Some(e) if !e.is_empty() => e,
                _ => {
                    let reason = "未提供缺陷消缺证据".to_string();
                    let _ = record_anomaly(&conn, &order, "批量办理失败", x_user_id.0, &ctx.user_role, &reason, None);
                    results.push(BatchResultItem {
                        id,
                        success: false,
                        message: reason,
                    });
                    continue;
                }
            };

            {
                let unverified_sql = "SELECT defect_no FROM defect_reports WHERE patrol_order_id = ?1 AND status NOT IN ('verified', 'rejected')";
                let mut unverified_stmt = match conn.prepare(unverified_sql) {
                    Ok(s) => s,
                    Err(e) => {
                        results.push(BatchResultItem {
                            id,
                            success: false,
                            message: e.to_string(),
                        });
                        continue;
                    }
                };
                let unverified_rows = match unverified_stmt.query_map([id], |row| row.get::<_, String>(0)) {
                    Ok(r) => r,
                    Err(e) => {
                        results.push(BatchResultItem {
                            id,
                            success: false,
                            message: e.to_string(),
                        });
                        continue;
                    }
                };
                let unverified_defects: Vec<String> = unverified_rows.filter_map(|r| r.ok()).collect();

                let mut missing_defects: Vec<String> = Vec::new();
                for defect_no in &unverified_defects {
                    if !evidences.contains_key(defect_no) {
                        missing_defects.push(defect_no.clone());
                    }
                }
                if !missing_defects.is_empty() {
                    let reason = format!("未覆盖的缺陷: {}", missing_defects.join(", "));
                    let _ = record_anomaly(&conn, &order, "批量办理失败", x_user_id.0, &ctx.user_role, &reason, None);
                    results.push(BatchResultItem {
                        id,
                        success: false,
                        message: reason,
                    });
                    continue;
                }
            }

            let mut has_evidence_error = false;
            for (defect_no, evidence) in evidences {
                if evidence.is_empty() {
                    let reason = format!("缺陷 {} 缺少消缺证据", defect_no);
                    let _ = record_anomaly(&conn, &order, "批量办理失败", x_user_id.0, &ctx.user_role, &reason, None);
                    results.push(BatchResultItem {
                        id,
                        success: false,
                        message: reason,
                    });
                    has_evidence_error = true;
                    break;
                }
            }
            if has_evidence_error {
                continue;
            }

            for (defect_no, evidence) in evidences {
                let evidence_json = serde_json::to_string(evidence).unwrap_or_default();
                let defect_sql = "
                    UPDATE defect_reports
                    SET status = 'resolved', evidence = ?1, version = version + 1, updated_at = datetime('now')
                    WHERE defect_no = ?2 AND patrol_order_id = ?3
                ";
                let _ = conn.execute(defect_sql, rusqlite::params![evidence_json, defect_no, id]);
            }

            let from_status = order.status.clone();
            let to_status = state_machine::next_status_after_process();
            let next_handler = state_machine::next_handler_after_process();
            let all_evidence: Vec<String> = evidences.values().flatten().cloned().collect();

            let sql = "
                UPDATE patrol_orders
                SET status = ?1, current_handler = ?2,
                    previous_handler_id = ?3, previous_opinion = ?4,
                    version = version + 1, updated_at = datetime('now')
                WHERE id = ?5
            ";
            if conn.execute(sql, rusqlite::params![
                to_status, next_handler, x_user_id.0, item.opinion, id
            ]).is_ok() {
                let _ = update_process_record_step(
                    &conn, id, state_machine::STEP_ENGINEER,
                    Some(state_machine::STATUS_COMPLETED),
                    None, None,
                    item.opinion.as_deref(),
                    if all_evidence.is_empty() { None } else { Some(&all_evidence) },
                    false, true,
                    None,
                );

                let _ = update_process_record_step(
                    &conn, id, state_machine::STEP_MANAGER,
                    Some(state_machine::STATUS_IN_PROGRESS),
                    order.manager_id, Some("manager"),
                    None, None,
                    true, false,
                    None,
                );

                let _ = write_audit_trail(
                    &conn, id, "批量消缺", Some(&from_status), Some(to_status),
                    x_user_id.0, &ctx.user_role, item.opinion.as_deref(), None,
                    if all_evidence.is_empty() { None } else { Some(&all_evidence) },
                    order.previous_opinion.as_deref(),
                    order.previous_attachment.as_deref(),
                );

                results.push(BatchResultItem {
                    id,
                    success: true,
                    message: "处理成功".to_string(),
                });
            } else {
                results.push(BatchResultItem {
                    id,
                    success: false,
                    message: "处理失败".to_string(),
                });
            }
        }

        Ok(Json(results))
    }

    #[oai(path = "/patrol-orders/batch-close", method = "post", tag = "PatrolOrders")]
    async fn batch_close(
        &self,
        state: Data<&Arc<AppState>>,
        x_user_id: Header<i64>,
        x_user_role: Header<String>,
        req: Json<BatchCloseRequest>,
    ) -> Result<Json<Vec<BatchResultItem>>, AppError> {
        let ctx = UserContext::new(x_user_id.0, x_user_role.0);
        let conn = state.db.lock().map_err(|_| AppError::internal("锁错误"))?;

        let mut results = Vec::new();

        for item in &req.items {
            let id = item.id;
            let order = match get_patrol_order(&conn, id) {
                Ok(o) => o,
                Err(e) => {
                    results.push(BatchResultItem {
                        id,
                        success: false,
                        message: e.to_string(),
                    });
                    continue;
                }
            };

            let mut error_msg: Option<String> = None;

            if ctx.user_role != "admin" {
                if let Err(e) = ctx.require_manager() {
                    let _ = record_anomaly(&conn, &order, "批量关闭失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
                    error_msg = Some(e.to_string());
                }
                if error_msg.is_none() && !ctx.is_handler(order.manager_id) {
                    let reason = "只有该巡检单的区域负责人可以关闭";
                    let _ = record_anomaly(&conn, &order, "批量关闭失败", x_user_id.0, &ctx.user_role, reason, None);
                    error_msg = Some(reason.to_string());
                }
            }

            if error_msg.is_none() {
                if let Err(e) = state_machine::check_transition(&order.status, "close") {
                    let _ = record_anomaly(&conn, &order, "批量关闭失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
                    error_msg = Some(e.to_string());
                }
            }

            if error_msg.is_none() && ctx.user_role != "admin" && order.current_handler != "manager" {
                let reason = format!("当前处理人是「{}」，不是区域负责人", order.current_handler);
                let _ = record_anomaly(&conn, &order, "批量关闭失败", x_user_id.0, &ctx.user_role, &reason, None);
                error_msg = Some(reason);
            }

            if error_msg.is_none() {
                let (_, is_overdue) = calculate_overdue_level(&order.due_date);
                if !is_overdue && order.is_overdue == 0 {
                    let reason = "该巡检单未逾期，不能通过批量关闭处理";
                    let _ = record_anomaly(&conn, &order, "批量关闭失败", x_user_id.0, &ctx.user_role, reason, None);
                    error_msg = Some(reason.to_string());
                }
            }

            if error_msg.is_none() {
                if let Err(e) = check_version(order.version, item.version) {
                    let _ = record_anomaly(&conn, &order, "批量关闭失败", x_user_id.0, &ctx.user_role, &e.to_string(), None);
                    error_msg = Some(e.to_string());
                }
            }

            if let Some(msg) = error_msg {
                results.push(BatchResultItem {
                    id,
                    success: false,
                    message: msg,
                });
                continue;
            }

            let from_status = order.status.clone();
            let to_status = state_machine::CLOSED;

            let sql = "
                UPDATE patrol_orders
                SET status = ?1, audit_remark = ?2,
                    version = version + 1, updated_at = datetime('now')
                WHERE id = ?3
            ";
            if conn.execute(sql, rusqlite::params![to_status, item.remark, id]).is_ok() {
                let _ = update_process_record_step(
                    &conn, id, state_machine::STEP_MANAGER,
                    Some(state_machine::STATUS_COMPLETED),
                    None, None,
                    item.remark.as_deref(),
                    None,
                    false, true,
                    None,
                );

                let _ = write_audit_trail(
                    &conn, id, "批量关闭逾期单", Some(&from_status), Some(to_status),
                    x_user_id.0, &ctx.user_role, item.remark.as_deref(), None,
                    None,
                    order.previous_opinion.as_deref(),
                    order.previous_attachment.as_deref(),
                );

                results.push(BatchResultItem {
                    id,
                    success: true,
                    message: "关闭成功".to_string(),
                });
            } else {
                results.push(BatchResultItem {
                    id,
                    success: false,
                    message: "关闭失败".to_string(),
                });
            }
        }

        Ok(Json(results))
    }

    #[oai(path = "/patrol-orders/:id/audit-trails", method = "get", tag = "PatrolOrders")]
    async fn audit_trails(
        &self,
        state: Data<&Arc<AppState>>,
        x_user_id: Header<i64>,
        x_user_role: Header<String>,
        id: i64,
    ) -> Result<Json<Vec<AuditTrail>>, AppError> {
        let conn = state.db.lock().map_err(|_| AppError::internal("锁错误"))?;

        let sql = "
            SELECT a.id, a.patrol_order_id, a.action, a.from_status, a.to_status,
                   a.actor_id, u.name, a.actor_role, a.remark, a.anomaly_reason,
                   a.evidence, a.previous_opinion, a.previous_attachment, a.created_at
            FROM audit_trails a
            LEFT JOIN users u ON a.actor_id = u.id
            WHERE a.patrol_order_id = ?1
            ORDER BY a.id
        ";
        let mut stmt = conn.prepare(sql)?;
        let trails = stmt.query_map([id], |row| {
            let evidence_val = row.get::<_, rusqlite::types::Value>(10)?;
            let evidence: Option<Vec<String>> = if matches!(evidence_val, rusqlite::types::Value::Null) {
                None
            } else {
                json_from_row(&evidence_val).ok()
            };
            Ok(AuditTrail {
                id: row.get(0)?,
                patrol_order_id: row.get(1)?,
                action: row.get(2)?,
                from_status: row.get(3).ok(),
                to_status: row.get(4).ok(),
                actor_id: row.get(5)?,
                actor_name: row.get(6).ok(),
                actor_role: row.get(7)?,
                remark: row.get(8).ok(),
                anomaly_reason: row.get(9).ok(),
                evidence,
                previous_opinion: row.get(11).ok(),
                previous_attachment: row.get(12).ok(),
                created_at: row.get(13)?,
            })
        })?;

        let result: Result<Vec<AuditTrail>, _> = trails.collect();
        Ok(Json(result?))
    }
}
use poem::web::Data;
use poem_openapi::{OpenApi, payload::Json, param::Header};
use std::sync::Arc;

use crate::db::{AppState, json_from_row};
use crate::error::AppError;
use crate::middleware::{UserContext, check_version};
use crate::models::*;

fn row_to_patrol_order(row: &rusqlite::Row) -> Result<PatrolOrder, rusqlite::Error> {
    let evidence_val = row.get::<_, rusqlite::types::Value>(14)?;
    let patrol_evidence: Option<Vec<String>> = if matches!(evidence_val, rusqlite::types::Value::Null) {
        None
    } else {
        json_from_row(&evidence_val).ok()
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
        patrol_date: row.get(13)?,
        due_date: row.get(15)?,
        patrol_content: row.get(16).ok(),
        weather: row.get(17).ok(),
        temperature: row.get(18).ok(),
        patrol_evidence,
        defect_count: row.get(19)?,
        version: row.get(20)?,
        previous_handler_id: row.get(21).ok(),
        previous_opinion: row.get(22).ok(),
        previous_attachment: row.get(23).ok(),
        audit_remark: row.get(24).ok(),
        anomaly_reason: row.get(25).ok(),
        is_overdue: row.get(26)?,
        overdue_level: row.get(27).ok(),
        created_at: row.get(28)?,
        updated_at: row.get(29)?,
    })
}

fn get_patrol_order(
    conn: &rusqlite::Connection,
    id: i64,
) -> Result<PatrolOrder, AppError> {
    let sql = "
        SELECT po.id, po.order_no, po.station_id, s.name, po.status, po.priority,
               po.inspector_id, ui.name, po.engineer_id, ue.name, po.manager_id, um.name,
               po.current_handler, po.patrol_date, po.patrol_evidence, po.due_date,
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
    ";
    let mut stmt = conn.prepare(sql)?;
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
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(s) = &status {
            conditions.push("po.status = ?".to_string());
            params.push(Box::new(s.clone()));
        }
        if let Some(ol) = &overdue_level {
            conditions.push("po.overdue_level = ?".to_string());
            params.push(Box::new(ol.clone()));
        }
        if let Some(sid) = station_id {
            conditions.push("po.station_id = ?".to_string());
            params.push(Box::new(sid));
        }
        if let Some(h) = &handler {
            conditions.push("po.current_handler = ?".to_string());
            params.push(Box::new(h.clone()));
        }
        if let Some(kw) = &keyword {
            conditions.push("(po.order_no LIKE ? OR s.name LIKE ?)".to_string());
            params.push(Box::new(format!("%{}%", kw)));
            params.push(Box::new(format!("%{}%", kw)));
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        let sql_base = "
            FROM patrol_orders po
            LEFT JOIN stations s ON po.station_id = s.id
            LEFT JOIN users ui ON po.inspector_id = ui.id
            LEFT JOIN users ue ON po.engineer_id = ue.id
            LEFT JOIN users um ON po.manager_id = um.id
        ";

        let count_sql = format!("SELECT COUNT(*) {}{}", sql_base, where_clause);
        let total: i64 = conn.query_row(&count_sql, rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())), |r| r.get(0))?;

        let select_sql = format!(
            "SELECT po.id, po.order_no, po.station_id, s.name, po.status, po.priority,
                    po.inspector_id, ui.name, po.engineer_id, ue.name, po.manager_id, um.name,
                    po.current_handler, po.patrol_date, po.patrol_evidence, po.due_date,
                    po.patrol_content, po.weather, po.temperature,
                    po.defect_count, po.version, po.previous_handler_id, po.previous_opinion,
                    po.previous_attachment, po.audit_remark, po.anomaly_reason,
                    po.is_overdue, po.overdue_level, po.created_at, po.updated_at
             {} {} ORDER BY po.id DESC LIMIT ? OFFSET ?",
            sql_base, where_clause
        );

        let mut query_params: Vec<Box<dyn rusqlite::ToSql>> = params.clone();
        query_params.push(Box::new(page_size));
        query_params.push(Box::new(offset));

        let mut stmt = conn.prepare(&select_sql)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(query_params.iter().map(|p| p.as_ref())), |row| row_to_patrol_order(row))?;
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

        let stats: DueGroupStats = conn.query_row(
            &group_stats_sql,
            rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())),
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

        Ok(Json(PatrolOrderDetail {
            order,
            defects,
            attachments,
            process_records,
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

        let order_no = generate_order_no();
        let priority = req.priority.clone().unwrap_or_else(|| "medium".to_string());
        let (overdue_level, is_overdue) = calculate_overdue_level(&req.due_date);

        let sql = "
            INSERT INTO patrol_orders (order_no, station_id, status, priority, inspector_id, manager_id,
                                        current_handler, patrol_date, due_date, patrol_content,
                                        is_overdue, overdue_level)
            VALUES (?1, ?2, 'pending_dispatch', ?3, ?4, ?5, 'inspector', ?6, ?7, ?8, ?9, ?10)
        ";
        conn.execute(sql, rusqlite::params![
            order_no, req.station_id, priority, req.inspector_id, req.manager_id,
            req.patrol_date, req.due_date, req.patrol_content,
            if is_overdue { 1 } else { 0 }, overdue_level
        ])?;

        let id = conn.last_insert_rowid();

        let process_sql = "
            INSERT INTO process_records (patrol_order_id, step_order, step_name, handler_id, handler_role, status, started_at)
            VALUES (?1, 1, '站点巡检员补齐材料', ?2, ?3, 'in_progress', datetime('now'))
        ";
        conn.execute(process_sql, rusqlite::params![id, x_user_id.0, ctx.user_role])?;
        let process_sql2 = "
            INSERT INTO process_records (patrol_order_id, step_order, step_name, status)
            VALUES (?1, 2, '运维工程师办理', 'pending')
        ";
        conn.execute(process_sql2, [id])?;
        let process_sql3 = "
            INSERT INTO process_records (patrol_order_id, step_order, step_name, status)
            VALUES (?1, 3, '区域负责人收口', 'pending')
        ";
        conn.execute(process_sql3, [id])?;

        write_audit_trail(
            &conn, id, "创建巡检单", None, Some("pending_dispatch"),
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
        check_version(order.version, req.version)?;

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
            let proc_sql = "
                UPDATE process_records
                SET correction_note = COALESCE(correction_note, '') || ?1
                WHERE patrol_order_id = ?2 AND step_order = 1
            ";
            conn.execute(proc_sql, rusqlite::params![format!("\n{}", note), id])?;
        }

        write_audit_trail(
            &conn, id, "更新巡检单", Some(&order.status), Some(&order.status),
            x_user_id.0, &ctx.user_role, None, None,
            req.patrol_evidence.as_ref(), None, None
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
            ctx.require_inspector()?;
            if !ctx.is_handler(order.inspector_id) {
                return Err(AppError::forbidden("只有该巡检单的巡检员可以提交"));
            }
        }

        check_version(order.version, req.version)?;

        let has_content = req.patrol_content.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false)
            || order.patrol_content.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false);
        let has_weather = req.weather.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false)
            || order.weather.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false);
        let has_temp = req.temperature.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false)
            || order.temperature.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false);
        let has_evidence = req.patrol_evidence.as_ref().map(|e| !e.is_empty()).unwrap_or(false)
            || order.patrol_evidence.as_ref().map(|e| !e.is_empty()).unwrap_or(false);

        if !(has_content && has_weather && has_temp && has_evidence) {
            let reason = "巡检材料不完整: patrol_content, weather, temperature, patrol_evidence 至少需要一项";
            write_audit_trail(
                &conn, id, "提交失败", Some(&order.status), Some(&order.status),
                x_user_id.0, &ctx.user_role, None, Some(reason),
                req.patrol_evidence.as_ref(), None, None
            )?;
            let anomaly_sql = "UPDATE patrol_orders SET anomaly_reason = ?1 WHERE id = ?2";
            conn.execute(anomaly_sql, rusqlite::params![reason, id])?;
            return Err(AppError::bad_request(reason));
        }

        let evidence_json = req.patrol_evidence.as_ref().map(|e| serde_json::to_string(e).unwrap_or_default());
        let new_status = if order.status == "returned" { "in_progress" } else { &order.status };
        let from_status = order.status.clone();

        let sql = "
            UPDATE patrol_orders
            SET patrol_content = COALESCE(?1, patrol_content),
                weather = COALESCE(?2, weather),
                temperature = COALESCE(?3, temperature),
                patrol_evidence = COALESCE(?4, patrol_evidence),
                status = ?5,
                version = version + 1,
                updated_at = datetime('now')
            WHERE id = ?6
        ";
        conn.execute(sql, rusqlite::params![
            req.patrol_content, req.weather, req.temperature, evidence_json, new_status, id
        ])?;

        let proc_sql = "
            UPDATE process_records
            SET status = 'completed', finished_at = datetime('now'), opinion = '巡检材料已提交'
            WHERE patrol_order_id = ?1 AND step_order = 1
        ";
        conn.execute(proc_sql, [id])?;

        let action = if from_status == "returned" { "补正提交" } else { "提交巡检材料" };
        write_audit_trail(
            &conn, id, action, Some(&from_status), Some(new_status),
            x_user_id.0, &ctx.user_role, Some("巡检材料已提交"), None,
            req.patrol_evidence.as_ref(), None, None
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

        if ctx.user_role != "admin" {
            ctx.require_manager()?;
        }

        let order = get_patrol_order(&conn, id)?;
        check_version(order.version, req.version)?;

        let from_status = order.status.clone();
        let sql = "
            UPDATE patrol_orders
            SET engineer_id = ?1,
                current_handler = 'engineer',
                status = 'in_progress',
                previous_handler_id = ?2,
                version = version + 1,
                updated_at = datetime('now')
            WHERE id = ?3
        ";
        conn.execute(sql, rusqlite::params![req.engineer_id, x_user_id.0, id])?;

        let proc_sql = "
            UPDATE process_records
            SET handler_id = ?1, handler_role = 'engineer', status = 'in_progress', started_at = datetime('now')
            WHERE patrol_order_id = ?2 AND step_order = 2
        ";
        conn.execute(proc_sql, rusqlite::params![req.engineer_id, id])?;

        write_audit_trail(
            &conn, id, "派发工程师", Some(&from_status), Some("in_progress"),
            x_user_id.0, &ctx.user_role, req.remark.as_deref(), None,
            None, None, None
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
            ctx.require_engineer()?;
            if !ctx.is_handler(order.engineer_id) {
                return Err(AppError::forbidden("只有该巡检单的工程师可以办理"));
            }
        }

        check_version(order.version, req.version)?;

        if req.defect_evidences.is_empty() {
            let reason = "办理失败: 缺少缺陷消缺证据";
            write_audit_trail(
                &conn, id, "办理失败", Some(&order.status), Some(&order.status),
                x_user_id.0, &ctx.user_role, None, Some(reason),
                None, None, None
            )?;
            let anomaly_sql = "UPDATE patrol_orders SET anomaly_reason = ?1 WHERE id = ?2";
            conn.execute(anomaly_sql, rusqlite::params![reason, id])?;
            return Err(AppError::bad_request(reason));
        }

        for (defect_no, evidence) in &req.defect_evidences {
            if evidence.is_empty() {
                let reason = format!("缺陷 {} 缺少消缺证据", defect_no);
                write_audit_trail(
                    &conn, id, "办理失败", Some(&order.status), Some(&order.status),
                    x_user_id.0, &ctx.user_role, None, Some(&reason),
                    None, None, None
                )?;
                let anomaly_sql = "UPDATE patrol_orders SET anomaly_reason = ?1 WHERE id = ?2";
                conn.execute(anomaly_sql, rusqlite::params![reason, id])?;
                return Err(AppError::bad_request(format!("缺陷 {} 缺少消缺证据", defect_no)));
            }
            let evidence_json = serde_json::to_string(evidence).unwrap_or_default();
            let defect_sql = "
                UPDATE defect_reports
                SET status = 'resolved', evidence = ?1, version = version + 1, updated_at = datetime('now')
                WHERE defect_no = ?2 AND patrol_order_id = ?3
            ";
            conn.execute(defect_sql, rusqlite::params![evidence_json, defect_no, id])?;
        }

        let from_status = order.status.clone();
        let all_evidence: Vec<String> = req.defect_evidences.values().flatten().cloned().collect();

        let sql = "
            UPDATE patrol_orders
            SET status = 'reviewing',
                current_handler = 'manager',
                previous_handler_id = ?1,
                previous_opinion = ?2,
                version = version + 1,
                updated_at = datetime('now')
            WHERE id = ?3
        ";
        conn.execute(sql, rusqlite::params![x_user_id.0, req.opinion, id])?;

        let proc_sql = "
            UPDATE process_records
            SET status = 'completed', finished_at = datetime('now'), opinion = ?1, evidence = ?2
            WHERE patrol_order_id = ?3 AND step_order = 2
        ";
        let evidence_json = serde_json::to_string(&all_evidence).unwrap_or_default();
        conn.execute(proc_sql, rusqlite::params![req.opinion, evidence_json, id])?;

        let proc_sql2 = "
            UPDATE process_records
            SET handler_id = ?1, handler_role = 'manager', status = 'in_progress', started_at = datetime('now')
            WHERE patrol_order_id = ?2 AND step_order = 3
        ";
        conn.execute(proc_sql2, rusqlite::params![order.manager_id, id])?;

        write_audit_trail(
            &conn, id, "消缺完成", Some(&from_status), Some("reviewing"),
            x_user_id.0, &ctx.user_role, req.opinion.as_deref(), None,
            Some(&all_evidence), None, None
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

        if ctx.user_role != "admin" {
            ctx.require_role(&["engineer", "manager"])?;
        }

        let order = get_patrol_order(&conn, id)?;
        check_version(order.version, req.version)?;

        let from_status = order.status.clone();

        let sql = "
            UPDATE patrol_orders
            SET status = 'returned',
                current_handler = 'inspector',
                previous_handler_id = ?1,
                previous_opinion = ?2,
                previous_attachment = ?3,
                version = version + 1,
                updated_at = datetime('now')
            WHERE id = ?4
        ";
        conn.execute(sql, rusqlite::params![x_user_id.0, req.opinion, req.attachment, id])?;

        write_audit_trail(
            &conn, id, "退回补正", Some(&from_status), Some("returned"),
            x_user_id.0, &ctx.user_role, Some(&req.opinion), None,
            None, Some(&req.opinion), req.attachment.as_deref()
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

        if ctx.user_role != "admin" {
            ctx.require_manager()?;
        }

        let order = get_patrol_order(&conn, id)?;
        check_version(order.version, req.version)?;

        let from_status = order.status.clone();
        let to_status = if req.result == "pass" { "closed" } else { "returned" };
        let current_handler = if req.result == "pass" { "inspector" } else { "engineer" };

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
            to_status, current_handler, x_user_id.0, req.remark, req.remark, id
        ])?;

        if to_status == "closed" {
            let proc_sql = "
                UPDATE process_records
                SET status = 'completed', finished_at = datetime('now'), opinion = ?1
                WHERE patrol_order_id = ?2 AND step_order = 3
            ";
            conn.execute(proc_sql, rusqlite::params![req.remark, id])?;
        }

        let action = if to_status == "closed" { "复核通过" } else { "复核退回" };
        write_audit_trail(
            &conn, id, action, Some(&from_status), Some(to_status),
            x_user_id.0, &ctx.user_role, req.remark.as_deref(), None,
            None, order.previous_opinion.as_deref(), order.previous_attachment.as_deref()
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
            match (|| -> Result<(), AppError> {
                if ctx.user_role != "admin" {
                    ctx.require_engineer()?;
                }
                let order = get_patrol_order(&conn, id)?;
                if ctx.user_role != "admin" && !ctx.is_handler(order.engineer_id) {
                    return Err(AppError::forbidden("不是当前处理人"));
                }
                check_version(order.version, item.version)?;
                Ok(())
            })() {
                Ok(_) => {
                    if let Some(evidences) = &item.defect_evidences {
                        for (defect_no, evidence) in evidences {
                            if evidence.is_empty() {
                                results.push(BatchResultItem {
                                    id,
                                    success: false,
                                    message: format!("缺陷 {} 缺少消缺证据", defect_no),
                                });
                                continue;
                            }
                            let evidence_json = serde_json::to_string(evidence).unwrap_or_default();
                            let defect_sql = "
                                UPDATE defect_reports
                                SET status = 'resolved', evidence = ?1, version = version + 1, updated_at = datetime('now')
                                WHERE defect_no = ?2 AND patrol_order_id = ?3
                            ";
                            conn.execute(defect_sql, rusqlite::params![evidence_json, defect_no, id]).ok();
                        }
                    }

                    let from_status = conn.query_row("SELECT status FROM patrol_orders WHERE id = ?1", [id], |r| r.get::<_, String>(0)).unwrap_or_default();
                    let sql = "
                        UPDATE patrol_orders
                        SET status = 'reviewing', current_handler = 'manager',
                            previous_handler_id = ?1, previous_opinion = ?2,
                            version = version + 1, updated_at = datetime('now')
                        WHERE id = ?3
                    ";
                    conn.execute(sql, rusqlite::params![x_user_id.0, item.opinion, id]).ok();

                    write_audit_trail(
                        &conn, id, "批量消缺", Some(&from_status), Some("reviewing"),
                        x_user_id.0, &ctx.user_role, item.opinion.as_deref(), None,
                        None, None, None
                    ).ok();

                    results.push(BatchResultItem {
                        id,
                        success: true,
                        message: "处理成功".to_string(),
                    });
                }
                Err(e) => {
                    results.push(BatchResultItem {
                        id,
                        success: false,
                        message: match e {
                            AppError::Conflict(msg) => msg.message,
                            AppError::Forbidden(msg) => msg.message,
                            AppError::NotFound(msg) => msg.message,
                            _ => "处理失败".to_string(),
                        },
                    });
                }
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
            match (|| -> Result<(), AppError> {
                if ctx.user_role != "admin" {
                    ctx.require_manager()?;
                }
                let order = get_patrol_order(&conn, id)?;
                let (_, is_overdue) = calculate_overdue_level(&order.due_date);
                if !is_overdue && order.is_overdue == 0 {
                    return Err(AppError::bad_request("该巡检单未逾期，不能通过批量关闭处理"));
                }
                check_version(order.version, item.version)?;
                Ok(())
            })() {
                Ok(_) => {
                    let from_status = conn.query_row("SELECT status FROM patrol_orders WHERE id = ?1", [id], |r| r.get::<_, String>(0)).unwrap_or_default();
                    let sql = "
                        UPDATE patrol_orders
                        SET status = 'closed', audit_remark = ?1,
                            version = version + 1, updated_at = datetime('now')
                        WHERE id = ?2
                    ";
                    conn.execute(sql, rusqlite::params![item.remark, id]).ok();

                    write_audit_trail(
                        &conn, id, "批量关闭逾期单", Some(&from_status), Some("closed"),
                        x_user_id.0, &ctx.user_role, item.remark.as_deref(), None,
                        None, None, None
                    ).ok();

                    results.push(BatchResultItem {
                        id,
                        success: true,
                        message: "关闭成功".to_string(),
                    });
                }
                Err(e) => {
                    results.push(BatchResultItem {
                        id,
                        success: false,
                        message: match e {
                            AppError::Conflict(msg) => msg.message,
                            AppError::BadRequest(msg) => msg.message,
                            AppError::Forbidden(msg) => msg.message,
                            AppError::NotFound(msg) => msg.message,
                            _ => "处理失败".to_string(),
                        },
                    });
                }
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

use chrono::{Duration, Local, NaiveDateTime};
use poem::web::Data;
use poem_openapi::{OpenApi, payload::Json, param::Header};
use std::sync::Arc;

use crate::db::{AppState, json_from_row};
use crate::error::AppError;
use crate::middleware::{UserContext, check_version};
use crate::models::*;

pub struct DefectsApi;

#[OpenApi]
impl DefectsApi {
    #[oai(path = "/defects", method = "post", tag = "Defects")]
    async fn create(
        &self,
        state: Data<&Arc<AppState>>,
        x_user_id: Header<i64>,
        x_user_role: Header<String>,
        req: Json<CreateDefectRequest>,
    ) -> Result<Json<DefectReport>, AppError> {
        let ctx = UserContext::new(x_user_id.0, x_user_role.0);
        let conn = state.db.lock().map_err(|_| AppError::internal("锁错误"))?;

        let patrol_start: String = conn.query_row(
            "SELECT patrol_date FROM patrol_orders WHERE id = ?1",
            [req.patrol_order_id],
            |r| r.get(0),
        ).map_err(|_| AppError::not_found("巡检单不存在"))?;

        let patrol_start_dt = NaiveDateTime::parse_from_str(
            &format!("{} 00:00:00", patrol_start), "%Y-%m-%d %H:%M:%S"
        ).unwrap_or_else(|_| Local::now().naive_local());

        let now = Local::now().naive_local();
        let diff = now - patrol_start_dt;
        let mut anomaly: Option<String> = None;
        if diff > Duration::hours(24) {
            anomaly = Some(format!("上报超时：距巡检开始已超过24小时（{}小时）", diff.num_hours()));
        }

        if ctx.user_role != "admin" {
            ctx.require_inspector()?;
        }

        let defect_no = generate_defect_no();
        let evidence_json = req.evidence.as_ref().map(|e| serde_json::to_string(e).unwrap_or_default());

        let sql = "
            INSERT INTO defect_reports (patrol_order_id, defect_no, location, description, severity,
                                         category, deadline, reporter_id, evidence, anomaly_reason)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        ";
        conn.execute(sql, rusqlite::params![
            req.patrol_order_id, defect_no, req.location, req.description,
            req.severity, req.category, req.deadline, x_user_id.0, evidence_json, anomaly
        ])?;

        let defect_id = conn.last_insert_rowid();

        let count_sql = "SELECT COUNT(*) FROM defect_reports WHERE patrol_order_id = ?1";
        let count: i64 = conn.query_row(count_sql, [req.patrol_order_id], |r| r.get(0))?;
        let update_sql = "UPDATE patrol_orders SET defect_count = ?1, updated_at = datetime('now') WHERE id = ?2";
        conn.execute(update_sql, rusqlite::params![count, req.patrol_order_id])?;

        if let Some(reason) = &anomaly {
            let audit_sql = "
                INSERT INTO audit_trails (patrol_order_id, action, from_status, to_status, actor_id, actor_role, anomaly_reason)
                SELECT ?1, '缺陷上报超时', status, status, ?2, ?3, ?4
                FROM patrol_orders WHERE id = ?1
            ";
            conn.execute(audit_sql, rusqlite::params![req.patrol_order_id, x_user_id.0, ctx.user_role, reason]).ok();
        }

        let result = conn.query_row(
            "SELECT d.id, d.patrol_order_id, d.defect_no, d.location, d.description, d.severity,
                    d.category, d.reported_at, d.deadline, d.status, d.reporter_id, ur.name,
                    d.assignee_id, ua.name, d.evidence, d.anomaly_reason, d.version,
                    d.created_at, d.updated_at
             FROM defect_reports d
             LEFT JOIN users ur ON d.reporter_id = ur.id
             LEFT JOIN users ua ON d.assignee_id = ua.id
             WHERE d.id = ?1",
            [defect_id],
            |row| {
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
            },
        )?;

        Ok(Json(result))
    }

    #[oai(path = "/defects/:id", method = "put", tag = "Defects")]
    async fn update(
        &self,
        state: Data<&Arc<AppState>>,
        x_user_id: Header<i64>,
        x_user_role: Header<String>,
        id: i64,
        req: Json<UpdateDefectRequest>,
    ) -> Result<Json<DefectReport>, AppError> {
        let ctx = UserContext::new(x_user_id.0, x_user_role.0);
        let conn = state.db.lock().map_err(|_| AppError::internal("锁错误"))?;

        let (current_version, patrol_order_id): (i64, i64) = conn.query_row(
            "SELECT version, patrol_order_id FROM defect_reports WHERE id = ?1",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        ).map_err(|_| AppError::not_found("缺陷不存在"))?;

        check_version(current_version, req.version)?;

        let evidence_json = req.evidence.as_ref().map(|e| serde_json::to_string(e).unwrap_or_default());

        let sql = "
            UPDATE defect_reports
            SET location = COALESCE(?1, location),
                description = COALESCE(?2, description),
                severity = COALESCE(?3, severity),
                category = COALESCE(?4, category),
                deadline = COALESCE(?5, deadline),
                status = COALESCE(?6, status),
                assignee_id = COALESCE(?7, assignee_id),
                evidence = COALESCE(?8, evidence),
                version = version + 1,
                updated_at = datetime('now')
            WHERE id = ?9
        ";
        conn.execute(sql, rusqlite::params![
            req.location, req.description, req.severity, req.category,
            req.deadline, req.status, req.assignee_id, evidence_json, id
        ])?;

        let result = conn.query_row(
            "SELECT d.id, d.patrol_order_id, d.defect_no, d.location, d.description, d.severity,
                    d.category, d.reported_at, d.deadline, d.status, d.reporter_id, ur.name,
                    d.assignee_id, ua.name, d.evidence, d.anomaly_reason, d.version,
                    d.created_at, d.updated_at
             FROM defect_reports d
             LEFT JOIN users ur ON d.reporter_id = ur.id
             LEFT JOIN users ua ON d.assignee_id = ua.id
             WHERE d.id = ?1",
            [id],
            |row| {
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
            },
        )?;

        Ok(Json(result))
    }
}

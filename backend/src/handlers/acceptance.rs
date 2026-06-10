use poem::web::Data;
use poem_openapi::{OpenApi, payload::Json, param::Header};
use std::sync::Arc;

use crate::db::{AppState, json_from_row};
use crate::error::AppError;
use crate::middleware::UserContext;
use crate::models::*;

pub struct AcceptanceApi;

#[OpenApi]
impl AcceptanceApi {
    #[oai(path = "/acceptance", method = "post", tag = "Acceptance")]
    async fn create(
        &self,
        state: Data<&Arc<AppState>>,
        x_user_id: Header<i64>,
        x_user_role: Header<String>,
        req: Json<AcceptanceRequest>,
    ) -> Result<Json<AcceptanceRecord>, AppError> {
        let ctx = UserContext::new(x_user_id.0, x_user_role.0);
        let conn = state.db.lock().map_err(|_| AppError::internal("锁错误"))?;

        let order_sql = "
            SELECT po.status, po.current_handler, po.manager_id
            FROM patrol_orders po
            WHERE po.id = ?1
        ";
        let (order_status, current_handler, manager_id): (String, String, Option<i64>) = conn
            .query_row(order_sql, [req.patrol_order_id], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2).ok()))
            })
            .map_err(|_| AppError::not_found("巡检单不存在"))?;

        fn record_acceptance_anomaly(
            conn: &rusqlite::Connection,
            patrol_order_id: i64,
            order_status: &str,
            actor_id: i64,
            actor_role: &str,
            reason: &str,
            evidence: Option<&Vec<String>>,
        ) {
            let evidence_json = evidence.map(|e| serde_json::to_string(e).unwrap_or_default());
            let _ = conn.execute(
                "
                    INSERT INTO audit_trails (patrol_order_id, action, from_status, to_status, actor_id, actor_role, anomaly_reason, evidence)
                    VALUES (?1, '验收失败', ?2, ?2, ?3, ?4, ?5, ?6)
                ",
                rusqlite::params![patrol_order_id, order_status, actor_id, actor_role, reason, evidence_json],
            );
            let _ = conn.execute(
                "UPDATE patrol_orders SET anomaly_reason = ?1 WHERE id = ?2",
                rusqlite::params![reason, patrol_order_id],
            );
        }

        if ctx.user_role != "admin" {
            if let Err(e) = ctx.require_manager() {
                record_acceptance_anomaly(&conn, req.patrol_order_id, &order_status, x_user_id.0, &ctx.user_role, &e.to_string(), Some(&req.evidence));
                return Err(e);
            }
            if !ctx.is_handler(manager_id) {
                let reason = "只有该巡检单的区域负责人可以验收";
                record_acceptance_anomaly(&conn, req.patrol_order_id, &order_status, x_user_id.0, &ctx.user_role, reason, Some(&req.evidence));
                return Err(AppError::forbidden(reason));
            }
        }

        if !state_machine::can_acceptance(&order_status) {
            let reason = format!("状态冲突：当前状态「{}」不允许验收", state_machine::status_label(&order_status));
            record_acceptance_anomaly(&conn, req.patrol_order_id, &order_status, x_user_id.0, &ctx.user_role, &reason, Some(&req.evidence));
            return Err(AppError::bad_request(reason));
        }

        if ctx.user_role != "admin" && current_handler != "manager" {
            let reason = format!("当前处理人是「{}」，不是区域负责人", current_handler);
            record_acceptance_anomaly(&conn, req.patrol_order_id, &order_status, x_user_id.0, &ctx.user_role, &reason, Some(&req.evidence));
            return Err(AppError::forbidden(reason));
        }

        if req.evidence.is_empty() {
            let reason = "验收失败: 缺少验收证据";
            record_acceptance_anomaly(&conn, req.patrol_order_id, &order_status, x_user_id.0, &ctx.user_role, reason, None);
            return Err(AppError::bad_request(reason));
        }

        let evidence_json = serde_json::to_string(&req.evidence).unwrap_or_default();

        let sql = "
            INSERT INTO acceptance_records (defect_id, patrol_order_id, result, evidence, remark, acceptor_id)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        ";
        conn.execute(sql, rusqlite::params![
            req.defect_id, req.patrol_order_id, req.result, evidence_json, req.remark, x_user_id.0
        ])?;

        if req.result == "pass" {
            let defect_sql = "UPDATE defect_reports SET status = 'verified', version = version + 1, updated_at = datetime('now') WHERE id = ?1";
            conn.execute(defect_sql, [req.defect_id])?;
        } else if req.result == "fail" {
            let defect_sql = "UPDATE defect_reports SET status = 'rejected', version = version + 1, updated_at = datetime('now') WHERE id = ?1";
            conn.execute(defect_sql, [req.defect_id])?;
        }

        let id = conn.last_insert_rowid();

        let action = if req.result == "pass" { "验收通过" } else { "验收不通过" };
        let _ = conn.execute(
            "
                INSERT INTO audit_trails (patrol_order_id, action, from_status, to_status, actor_id, actor_role, remark, evidence)
                VALUES (?1, ?2, ?3, ?3, ?4, ?5, ?6, ?7)
            ",
            rusqlite::params![
                req.patrol_order_id, action, order_status, x_user_id.0, ctx.user_role, req.remark, evidence_json
            ],
        );

        let result = conn.query_row(
            "SELECT a.id, a.defect_id, a.patrol_order_id, a.result, a.evidence, a.remark,
                    a.acceptor_id, u.name, a.accepted_at, a.anomaly_reason
             FROM acceptance_records a
             LEFT JOIN users u ON a.acceptor_id = u.id
             WHERE a.id = ?1",
            [id],
            |row| {
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
            },
        )?;

        Ok(Json(result))
    }
}

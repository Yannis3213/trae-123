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

        if ctx.user_role != "admin" {
            ctx.require_manager()?;
        }

        if req.evidence.is_empty() {
            let reason = "验收失败: 缺少验收证据";
            let audit_sql = "
                INSERT INTO audit_trails (patrol_order_id, action, from_status, to_status, actor_id, actor_role, anomaly_reason)
                SELECT ?1, '验收失败', status, status, ?2, ?3, ?4
                FROM patrol_orders WHERE id = ?1
            ";
            conn.execute(audit_sql, rusqlite::params![req.patrol_order_id, x_user_id.0, ctx.user_role, reason]).ok();
            let anomaly_sql = "UPDATE patrol_orders SET anomaly_reason = ?1 WHERE id = ?2";
            conn.execute(anomaly_sql, rusqlite::params![reason, req.patrol_order_id]).ok();
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

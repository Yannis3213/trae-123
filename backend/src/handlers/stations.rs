use poem::web::Data;
use poem_openapi::{OpenApi, Object, payload::Json, param::Header};
use std::sync::Arc;

use crate::db::AppState;
use crate::error::AppError;
use crate::models::Station;

#[derive(Object)]
pub struct StationListResponse {
    pub items: Vec<Station>,
}

pub struct StationsApi;

#[OpenApi]
impl StationsApi {
    #[oai(path = "/stations", method = "get", tag = "Stations")]
    async fn list_stations(
        &self,
        state: Data<&Arc<AppState>>,
        x_user_id: Header<i64>,
        x_user_role: Header<String>,
    ) -> Result<Json<StationListResponse>, AppError> {
        let conn = state.db.lock().map_err(|_| AppError::internal("锁错误"))?;

        let mut stmt = conn.prepare(
            "SELECT id, code, name, region, capacity_mw, created_at FROM stations ORDER BY id"
        )?;

        let stations = stmt.query_map([], |row| {
            Ok(Station {
                id: row.get(0)?,
                code: row.get(1)?,
                name: row.get(2)?,
                region: row.get(3)?,
                capacity_mw: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;

        let result: Result<Vec<Station>, _> = stations.collect();
        Ok(Json(StationListResponse { items: result? }))
    }
}

use poem::web::Data;
use poem_openapi::{OpenApi, Object, payload::Json, param::Header};
use std::sync::Arc;

use crate::db::AppState;
use crate::error::AppError;
use crate::models::User;

#[derive(Object)]
pub struct UserListResponse {
    pub items: Vec<User>,
}

pub struct UsersApi;

#[OpenApi]
impl UsersApi {
    #[oai(path = "/users", method = "get", tag = "Users")]
    async fn list_users(
        &self,
        state: Data<&Arc<AppState>>,
        x_user_id: Header<i64>,
        x_user_role: Header<String>,
    ) -> Result<Json<UserListResponse>, AppError> {
        let conn = state.db.lock().map_err(|_| AppError::internal("锁错误"))?;

        let mut stmt = conn.prepare(
            "SELECT id, username, role, name, region, created_at FROM users ORDER BY id"
        )?;

        let users = stmt.query_map([], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                role: row.get(2)?,
                name: row.get(3)?,
                region: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;

        let result: Result<Vec<User>, _> = users.collect();
        Ok(Json(UserListResponse { items: result? }))
    }
}

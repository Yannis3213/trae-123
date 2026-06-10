use poem::web::Data;
use poem_openapi::{OpenApi, payload::Json};
use std::sync::Arc;

use crate::db::AppState;
use crate::error::AppError;
use crate::models::{LoginRequest, LoginResponse, User};

pub struct AuthApi;

#[OpenApi]
impl AuthApi {
    #[oai(path = "/auth/login", method = "post", tag = "Auth")]
    async fn login(
        &self,
        state: Data<&Arc<AppState>>,
        req: Json<LoginRequest>,
    ) -> Result<Json<LoginResponse>, AppError> {
        let conn = state.db.lock().map_err(|_| AppError::internal("锁错误"))?;

        let mut stmt = conn.prepare(
            "SELECT id, username, password, role, name, region, created_at FROM users WHERE username = ?1"
        )?;

        let user_result = stmt.query_row([&req.username], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                role: row.get(3)?,
                name: row.get(4)?,
                region: row.get(5)?,
                created_at: row.get(6)?,
            })
        });

        let user = user_result.map_err(|_| AppError::unauthorized("用户名或密码错误"))?;

        let stored_pwd: String = conn.query_row(
            "SELECT password FROM users WHERE username = ?1",
            [&req.username],
            |row| row.get(0),
        )?;

        if stored_pwd != req.password {
            return Err(AppError::unauthorized("用户名或密码错误"));
        }

        let token = format!("token_{}", user.username);

        Ok(Json(LoginResponse { user, token }))
    }
}

use axum::{extract::State, Json};
use crate::db::DbPool;
use crate::error::AppError;
use crate::middleware::AuthUser;
use crate::models::{LoginPayload, User};

pub async fn login(
    State(pool): State<DbPool>,
    Json(payload): Json<LoginPayload>,
) -> Result<Json<User>, AppError> {
    let conn = pool.lock().await;
    let user = conn
        .query_row(
            "SELECT id, username, display_name, role FROM users WHERE username = ?1",
            rusqlite::params![payload.username],
            |row| {
                Ok(User {
                    id: row.get(0)?,
                    username: row.get(1)?,
                    display_name: row.get(2)?,
                    role: row.get(3)?,
                })
            },
        )
        .map_err(|_| AppError::NotFound(format!("User '{}' not found", payload.username)))?;

    Ok(Json(user))
}

pub async fn me(user: AuthUser) -> Result<Json<User>, AppError> {
    Ok(Json(User {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
    }))
}

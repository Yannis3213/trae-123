use axum::{
    extract::{FromRequestParts, Request},
    http::request::Parts,
    middleware::Next,
    response::Response,
};
use crate::db::DbPool;
use crate::error::AppError;

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: i64,
    pub username: String,
    pub display_name: String,
    pub role: String,
}

impl FromRequestParts<DbPool> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &DbPool,
    ) -> Result<Self, Self::Rejection> {
        let username = parts
            .headers
            .get("X-User-Id")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| AppError::Unauthorized("Missing X-User-Id header".into()))?;

        let conn = state.lock().await;
        let user = conn
            .query_row(
                "SELECT id, username, display_name, role FROM users WHERE username = ?1",
                rusqlite::params![username],
                |row| {
                    Ok(AuthUser {
                        id: row.get(0)?,
                        username: row.get(1)?,
                        display_name: row.get(2)?,
                        role: row.get(3)?,
                    })
                },
            )
            .map_err(|_| AppError::Unauthorized("User not found".into()))?;

        Ok(user)
    }
}

#[derive(Debug, Clone)]
pub struct RequireRole {
    pub allowed_roles: Vec<String>,
}

impl RequireRole {
    pub fn new(roles: &[&str]) -> Self {
        RequireRole {
            allowed_roles: roles.iter().map(|r| r.to_string()).collect(),
        }
    }

    pub async fn filter(
        &self,
        req: Request,
        next: Next,
    ) -> Result<Response, AppError> {
        let pool = req
            .extensions()
            .get::<DbPool>()
            .cloned()
            .ok_or_else(|| AppError::Internal("Database pool not available".into()))?;

        let username = req
            .headers()
            .get("X-User-Id")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| AppError::Unauthorized("Missing X-User-Id header".into()))?;

        let conn = pool.lock().await;
        let user_role: String = conn
            .query_row(
                "SELECT role FROM users WHERE username = ?1",
                rusqlite::params![username],
                |row| row.get(0),
            )
            .map_err(|_| AppError::Unauthorized("User not found".into()))?;
        drop(conn);

        if !self.allowed_roles.contains(&user_role) {
            return Err(AppError::Forbidden(format!(
                "Role '{}' is not allowed. Required: {:?}",
                user_role, self.allowed_roles
            )));
        }

        Ok(next.run(req).await)
    }
}

pub fn require_role(roles: &[&str]) -> RequireRole {
    RequireRole::new(roles)
}

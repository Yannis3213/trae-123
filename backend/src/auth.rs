use axum::{
    extract::Extension,
    async_trait,
    extract::FromRequestParts,
    http::{request::Parts, HeaderMap},
    Json,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use sqlx::SqlitePool;
use uuid::Uuid;
use std::env;
use serde::Serialize;
use chrono::{Duration, Utc};

use crate::error::AppError;
use crate::models::{Claims, User, UserRole, LoginRequest, LoginResponse};

pub struct AuthUser {
    pub id: Uuid,
    pub username: String,
    pub role: UserRole,
    pub display_name: String,
}

impl AuthUser {
    pub fn is_registrar(&self) -> bool {
        matches!(self.role, UserRole::Registrar)
    }

    pub fn is_auditor(&self) -> bool {
        matches!(self.role, UserRole::Auditor)
    }

    pub fn is_reviewer(&self) -> bool {
        matches!(self.role, UserRole::Reviewer)
    }
}

fn extract_bearer_token(headers: &HeaderMap) -> Option<&str> {
    let auth_header = headers.get("Authorization")?.to_str().ok()?;
    if auth_header.starts_with("Bearer ") {
        Some(&auth_header[7..])
    } else {
        None
    }
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let token = extract_bearer_token(&parts.headers)
            .ok_or_else(|| AppError::AuthError("缺少或无效的 Authorization 请求头".to_string()))?;

        let secret = env::var("JWT_SECRET").unwrap_or_else(|_| "travel-agency-secret-key".to_string());
        
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(secret.as_bytes()),
            &Validation::default(),
        )
        .map_err(|e| AppError::AuthError(format!("无效的 Token: {}", e)))?;

        let role = UserRole::from_str(&token_data.claims.role)
            .ok_or_else(|| AppError::AuthError("Token 中的用户角色无效".to_string()))?;

        Ok(AuthUser {
            id: Uuid::parse_str(&token_data.claims.sub)
                .map_err(|_| AppError::AuthError("Token 中的用户 ID 无效".to_string()))?,
            username: token_data.claims.username,
            role,
            display_name: token_data.claims.display_name,
        })
    }
}

pub async fn login(
    Extension(pool): Extension<SqlitePool>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, AppError> {
    let user_record: Option<UserRecord> = sqlx::query_as::<_, UserRecord>(
        "SELECT id, username, password_hash, role, display_name, created_at FROM users WHERE username = ?"
    )
    .bind(&req.username)
    .fetch_optional(&pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let user = match user_record {
        Some(r) => User {
            id: Uuid::parse_str(&r.id).unwrap(),
            username: r.username,
            role: UserRole::from_str(&r.role).unwrap(),
            display_name: r.display_name,
            password_hash: r.password_hash,
            created_at: chrono::DateTime::parse_from_rfc3339(&r.created_at).unwrap().with_timezone(&Utc),
        },
        None => return Err(AppError::AuthError("用户名或密码错误".to_string())),
    };

    let valid = bcrypt::verify(&req.password, &user.password_hash)
        .unwrap_or(false);

    if !valid {
        return Err(AppError::AuthError("用户名或密码错误".to_string()));
    }

    let secret = env::var("JWT_SECRET").unwrap_or_else(|_| "travel-agency-secret-key".to_string());
    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(24))
        .expect("valid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        sub: user.id.to_string(),
        role: user.role.as_str().to_string(),
        exp: expiration,
        username: user.username.clone(),
        display_name: user.display_name.clone(),
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::InternalError(format!("生成 Token 失败: {}", e)))?;

    Ok(Json(LoginResponse { token, user }))
}

pub async fn get_current_user(
    auth_user: AuthUser,
) -> Result<Json<UserInfo>, AppError> {
    Ok(Json(UserInfo {
        id: auth_user.id,
        username: auth_user.username,
        role: auth_user.role,
        display_name: auth_user.display_name,
    }))
}

#[derive(Serialize)]
pub struct UserInfo {
    pub id: Uuid,
    pub username: String,
    pub role: UserRole,
    pub display_name: String,
}

#[derive(sqlx::FromRow)]
struct UserRecord {
    id: String,
    username: String,
    password_hash: String,
    role: String,
    display_name: String,
    created_at: String,
}

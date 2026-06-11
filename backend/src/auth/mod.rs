pub mod guards;

use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation, Algorithm};
use rocket::http::Status;
use rocket::request::{FromRequest, Outcome, Request};
use std::collections::HashSet;
use std::env;
use anyhow::{Result, anyhow};

use crate::error::{AppError};
use crate::models::{CaseStatus, User, UserRole, Claims};

pub use guards::*;

pub fn get_jwt_secret() -> String {
    env::var("JWT_SECRET").unwrap_or_else(|_| {
        "your-default-secret-key-change-in-production-please-use-a-very-long-random-string".to_string()
    })
}

pub fn get_token_expiry_hours() -> i64 {
    env::var("JWT_EXPIRY_HOURS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(24)
}

pub fn hash_password(password: &str) -> Result<String> {
    hash(password, DEFAULT_COST).map_err(|e| anyhow!("密码哈希失败: {}", e))
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool> {
    verify(password, hash).map_err(|e| anyhow!("密码验证失败: {}", e))
}

pub fn create_jwt(user: &User, secret: &str) -> crate::error::Result<String> {
    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(get_token_expiry_hours()))
        .ok_or_else(|| AppError::InternalError("无法创建JWT令牌".to_string()))?
        .timestamp() as usize;

    let claims = Claims {
        sub: user.id.to_string(),
        user_id: user.id,
        username: user.username.clone(),
        role: user.role.as_str().to_string(),
        exp: expiration,
        iat: Utc::now().timestamp() as usize,
    };

    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
    .map_err(|e| AppError::InternalError(format!("JWT编码失败: {}", e)))
}

pub fn verify_jwt(token: &str, secret: &str) -> crate::error::Result<Claims> {
    let validation = Validation::new(Algorithm::HS256);
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &validation,
    )
    .map(|d| d.claims)
    .map_err(|e| AppError::AuthError(format!("JWT验证失败: {}", e)))
}

pub fn validate_token(token: &str) -> Result<Claims> {
    let secret = get_jwt_secret();
    let validation = Validation::new(Algorithm::HS256);

    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &validation,
    )
    .map(|data| data.claims)
    .map_err(|e| anyhow!("JWT验证失败: {}", e))
}

pub fn get_user_from_claims(claims: &Claims, db: &crate::db::Database) -> crate::error::Result<User> {
    let conn = db.conn.lock();
    let mut stmt = conn.prepare(
        "SELECT id, username, password_hash, real_name, role, department, created_at, updated_at FROM users WHERE id = ?1",
    )?;
    let user = stmt.query_row([claims.user_id], |row| {
        Ok(User {
            id: row.get(0)?,
            username: row.get(1)?,
            password_hash: row.get(2)?,
            real_name: row.get(3)?,
            role: UserRole::from_str(&row.get::<_, String>(4)?)
                .ok_or_else(|| rusqlite::Error::InvalidColumnType(4, "Invalid role".to_string(), rusqlite::types::Type::Text))?,
            department: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?;
    Ok(user)
}

pub struct AuthGuard {
    pub user: User,
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for AuthGuard {
    type Error = AppError;

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let secret = request
            .rocket()
            .state::<String>()
            .cloned()
            .unwrap_or_else(|| get_jwt_secret());

        let auth_header = request.headers().get_one("Authorization");
        let token = match auth_header {
            Some(h) if h.starts_with("Bearer ") => &h[7..],
            _ => {
                return Outcome::Error((
                    Status::Unauthorized,
                    AppError::AuthError("缺少有效的认证令牌".to_string()),
                ))
            }
        };

        let claims = match verify_jwt(token, &secret) {
            Ok(c) => c,
            Err(e) => return Outcome::Error((Status::Unauthorized, e)),
        };

        let db = match request.rocket().state::<crate::db::Database>() {
            Some(db) => db,
            None => {
                return Outcome::Error((
                    Status::InternalServerError,
                    AppError::InternalError("数据库连接失败".to_string()),
                ))
            }
        };

        match get_user_from_claims(&claims, db) {
            Ok(user) => Outcome::Success(AuthGuard { user }),
            Err(e) => Outcome::Error((Status::Unauthorized, e)),
        }
    }
}

pub struct AuthenticatedUser {
    pub claims: Claims,
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for AuthenticatedUser {
    type Error = ();

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let auth_header = request.headers().get_one("Authorization");
        
        let token = match auth_header {
            Some(header) if header.starts_with("Bearer ") => {
                header.trim_start_matches("Bearer ").trim()
            }
            _ => return Outcome::Error((Status::Unauthorized, ())),
        };

        match validate_token(token) {
            Ok(claims) => Outcome::Success(AuthenticatedUser { claims }),
            Err(_) => Outcome::Error((Status::Unauthorized, ())),
        }
    }
}

pub fn check_permission(
    user: &User,
    allowed_roles: &[UserRole],
    action: &str,
) -> crate::error::Result<()> {
    if allowed_roles.contains(&user.role) {
        Ok(())
    } else {
        Err(AppError::PermissionError(format!(
            "用户角色 {} 无权执行操作: {}",
            user.role.as_str(),
            action
        )))
    }
}

pub fn get_accessible_statuses(user: &User) -> HashSet<CaseStatus> {
    let mut statuses = HashSet::new();
    match user.role {
        UserRole::Registrar => {
            statuses.insert(CaseStatus::Draft);
            statuses.insert(CaseStatus::PendingSubmit);
            statuses.insert(CaseStatus::Submitted);
            statuses.insert(CaseStatus::Returned);
            statuses.insert(CaseStatus::Resubmitted);
        }
        UserRole::Supervisor | UserRole::Director => {
            statuses.insert(CaseStatus::Draft);
            statuses.insert(CaseStatus::PendingSubmit);
            statuses.insert(CaseStatus::Submitted);
            statuses.insert(CaseStatus::Returned);
            statuses.insert(CaseStatus::Resubmitted);
            statuses.insert(CaseStatus::Reviewing);
            statuses.insert(CaseStatus::Assigned);
            statuses.insert(CaseStatus::Followup);
            statuses.insert(CaseStatus::Completed);
            statuses.insert(CaseStatus::Archived);
        }
        UserRole::Reviewer => {
            statuses.insert(CaseStatus::Submitted);
            statuses.insert(CaseStatus::Resubmitted);
            statuses.insert(CaseStatus::Reviewing);
            statuses.insert(CaseStatus::Assigned);
            statuses.insert(CaseStatus::Returned);
        }
        UserRole::Assistant | UserRole::Lawyer => {
            statuses.insert(CaseStatus::Assigned);
            statuses.insert(CaseStatus::Followup);
            statuses.insert(CaseStatus::Completed);
            statuses.insert(CaseStatus::Returned);
        }
    }
    statuses
}

pub fn can_access_case(
    user: &User,
    created_by: i64,
    current_handler_id: Option<i64>,
    status: &CaseStatus,
) -> bool {
    let accessible_statuses = get_accessible_statuses(user);
    if !accessible_statuses.contains(status) {
        return false;
    }

    match user.role {
        UserRole::Supervisor | UserRole::Director => true,
        UserRole::Registrar => created_by == user.id,
        UserRole::Reviewer => {
            matches!(status, CaseStatus::Submitted | CaseStatus::Resubmitted | CaseStatus::Reviewing)
        }
        UserRole::Assistant | UserRole::Lawyer => current_handler_id == Some(user.id),
    }
}

pub fn init_default_users() -> Result<Vec<(String, String, String, String, Option<String>)>> {
    let users = vec![
        (
            "registrar".to_string(),
            hash_password("123456")?,
            "登记员张三".to_string(),
            "registrar".to_string(),
            Some("法务服务中心".to_string()),
        ),
        (
            "supervisor".to_string(),
            hash_password("123456")?,
            "审核主管李四".to_string(),
            "supervisor".to_string(),
            Some("法务服务中心".to_string()),
        ),
        (
            "reviewer".to_string(),
            hash_password("123456")?,
            "复核负责人王五".to_string(),
            "reviewer".to_string(),
            Some("法务服务中心".to_string()),
        ),
        (
            "director".to_string(),
            hash_password("123456")?,
            "律所主任赵六".to_string(),
            "director".to_string(),
            Some("管理层".to_string()),
        ),
        (
            "assistant".to_string(),
            hash_password("123456")?,
            "案件助理孙七".to_string(),
            "assistant".to_string(),
            Some("律师团队".to_string()),
        ),
        (
            "lawyer".to_string(),
            hash_password("123456")?,
            "承办律师周八".to_string(),
            "lawyer".to_string(),
            Some("律师团队".to_string()),
        ),
    ];
    Ok(users)
}

use crate::config::Config;
use crate::errors::AppError;
use crate::models::{Claims, Role, User, UserRow};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rocket::http::Status;
use rocket::request::{FromRequest, Outcome, Request};
use sqlx::SqlitePool;

pub fn generate_token(user: &User) -> Result<String, AppError> {
    let config = Config::load();
    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(24))
        .expect("valid timestamp")
        .timestamp();

    let claims = Claims {
        sub: user.username.clone(),
        user_id: user.id,
        username: user.username.clone(),
        role: user.role,
        exp: expiration,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(config.jwt_secret.as_ref()),
    )
    .map_err(AppError::from)
}

pub async fn verify_token(token: &str, pool: &SqlitePool) -> Result<User, AppError> {
    let config = Config::load();
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(config.jwt_secret.as_ref()),
        &Validation::default(),
    )?;

    let claims = token_data.claims;

    let row = sqlx::query_as::<_, UserRow>(
        r#"SELECT id, username, real_name, role, password_hash, created_at, updated_at
           FROM users WHERE id = ?"#,
    )
    .bind(claims.user_id.to_string())
    .fetch_one(pool)
    .await
    .map_err(|_| AppError::Unauthorized("用户不存在".into()))?;

    row.try_into().map_err(|e: String| AppError::Internal(e))
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for User {
    type Error = AppError;

    async fn from_request(req: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let auth_header = req.headers().get_one("Authorization");
        let token = match auth_header {
            Some(header) if header.starts_with("Bearer ") => &header[7..],
            _ => return Outcome::Error((Status::Unauthorized, AppError::Unauthorized("缺少Token".into()))),
        };

        let pool = match req.rocket().state::<sqlx::SqlitePool>() {
            Some(pool) => pool,
            None => return Outcome::Error((Status::InternalServerError, AppError::Internal("数据库未初始化".into()))),
        };

        match verify_token(token, pool).await {
            Ok(user) => Outcome::Success(user),
            Err(e) => Outcome::Error((Status::Unauthorized, e)),
        }
    }
}

pub async fn verify_password(password: &str, hash: &str) -> Result<bool, AppError> {
    use argon2::password_hash::{PasswordHash, PasswordVerifier};
    use argon2::{Argon2, Algorithm, Version};

    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| AppError::Internal(format!("密码解析错误: {}", e)))?;

    Ok(Argon2::new(Algorithm::Argon2id, Version::V0x13, argon2::Params::default())
        .verify_password(password.as_bytes(), &parsed_hash).is_ok())
}

pub async fn hash_password(password: &str) -> Result<String, AppError> {
    use argon2::password_hash::{PasswordHasher, SaltString};
    use argon2::{Argon2, Algorithm, Version};
    use rand::rngs::OsRng;

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, argon2::Params::default());

    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| AppError::Internal(format!("密码加密错误: {}", e)))
}

pub fn check_role_permission(user: &User, allowed_roles: &[Role]) -> Result<(), AppError> {
    if allowed_roles.contains(&user.role) {
        Ok(())
    } else {
        Err(AppError::Forbidden(format!(
            "角色[{}]无权限执行此操作，需要角色: {}",
            user.role.display_name(),
            allowed_roles.iter().map(|r| r.display_name()).collect::<Vec<_>>().join("/")
        )))
    }
}

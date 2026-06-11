use crate::auth::{generate_token, verify_password};
use crate::errors::AppError;
use crate::models::{LoginRequest, LoginResponse, User};
use rocket::serde::json::Json;
use rocket::State;
use sqlx::SqlitePool;

#[post("/auth/login", data = "<req>")]
pub async fn login(
    req: Json<LoginRequest>,
    pool: &State<SqlitePool>,
) -> Result<Json<LoginResponse>, AppError> {
    let user = sqlx::query_as::<_, User>(
        r#"SELECT id, username, real_name, role, password_hash, created_at, updated_at
           FROM users WHERE username = ?"#,
    )
    .bind(&req.username)
    .fetch_one(pool.inner())
    .await
    .map_err(|_| AppError::Unauthorized("用户名或密码错误".into()))?;

    let valid = verify_password(&req.password, &user.password_hash).await?;
    if !valid {
        return Err(AppError::Unauthorized("用户名或密码错误".into()));
    }

    let token = generate_token(&user)?;

    Ok(Json(LoginResponse { token, user }))
}

#[get("/auth/me")]
pub async fn current_user(user: User) -> Json<User> {
    Json(user)
}

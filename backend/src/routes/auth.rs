use rocket::serde::json::Json;
use rocket::{State, http::Status};
use log::{info, error};

use crate::auth::{verify_password, create_jwt, AuthGuard, init_default_users};
use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{LoginRequest, LoginResponse, UserInfo, UserRole, ApiResponse};

#[post("/login", data = "<request>")]
pub async fn login(
    db: &State<Database>,
    jwt_secret: &State<String>,
    request: Json<LoginRequest>,
) -> std::result::Result<Json<ApiResponse<LoginResponse>>, (Status, Json<ApiResponse<()>>)> {
    let username = &request.username;
    let password = &request.password;

    if username.is_empty() || password.is_empty() {
        return Err((
            Status::BadRequest,
            Json(ApiResponse::error("用户名和密码不能为空")),
        ));
    }

    let user = match db.get_user_by_username(username) {
        Ok(Some(user)) => user,
        Ok(None) => {
            return Err((
                Status::Unauthorized,
                Json(ApiResponse::error("用户名或密码错误")),
            ));
        }
        Err(e) => {
            error!("数据库查询错误: {}", e);
            return Err((
                Status::InternalServerError,
                Json(ApiResponse::error("服务器内部错误")),
            ));
        }
    };

    let password_valid = match verify_password(password, &user.password_hash) {
        Ok(valid) => valid,
        Err(e) => {
            error!("密码验证错误: {}", e);
            return Err((
                Status::InternalServerError,
                Json(ApiResponse::error("服务器内部错误")),
            ));
        }
    };

    if !password_valid {
        return Err((
            Status::Unauthorized,
            Json(ApiResponse::error("用户名或密码错误")),
        ));
    }

    let token = match create_jwt(&user, jwt_secret) {
        Ok(token) => token,
        Err(e) => {
            error!("Token生成错误: {}", e);
            return Err((
                Status::InternalServerError,
                Json(ApiResponse::error("服务器内部错误")),
            ));
        }
    };

    let user_info = UserInfo::from(user);

    info!("用户 {} 登录成功", user_info.username);

    Ok(Json(ApiResponse::success(
        LoginResponse {
            token,
            user: user_info,
        },
        "登录成功",
    )))
}

#[get("/me")]
pub async fn get_current_user(
    auth: AuthGuard,
) -> std::result::Result<Json<ApiResponse<UserInfo>>, (Status, Json<ApiResponse<()>>)> {
    let user_info = UserInfo::from(auth.user);
    Ok(Json(ApiResponse::success(user_info, "获取成功")))
}

#[get("/roles")]
pub fn get_roles(
    _auth: AuthGuard,
) -> std::result::Result<Json<ApiResponse<Vec<RoleInfo>>>, (Status, Json<ApiResponse<()>>)> {
    let roles = vec![
        RoleInfo {
            code: UserRole::Registrar.as_str().to_string(),
            name: UserRole::Registrar.display_name().to_string(),
            description: "发起/补正".to_string(),
        },
        RoleInfo {
            code: UserRole::Supervisor.as_str().to_string(),
            name: UserRole::Supervisor.display_name().to_string(),
            description: "办理".to_string(),
        },
        RoleInfo {
            code: UserRole::Reviewer.as_str().to_string(),
            name: UserRole::Reviewer.display_name().to_string(),
            description: "复核归档".to_string(),
        },
        RoleInfo {
            code: UserRole::Director.as_str().to_string(),
            name: UserRole::Director.display_name().to_string(),
            description: "".to_string(),
        },
        RoleInfo {
            code: UserRole::Assistant.as_str().to_string(),
            name: UserRole::Assistant.display_name().to_string(),
            description: "".to_string(),
        },
        RoleInfo {
            code: UserRole::Lawyer.as_str().to_string(),
            name: UserRole::Lawyer.display_name().to_string(),
            description: "".to_string(),
        },
    ];
    Ok(Json(ApiResponse::success(roles, "获取成功")))
}

#[derive(Debug, serde::Serialize)]
pub struct RoleInfo {
    pub code: String,
    pub name: String,
    pub description: String,
}

#[derive(Debug, serde::Deserialize)]
pub struct UserListQuery {
    pub role: Option<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct PublicUser {
    pub id: i64,
    pub username: String,
    pub real_name: String,
    pub role: UserRole,
    pub department: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[get("/users?<params..>")]
pub async fn list_users(
    db: &Database,
    auth: AuthGuard,
    params: UserListQuery,
) -> std::result::Result<Json<ApiResponse<Vec<PublicUser>>>, (Status, Json<ApiResponse<()>>)> {
    let conn = db.conn.lock();

    let mut where_clauses: Vec<String> = Vec::new();
    let mut params_vec: Vec<String> = Vec::new();

    if let Some(role) = &params.role {
        if UserRole::from_str(role).is_some() {
            where_clauses.push("role = ?".to_string());
            params_vec.push(role.clone());
        }
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let query_sql = format!(
        "SELECT id, username, real_name, role, department, created_at, updated_at 
         FROM users {} ORDER BY created_at DESC",
        where_sql
    );

    let mut stmt = match conn.prepare(&query_sql) {
        Ok(s) => s,
        Err(e) => {
            error!("数据库查询错误: {}", e);
            return Err((
                Status::InternalServerError,
                Json(ApiResponse::error("服务器内部错误")),
            ));
        }
    };

    let users_result = stmt.query_map(rusqlite::params_from_iter(&params_vec), |row| {
        let role_str: String = row.get(3)?;
        Ok(PublicUser {
            id: row.get(0)?,
            username: row.get(1)?,
            real_name: row.get(2)?,
            role: UserRole::from_str(&role_str).unwrap_or(UserRole::Registrar),
            department: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    });

    let mut users: Vec<PublicUser> = Vec::new();
    match users_result {
        Ok(rows) => {
            for user in rows {
                match user {
                    Ok(u) => users.push(u),
                    Err(e) => {
                        error!("解析用户数据错误: {}", e);
                    }
                }
            }
        }
        Err(e) => {
            error!("数据库查询错误: {}", e);
            return Err((
                Status::InternalServerError,
                Json(ApiResponse::error("服务器内部错误")),
            ));
        }
    }

    Ok(Json(ApiResponse::success(users, "查询成功")))
}

pub fn routes() -> Vec<rocket::Route> {
    rocket::routes![login, get_current_user, get_roles, list_users]
}

pub fn init_default_users_db(db: &Database) -> Result<()> {
    let users = init_default_users().map_err(|e| AppError::InternalError(format!("初始化默认用户失败: {}", e)))?;
    
    for (username, password_hash, real_name, role_str, department) in users {
        if db.get_user_by_username(&username).unwrap_or(None).is_none() {
            if let Some(role) = UserRole::from_str(&role_str) {
                match db.create_user(&username, &password_hash, &real_name, &role, department.as_deref()) {
                    Ok(_) => info!("创建默认用户: {}", username),
                    Err(e) => error!("创建默认用户 {} 失败: {}", username, e),
                }
            }
        }
    }
    
    Ok(())
}

use rocket::http::Status;
use rocket::request::{FromRequest, Outcome, Request};
use rocket::serde::json::Json;
use rocket::{get, post, put, State};

use crate::db::DbPool;
use crate::models::*;
use crate::services::*;
use crate::errors::AppResult;
use crate::errors::AppError;

pub struct AuthenticatedUser(pub User);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for AuthenticatedUser {
    type Error = AppError;

    async fn from_request(req: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let pool = match req.rocket().state::<DbPool>() {
            Some(p) => p,
            None => {
                return Outcome::Error((
                    Status::InternalServerError,
                    AppError::Database("DB pool not available".into()),
                ));
            }
        };

        let token = match req.headers().get_one("Authorization") {
            Some(t) => t.to_string(),
            None => {
                return Outcome::Error((
                    Status::Unauthorized,
                    AppError::Unauthorized("缺少 Authorization 头".into()),
                ));
            }
        };

        match AuthService::get_user_from_token(pool, &token) {
            Ok(user) => Outcome::Success(AuthenticatedUser(user)),
            Err(e) => Outcome::Error((Status::Unauthorized, e)),
        }
    }
}

#[post("/api/auth/login", data = "<body>")]
pub fn login(pool: &State<DbPool>, body: Json<LoginRequest>) -> AppResult<Json<LoginResponse>> {
    AuthService::login(pool, &body.username).map(Json)
}

#[get("/api/auth/users")]
pub fn list_users(pool: &State<DbPool>, _user: AuthenticatedUser) -> AppResult<Json<Vec<User>>> {
    crate::dao::UserDao::list_all(pool).map(Json)
}

#[get("/api/applications?<status>&<priority>&<store_id>&<responsible_person>&<is_overdue>&<keyword>&<mine>")]
pub fn list_applications(
    pool: &State<DbPool>,
    user: AuthenticatedUser,
    status: Option<String>,
    priority: Option<String>,
    store_id: Option<String>,
    responsible_person: Option<String>,
    is_overdue: Option<bool>,
    keyword: Option<String>,
    mine: Option<bool>,
) -> AppResult<Json<Vec<ReplenishmentApplication>>> {
    let filter = ApplicationFilter {
        status: status.as_deref().and_then(ApplicationStatus::from_str),
        priority: priority.as_deref().and_then(Priority::from_str),
        store_id,
        responsible_person,
        is_overdue,
        keyword,
    };
    let handler = if mine.unwrap_or(false) { Some(user.0.id.as_str()) } else { None };
    crate::dao::ApplicationDao::list(pool, &filter, handler).map(Json)
}

#[get("/api/applications/<id>")]
pub fn get_application_detail(
    pool: &State<DbPool>,
    user: AuthenticatedUser,
    id: &str,
) -> AppResult<Json<ApplicationDetail>> {
    ApplicationService::get_detail(pool, id, &user.0).map(Json)
}

#[post("/api/applications/process", data = "<body>")]
pub fn process_application(
    pool: &State<DbPool>,
    user: AuthenticatedUser,
    body: Json<ProcessRequest>,
) -> AppResult<Json<ReplenishmentApplication>> {
    ApplicationService::process_application(pool, &user.0, body.into_inner()).map(Json)
}

#[post("/api/applications/batch", data = "<body>")]
pub fn batch_process(
    pool: &State<DbPool>,
    user: AuthenticatedUser,
    body: Json<BatchProcessRequest>,
) -> AppResult<Json<BatchProcessResponse>> {
    ApplicationService::batch_process(pool, &user.0, body.into_inner()).map(Json)
}

#[post("/api/applications/<id>/audit-notes", data = "<body>")]
pub fn add_audit_note(
    pool: &State<DbPool>,
    user: AuthenticatedUser,
    id: &str,
    body: Json<serde_json::Value>,
) -> AppResult<Json<AuditNote>> {
    let note = body.get("note")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::Validation("缺少 note 字段".into()))?;
    ApplicationService::add_audit_note(pool, id, note, &user.0).map(Json)
}

#[get("/api/health")]
pub fn health() -> &'static str {
    "OK"
}

use rocket_cors::{AllowedOrigins, CorsOptions};

pub fn cors(frontend_port: u16) -> rocket_cors::Cors {
    let origins = vec![
        format!("http://localhost:{}", frontend_port),
        format!("http://127.0.0.1:{}", frontend_port),
    ];
    let allowed_origins = AllowedOrigins::some_exact(&origins);
    CorsOptions {
        allowed_origins,
        allowed_methods: ["Get", "Post", "Put", "Delete", "Options"]
            .iter()
            .map(|s| s.parse().unwrap())
            .collect(),
        allowed_headers: rocket_cors::AllowedHeaders::some(&[
            "Authorization",
            "Content-Type",
            "Accept",
        ]),
        allow_credentials: true,
        ..Default::default()
    }
    .to_cors()
    .expect("CORS configuration error")
}

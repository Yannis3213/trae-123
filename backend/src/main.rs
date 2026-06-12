pub mod db;
pub mod models;
pub mod handlers;
pub mod middleware;

use poem::{listener::TcpListener, middleware::Cors, EndpointExt, Route, Server};
use poem_openapi::{ContactObject, OpenApiService};
use sqlx::SqlitePool;
use std::sync::Arc;
use tokio::sync::Mutex;

pub const BACKEND_PORT: u16 = 8107;
pub const FRONTEND_PORT: u16 = 3107;

pub struct AppState {
    pub pool: SqlitePool,
    pub current_role: Mutex<String>,
    pub current_user: Mutex<String>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,beauty_appointment_backend=debug".into()),
        )
        .init();

    let pool = db::init_db().await?;
    db::seed_data(&pool).await?;

    let app_state = Arc::new(AppState {
        pool: pool.clone(),
        current_role: Mutex::new("store_manager".to_string()),
        current_user: Mutex::new("店长-王芳".to_string()),
    });

    let api_service = OpenApiService::new(
        (handlers::AppointmentApi, handlers::UserApi),
        "美容连锁门店预约单系统",
        "1.0.0",
    )
    .contact(ContactObject::new().name("门店系统管理员"))
    .description("美容连锁门店月底集中处理美容预约单系统 API");

    let ui = api_service.swagger_ui();

    let app = Route::new()
        .nest("/api", api_service)
        .nest("/", ui)
        .with(
            Cors::new()
                .allow_origin(format!("http://localhost:{}", FRONTEND_PORT))
                .allow_origin(format!("http://127.0.0.1:{}", FRONTEND_PORT))
                .allow_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
                .allow_headers(vec!["Content-Type", "X-Role", "X-User", "X-Version"]),
        )
        .data(app_state);

    let addr = format!("0.0.0.0:{}", BACKEND_PORT);
    tracing::info!("后端服务启动于 {}", addr);
    Server::new(TcpListener::bind(addr))
        .run(app)
        .await?;

    Ok(())
}

mod api;
mod db;
mod error;
mod models;

use poem::listener::TcpListener;
use poem::{EndpointExt, Server};
use poem_cors::{Cors, Origin};
use poem_openapi::OpenApiService;
use std::sync::Arc;
use tokio::sync::RwLock;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:./backend/data/cs_tickets.db".to_string());

    if let Some(parent) = std::path::Path::new(&database_url.trim_start_matches("sqlite:")).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)?;
        }
    }

    let pool = db::init_db(&database_url).await?;
    db::seed_data(&pool).await?;
    let pool = Arc::new(RwLock::new(pool));

    let api_service = OpenApiService::new(api::Api { pool: pool.clone() }, "客服呼叫中心工单系统 API", "1.0")
        .server("http://localhost:8004");
    let ui = api_service.swagger_ui();
    let spec = api_service.spec_endpoint();

    let app = poem::Route::new()
        .nest("/", api_service)
        .nest("/swagger", ui)
        .nest("/openapi.json", spec)
        .with(
            Cors::new()
                .allow_origin(Origin::list(vec![
                    "http://localhost:3004",
                    "http://127.0.0.1:3004",
                ]))
                .allow_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"])
                .allow_headers(vec![
                    "Content-Type",
                    "Authorization",
                    "X-User-Id",
                    "X-Username",
                    "X-Role",
                    "X-Name",
                ])
                .max_age(3600),
        );

    tracing::info!("后端服务启动: http://localhost:8004");
    tracing::info!("Swagger UI: http://localhost:8004/swagger");
    Server::new(TcpListener::bind("0.0.0.0:8004"))
        .run(app)
        .await?;

    Ok(())
}

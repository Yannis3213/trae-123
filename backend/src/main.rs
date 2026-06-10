mod db;
mod error;
mod models;
mod middleware;
mod handlers;

use std::sync::Arc;
use poem::{listener::TcpListener, Route, Server, EndpointExt};
use poem::http::Method;
use poem::middleware::{Cors, CorsConfig};
use poem_openapi::OpenApiService;

use db::AppState;
use handlers::auth::AuthApi;
use handlers::users::UsersApi;
use handlers::stations::StationsApi;
use handlers::patrol_orders::PatrolOrdersApi;
use handlers::defects::DefectsApi;
use handlers::acceptance::AcceptanceApi;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let state = Arc::new(AppState::new()?);
    println!("数据库初始化完成");

    let api_service = OpenApiService::new(
        (AuthApi, UsersApi, StationsApi, PatrolOrdersApi, DefectsApi, AcceptanceApi),
        "巡检管理系统 API",
        "1.0.0"
    ).server("http://localhost:8001/api");

    let ui = api_service.swagger_ui();
    let spec = api_service.spec_endpoint();

    let app = Route::new()
        .nest("/api", api_service)
        .nest("/api/docs", ui)
        .nest("/api/openapi.json", spec)
        .with(
            Cors::new(CorsConfig::new()
                .allow_origin("http://localhost:3001")
                .allow_methods(vec![Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
                .allow_headers(vec!["Content-Type", "X-User-ID", "X-User-Role", "Authorization"])
                .allow_credentials(true))
        )
        .data(state.clone());

    println!("服务器启动: http://0.0.0.0:8001");
    println!("API 文档: http://localhost:8001/api/docs");

    Server::new(TcpListener::bind("0.0.0.0:8001"))
        .run(app)
        .await?;

    Ok(())
}

use axum::{
    Router,
    routing::{get, post, put},
    extract::Extension,
    http::Method,
};
use tower_http::cors::{CorsLayer, Any};
use std::net::SocketAddr;
use std::env;
use dotenvy::dotenv;
use sqlx::SqlitePool;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod error;
mod models;
mod auth;
mod handlers;
mod db;
mod services;

use db::init_db;
use handlers::*;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv().ok();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "travel_agency_backend=debug,tower_http=debug,axum=trace".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:travel_agency.db".to_string());
    let pool = init_db(&database_url).await?;

    let frontend_port = env::var("FRONTEND_PORT").unwrap_or_else(|_| "5173".to_string());
    let backend_port: u16 = env::var("BACKEND_PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse()
        .expect("BACKEND_PORT must be a valid port number");

    let frontend_origin = format!("http://localhost:{}", frontend_port);
    tracing::info!("Frontend origin: {}", frontend_origin);

    let cors = CorsLayer::new()
        .allow_origin([frontend_origin.parse().unwrap()])
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
        .allow_headers(Any)
        .allow_credentials(true);

    let app = Router::new()
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/me", get(auth::get_current_user))
        .route("/api/orders", get(order_handlers::list_orders).post(order_handlers::create_order))
        .route("/api/orders/:id", get(order_handlers::get_order).put(order_handlers::update_order))
        .route("/api/orders/:id/status", put(order_handlers::change_status))
        .route("/api/orders/batch", post(order_handlers::batch_process))
        .route("/api/orders/:id/attachments", post(order_handlers::upload_attachment).get(order_handlers::list_attachments))
        .route("/api/orders/:id/records", get(order_handlers::list_records).post(order_handlers::add_record))
        .route("/api/orders/:id/audit", post(order_handlers::add_audit_note).get(order_handlers::list_audit_notes))
        .route("/api/dashboard/stats", get(dashboard_handlers::get_stats))
        .layer(cors)
        .layer(Extension(pool));

    let addr = SocketAddr::from(([0, 0, 0, 0], backend_port));
    tracing::info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

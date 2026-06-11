use axum::{
    routing::{delete, get, post, put},
    Router,
};
use tower_http::cors::{Any, CorsLayer};

mod db;
mod error;
mod handlers;
mod middleware;
mod models;

use db::DbPool;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let pool = db::init_pool("creative_requests.db").expect("Failed to initialize database");

    {
        let conn = pool.lock().await;
        db::init_schema(&conn).expect("Failed to initialize schema");
        db::seed_data(&conn).expect("Failed to seed data");
    }

    let cors = CorsLayer::new()
        .allow_origin(
            "http://localhost:3005"
                .parse::<axum::http::HeaderValue>()
                .unwrap(),
        )
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers(Any);

    let state = pool.clone();

    let app = Router::new()
        .route("/api/auth/login", post(handlers::login))
        .route("/api/auth/me", get(handlers::me))
        .route(
            "/api/creative-requests",
            get(handlers::list).post(handlers::create),
        )
        .route("/api/creative-requests/batch", post(handlers::batch))
        .route(
            "/api/creative-requests/{id}",
            get(handlers::detail).put(handlers::update),
        )
        .route(
            "/api/creative-requests/{id}/submit",
            post(handlers::submit),
        )
        .route(
            "/api/creative-requests/{id}/review",
            post(handlers::review),
        )
        .route(
            "/api/creative-requests/{id}/supplement",
            post(handlers::supplement),
        )
        .route(
            "/api/creative-requests/{id}/attachments",
            get(handlers::attachments::list).post(handlers::attachments::upload),
        )
        .route(
            "/api/attachments/{id}",
            delete(handlers::attachments::delete),
        )
        .route(
            "/api/creative-requests/{id}/audit-trail",
            get(handlers::get_audit_trail),
        )
        .route(
            "/api/creative-requests/{id}/audit-notes",
            post(handlers::add_audit_note),
        )
        .route("/api/statistics", get(handlers::get_statistics))
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8005")
        .await
        .expect("Failed to bind to port 8005");

    tracing::info!("Server running on http://0.0.0.0:8005");
    axum::serve(listener, app).await.expect("Server error");
}

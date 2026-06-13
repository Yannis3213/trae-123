mod models;
mod db;
mod auth;
mod handlers;

use std::sync::Arc;
use poem::{
    handler, http::{StatusCode, HeaderMap}, listener::TcpListener, middleware::Cors, EndpointExt, Route,
    Server, Body, IntoResponse, Response,
};
use poem::web::{Data, Json, Path, Query};
use serde::Deserialize;
use sqlx::SqlitePool;

use crate::models::*;
use crate::handlers::*;

pub const BACKEND_PORT: u16 = 8106;
pub const FRONTEND_PORT: u16 = 3106;

struct AppState {
    pool: SqlitePool,
}

fn err_resp(e: AppError) -> Response {
    let status = e.status_code();
    let body = serde_json::json!({
        "code": e.code(),
        "message": e.to_string(),
        "detail": serde_json::Value::Null,
    });
    Response::builder()
        .status(status)
        .header("Content-Type", "application/json; charset=utf-8")
        .body(Body::from_json(&body).unwrap())
}

#[handler]
async fn login_handler(
    Data(state): Data<&Arc<AppState>>,
    Json(req): Json<LoginRequest>,
) -> impl IntoResponse {
    match login(&state.pool, &req).await {
        Ok(r) => Response::builder()
            .status(StatusCode::OK)
            .body(Body::from_json(&r).unwrap()),
        Err(e) => err_resp(e),
    }
}

#[handler]
async fn me_handler(
    headers: &HeaderMap,
) -> impl IntoResponse {
    match me(&headers).await {
        Ok(r) => Response::builder()
            .status(StatusCode::OK)
            .body(Body::from_json(&r).unwrap()),
        Err(e) => err_resp(e),
    }
}

#[handler]
async fn list_users_handler(
    Data(state): Data<&Arc<AppState>>,
    headers: &HeaderMap,
) -> impl IntoResponse {
    match list_users(&state.pool, &headers).await {
        Ok(r) => Response::builder()
            .status(StatusCode::OK)
            .body(Body::from_json(&r).unwrap()),
        Err(e) => err_resp(e),
    }
}

#[derive(Debug, Deserialize)]
struct TopicListParams {
    status: Option<String>,
    category: Option<String>,
    priority: Option<String>,
    keyword: Option<String>,
    page: Option<u64>,
    page_size: Option<u64>,
    warning: Option<String>,
}

#[handler]
async fn list_topics_handler(
    Data(state): Data<&Arc<AppState>>,
    headers: &HeaderMap,
    Query(params): Query<TopicListParams>,
) -> impl IntoResponse {
    let q = TopicListQuery {
        status: params.status,
        category: params.category,
        priority: params.priority,
        keyword: params.keyword,
        page: params.page,
        page_size: params.page_size,
        warning: params.warning,
    };
    match list_topics(&state.pool, &headers, &q).await {
        Ok(r) => Response::builder()
            .status(StatusCode::OK)
            .body(Body::from_json(&r).unwrap()),
        Err(e) => err_resp(e),
    }
}

#[handler]
async fn get_topic_detail_handler(
    Data(state): Data<&Arc<AppState>>,
    headers: &HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match get_topic_detail(&state.pool, &headers, id).await {
        Ok(r) => Response::builder()
            .status(StatusCode::OK)
            .body(Body::from_json(&r).unwrap()),
        Err(e) => err_resp(e),
    }
}

#[handler]
async fn create_topic_handler(
    Data(state): Data<&Arc<AppState>>,
    headers: &HeaderMap,
    Json(req): Json<CreateTopicRequest>,
) -> impl IntoResponse {
    match create_topic(&state.pool, &headers, &req).await {
        Ok(r) => Response::builder()
            .status(StatusCode::CREATED)
            .body(Body::from_json(&r).unwrap()),
        Err(e) => err_resp(e),
    }
}

#[handler]
async fn update_topic_handler(
    Data(state): Data<&Arc<AppState>>,
    headers: &HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<UpdateTopicRequest>,
) -> impl IntoResponse {
    match update_topic(&state.pool, &headers, id, &req).await {
        Ok(r) => Response::builder()
            .status(StatusCode::OK)
            .body(Body::from_json(&r).unwrap()),
        Err(e) => err_resp(e),
    }
}

#[handler]
async fn process_topic_handler(
    Data(state): Data<&Arc<AppState>>,
    headers: &HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<ProcessTopicRequest>,
) -> impl IntoResponse {
    match process_topic(&state.pool, &headers, id, &req).await {
        Ok(r) => Response::builder()
            .status(StatusCode::OK)
            .body(Body::from_json(&serde_json::json!({
                "topic": r.topic,
                "action": r.action_performed,
            })).unwrap()),
        Err(e) => err_resp(e),
    }
}

#[handler]
async fn batch_process_handler(
    Data(state): Data<&Arc<AppState>>,
    headers: &HeaderMap,
    Json(req): Json<BatchProcessRequest>,
) -> impl IntoResponse {
    match batch_process(&state.pool, &headers, &req).await {
        Ok(r) => Response::builder()
            .status(StatusCode::OK)
            .body(Body::from_json(&r).unwrap()),
        Err(e) => err_resp(e),
    }
}

#[handler]
async fn statistics_handler(
    Data(state): Data<&Arc<AppState>>,
    headers: &HeaderMap,
) -> impl IntoResponse {
    match topic_statistics(&state.pool, &headers).await {
        Ok(r) => Response::builder()
            .status(StatusCode::OK)
            .body(Body::from_json(&r).unwrap()),
        Err(e) => err_resp(e),
    }
}

#[handler]
async fn upload_attachment_handler(
    Data(state): Data<&Arc<AppState>>,
    headers: &HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<AttachmentInput>,
) -> impl IntoResponse {
    match upload_attachment(&state.pool, &headers, id, &req).await {
        Ok(r) => Response::builder()
            .status(StatusCode::CREATED)
            .body(Body::from_json(&r).unwrap()),
        Err(e) => err_resp(e),
    }
}

#[handler]
async fn delete_attachment_handler(
    Data(state): Data<&Arc<AppState>>,
    headers: &HeaderMap,
    Path((id, aid)): Path<(String, String)>,
) -> impl IntoResponse {
    match delete_attachment(&state.pool, &headers, id, aid).await {
        Ok(_) => Response::builder()
            .status(StatusCode::NO_CONTENT)
            .body(Body::empty()),
        Err(e) => err_resp(e),
    }
}

#[handler]
async fn health_handler() -> impl IntoResponse {
    Response::builder()
        .status(StatusCode::OK)
        .body(Body::from_json(&serde_json::json!({
            "status": "ok",
            "service": "news-editorial-backend",
            "port": BACKEND_PORT,
        })).unwrap())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    let default_db_dir = format!("{}/data", env!("CARGO_MANIFEST_DIR"));
    let default_db_path = format!("sqlite://{}/news.db?mode=rwc", default_db_dir);
    let db_path = std::env::var("DATABASE_URL").unwrap_or_else(|_| default_db_path);
    let port: u16 = std::env::var("BACKEND_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(BACKEND_PORT);

    std::fs::create_dir_all(default_db_dir).ok();

    let pool = db::init_pool(&db_path).await?;
    db::run_migrations(&pool).await?;
    db::seed_data(&pool).await?;

    let state = Arc::new(AppState { pool });

    let cors = Cors::new()
        .allow_origins(vec![
            format!("http://localhost:{}", FRONTEND_PORT),
            format!("http://127.0.0.1:{}", FRONTEND_PORT),
            format!("http://0.0.0.0:{}", FRONTEND_PORT),
        ])
        .allow_methods(vec!["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
        .allow_headers(vec!["Authorization", "Content-Type", "X-Requested-With", "X-Token"])
        .allow_credentials(true)
        .max_age(3600);

    let app = Route::new()
        .at("/health", poem::get(health_handler))
        .at("/api/auth/login", poem::post(login_handler))
        .at("/api/auth/me", poem::get(me_handler))
        .at("/api/users", poem::get(list_users_handler))
        .at("/api/topics", poem::get(list_topics_handler).post(create_topic_handler))
        .at("/api/topics/:id", poem::get(get_topic_detail_handler).put(update_topic_handler))
        .at("/api/topics/:id/process", poem::post(process_topic_handler))
        .at("/api/topics/:id/attachments", poem::post(upload_attachment_handler))
        .at("/api/topics/:id/attachments/:aid", poem::delete(delete_attachment_handler))
        .at("/api/topics/batch/process", poem::post(batch_process_handler))
        .at("/api/statistics", poem::get(statistics_handler))
        .with(cors)
        .data(state);

    let listen_addr = format!("0.0.0.0:{}", port);
    tracing::info!("Starting backend server on {}", listen_addr);
    tracing::info!("Frontend CORS origin: http://localhost:{}", FRONTEND_PORT);
    tracing::info!("Database: {}", db_path);
    Server::new(TcpListener::bind(listen_addr))
        .run(app)
        .await?;

    Ok(())
}

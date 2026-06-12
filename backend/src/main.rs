mod db;
mod error;
mod handlers;
mod middleware;
mod models;

use handlers::AppState;
use poem::middleware::Cors;
use poem::Route;
use poem::{get, post, EndpointExt};
use std::sync::{Arc, Mutex};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let conn = db::init_db()?;
    let state = AppState {
        conn: Arc::new(Mutex::new(conn)),
    };

    let cors = Cors::new()
        .allow_origin("http://localhost:31010")
        .allow_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
        .allow_headers(vec!["Content-Type", "Authorization"]);

    let app = Route::new()
        .at("/api/auth/login", post(handlers::login))
        .at("/api/audits", get(handlers::list_audits).post(handlers::create_audit))
        .at("/api/audits/expiry", get(handlers::expiry_dashboard))
        .at("/api/audits/batch", post(handlers::batch_process))
        .at("/api/audits/:id", get(handlers::get_audit))
        .at("/api/audits/:id/process", post(handlers::process_audit))
        .at("/api/audits/:id/withdraw", post(handlers::withdraw_audit))
        .at("/api/dashboard/stats", get(handlers::dashboard_stats))
        .with(cors)
        .data(state);

    println!("Audit backend server starting on 0.0.0.0:8101...");
    poem::Server::new(poem::listener::TcpListener::bind("0.0.0.0:8101"))
        .run(app)
        .await?;

    Ok(())
}

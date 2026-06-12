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

const DEFAULT_BACKEND_PORT: u16 = 10100;
const DEFAULT_FRONTEND_ORIGIN: &str = "http://localhost:31010";

fn parse_port(port_str: &str, default: u16) -> u16 {
    match port_str.parse::<u16>() {
        Ok(p) if p > 0 => p,
        _ => default,
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv::dotenv().ok();

    let backend_port = std::env::var("BACKEND_PORT")
        .map(|s| parse_port(&s, DEFAULT_BACKEND_PORT))
        .unwrap_or(DEFAULT_BACKEND_PORT);

    let frontend_origin = std::env::var("FRONTEND_ORIGIN")
        .unwrap_or_else(|_| DEFAULT_FRONTEND_ORIGIN.to_string());

    let conn = db::init_db()?;
    let state = AppState {
        conn: Arc::new(Mutex::new(conn)),
    };

    let cors = Cors::new()
        .allow_origin(frontend_origin.as_str())
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

    let bind_addr = format!("0.0.0.0:{}", backend_port);
    println!("Audit backend server starting on {}...", bind_addr);
    println!("CORS allow origin: {}", frontend_origin);
    poem::Server::new(poem::listener::TcpListener::bind(bind_addr))
        .run(app)
        .await?;

    Ok(())
}

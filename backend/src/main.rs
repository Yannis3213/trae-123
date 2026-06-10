use actix_cors::Cors;
use actix_web::{web, App, HttpServer, middleware};
use std::env;

mod db;
mod models;
mod services;
mod handlers;
mod middleware as app_middleware;

use db::init_db_with_migrations;
use handlers::config as route_config;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    tracing_subscriber::fmt::init();

    let port: u16 = env::var("PORT")
        .unwrap_or_else(|_| "8003".to_string())
        .parse()
        .expect("PORT must be a valid number");

    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:./sampling_tasks.db".to_string());

    let frontend_url = env::var("FRONTEND_URL")
        .unwrap_or_else(|_| "http://localhost:3003".to_string());

    let pool = init_db_with_migrations(&database_url)
        .await
        .expect("Failed to initialize database");

    println!("Database initialized: {}", database_url);
    println!("Server starting on port {}", port);
    println!("Frontend CORS allowed: {}", frontend_url);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin(&frontend_url)
            .allowed_origin("http://localhost:3003")
            .allowed_origin("http://127.0.0.1:3003")
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
            .allowed_headers(vec!["Content-Type", "Authorization", "X-Requested-With"])
            .max_age(3600);

        App::new()
            .app_data(web::Data::new(pool.clone()))
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .configure(route_config)
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

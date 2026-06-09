pub mod db;
pub mod error;
pub mod handlers;
pub mod models;
pub mod auth;

use actix_cors::Cors;
use actix_web::{web, App, HttpServer, middleware};
use std::sync::Mutex;
use db::DbPool;

pub struct AppState {
    pub db: Mutex<DbPool>,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    let db_pool = db::init_db().expect("Failed to initialize database");
    let data = web::Data::new(AppState {
        db: Mutex::new(db_pool),
    });

    log::info!("Starting server at http://127.0.0.1:8004");
    log::info!("CORS allowed origin: http://localhost:3004");

    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin("http://localhost:3004")
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
            .allowed_headers(vec![
                actix_web::http::header::AUTHORIZATION,
                actix_web::http::header::ACCEPT,
                actix_web::http::header::CONTENT_TYPE,
            ])
            .max_age(3600);

        App::new()
            .app_data(data.clone())
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .service(
                web::scope("/api")
                    .route("/roles", web::get().to(handlers::list_roles))
                    .route("/borrow-records", web::get().to(handlers::list_borrow_records))
                    .route("/borrow-records/{id}", web::get().to(handlers::get_borrow_record))
                    .route("/borrow-records", web::post().to(handlers::create_borrow_record))
                    .route("/borrow-records/{id}/process", web::post().to(handlers::process_borrow_record))
                    .route("/borrow-records/batch-process", web::post().to(handlers::batch_process_records))
                    .route("/borrow-records/{id}/audit-notes", web::get().to(handlers::get_audit_notes))
                    .route("/borrow-records/{id}/process-history", web::get().to(handlers::get_process_history))
                    .route("/readers", web::get().to(handlers::list_readers))
                    .route("/readers/{id}", web::get().to(handlers::get_reader))
                    .route("/statistics", web::get().to(handlers::get_statistics))
            )
    })
    .bind("127.0.0.1:8004")?
    .run()
    .await
}

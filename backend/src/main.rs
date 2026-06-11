#[macro_use]
extern crate rocket;

mod auth;
mod db;
mod error;
mod models;
mod routes;
mod utils;

use db::Database;
use log::{info, warn};
use rocket::fairing::{Fairing, Info, Kind};
use rocket::http::Header;
use rocket::{Request, Response};
use std::env;
use std::path::PathBuf;

pub struct CORS;

#[rocket::async_trait]
impl Fairing for CORS {
    fn info(&self) -> Info {
        Info {
            name: "Add CORS headers to responses",
            kind: Kind::Response,
        }
    }

    async fn on_response<'r>(&self, request: &'r Request<'_>, response: &mut Response<'r>) {
        let allowed_origins = ["http://localhost:3003"];
        let origin = request.headers().get_one("Origin");
        
        if let Some(origin) = origin {
            if allowed_origins.contains(&origin) {
                response.set_header(Header::new("Access-Control-Allow-Origin", origin));
                response.set_header(Header::new("Vary", "Origin"));
            }
        }
        
        response.set_header(Header::new(
            "Access-Control-Allow-Methods",
            "POST, GET, PUT, DELETE, OPTIONS",
        ));
        response.set_header(Header::new("Access-Control-Allow-Headers", "*"));
        response.set_header(Header::new("Access-Control-Allow-Credentials", "true"));
    }
}

#[launch]
fn rocket() -> _ {
    env_logger::init();

    let db_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../database/legal_service.db");

    let database = match Database::new(db_path) {
        Ok(db) => {
            log::info!("Database initialized successfully");
            db
        }
        Err(e) => {
            log::error!("Failed to initialize database: {}", e);
            panic!("Database initialization failed: {}", e);
        }
    };

    match routes::auth::init_default_users_db(&database) {
        Ok(_) => info!("默认用户初始化完成"),
        Err(e) => warn!("默认用户初始化警告: {}", e),
    }

    let jwt_secret =
        env::var("JWT_SECRET").unwrap_or_else(|_| auth::get_jwt_secret());

    env::set_var("ROCKET_PORT", "8003");

    rocket::build()
        .attach(CORS)
        .manage(database)
        .manage(jwt_secret)
        .mount("/api", routes::routes())
}

#[macro_use]
extern crate rocket;

mod auth;
mod config;
mod db;
mod errors;
mod handlers;
mod models;
mod schema;
mod services;

use std::collections::HashSet;

use rocket::fairing::AdHoc;
use rocket::http::Method;
use rocket_cors::{AllowedHeaders, AllowedOrigins, CorsOptions};

#[launch]
fn rocket() -> _ {
    dotenvy::dotenv().ok();

    let allowed_origins = AllowedOrigins::some_exact(&[
        "http://localhost:3107",
        "http://127.0.0.1:3107",
    ]);

    let allow_methods: HashSet<rocket_cors::Method> = [
        Method::Get,
        Method::Post,
        Method::Put,
        Method::Delete,
        Method::Options,
    ]
    .into_iter()
    .map(Into::into)
    .collect();

    let cors = CorsOptions {
        allowed_origins,
        allowed_methods: allow_methods,
        allowed_headers: AllowedHeaders::all(),
        allow_credentials: true,
        ..Default::default()
    }
    .to_cors()
    .expect("CORS init failed");

    rocket::build()
        .attach(cors)
        .attach(db::init_db_pool())
        .attach(AdHoc::on_ignite("DB Setup", |rocket| Box::pin(async {
            let pool = rocket.state::<sqlx::SqlitePool>().expect("DB pool not found");
            schema::init_database(pool).await.expect("DB init failed");
            schema::seed_demo_data(pool).await.expect("Seed data failed");
            rocket
        })))
        .mount(
            "/api",
            routes![
                handlers::auth::login,
                handlers::auth::current_user,
                handlers::cases::list_cases,
                handlers::cases::get_case_detail,
                handlers::cases::create_case,
                handlers::cases::update_case_status,
                handlers::cases::batch_process,
                handlers::cases::add_attachment,
                handlers::cases::add_audit_note,
                handlers::cases::get_processing_records,
                handlers::cases::get_expiring_cases,
                handlers::cases::get_statistics,
            ],
        )
        .register(
            "/api",
            catchers![
                errors::not_found,
                errors::unauthorized,
                errors::forbidden,
                errors::internal_error,
            ],
        )
}

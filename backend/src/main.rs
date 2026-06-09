#[macro_use]
extern crate rocket;

mod db;
mod models;
mod routes;
mod services;

use rocket_cors::{AllowedOrigins, CorsOptions};
use std::sync::Arc;

use crate::db::Database;
use crate::routes::*;
use crate::services::CarePlanService;

#[launch]
fn rocket() -> _ {
    let db = Arc::new(Database::new());
    let service = Arc::new(CarePlanService::new(db));

    let cors = CorsOptions::default()
        .allowed_origins(AllowedOrigins::some_exact(&[
            "http://localhost:3004",
            "http://127.0.0.1:3004",
        ]))
        .to_cors()
        .expect("Failed to create CORS fairing");

    let rkt = rocket::build()
        .attach(cors)
        .manage(service)
        .mount(
            "/",
            routes![
                auth_me,
                list_plans,
                get_plan,
                get_attachments,
                upload_attachment,
                get_records,
                get_audit,
                get_exceptions,
                get_stats,
                create_plan,
                update_plan,
                dispatch_plan,
                submit_plan,
                review_plan,
                return_plan,
                batch_action,
                export_plans,
            ],
        );
    register_catchers(rkt)
}

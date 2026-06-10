#[macro_use]
extern crate rocket;

mod db;
mod models;
mod dao;
mod errors;
mod services;
mod routes;

use db::*;
use rocket::fairing::AdHoc;
use std::env;

#[launch]
fn rocket() -> _ {
    env_logger::init();
    let db_path = env::var("DB_PATH").unwrap_or_else(|_| "data/replenishment.db".into());
    let frontend_port: u16 = env::var("FRONTEND_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(4321);
    let backend_port: u16 = env::var("BACKEND_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8000);

    init_database(&db_path).expect("Failed to init database");
    let pool = init_db_pool(&db_path);

    {
        let conn = pool.get().expect("get conn");
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))
            .unwrap_or(0);
        if count == 0 {
            drop(conn);
            services::SeedService::seed(&pool).expect("Failed to seed data");
        }
    }

    let cors = routes::cors(frontend_port);

    let figment = rocket::Config::figment()
        .merge(("port", backend_port))
        .merge(("address", "0.0.0.0"));

    rocket::custom(figment)
        .attach(cors)
        .manage(pool)
        .mount(
            "/",
            routes![
                routes::health,
                routes::login,
                routes::list_users,
                routes::list_applications,
                routes::get_application_detail,
                routes::process_application,
                routes::batch_process,
                routes::add_audit_note,
            ],
        )
        .attach(AdHoc::on_ignite("Print Config", move |rocket| async move {
            println!("=> Backend listening on port {}", backend_port);
            println!("=> CORS allows frontend port {}", frontend_port);
            rocket
        }))
}

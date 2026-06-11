pub mod assignment;
pub mod auth;
pub mod batch;
pub mod cases;
pub mod followup;
pub mod registration;
pub mod statistics;

use rocket::serde::json::Json;
use rocket::{Build, Rocket};

pub fn routes() -> Vec<rocket::Route> {
    let mut all_routes = Vec::new();

    all_routes.extend(auth::routes());
    all_routes.extend(cases::routes());
    all_routes.extend(registration::routes());
    all_routes.extend(assignment::routes());
    all_routes.extend(followup::routes());
    all_routes.extend(batch::routes());
    all_routes.extend(statistics::routes());

    all_routes.extend(rocket::routes![health_check, options_handler]);

    all_routes
}

#[get("/health")]
fn health_check() -> Json<crate::models::ApiResponse<&'static str>> {
    Json(crate::models::ApiResponse::success(
        "OK",
        "服务运行正常",
    ))
}

#[options("/<_..>")]
fn options_handler() -> &'static str {
    ""
}

pub fn mount_routes(rocket: Rocket<Build>) -> Rocket<Build> {
    rocket.mount("/api", routes())
}

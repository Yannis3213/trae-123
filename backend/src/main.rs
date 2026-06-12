#[macro_use] extern crate rocket;

mod models;
mod db;

use rocket::State;
use rocket::http::Status;
use rocket::response::status::Custom;
use rocket::serde::json::Json;
use rocket::fairing::{Fairing, Info, Kind};
use rocket::request::{self, FromRequest, Outcome};
use rocket::{Request, Response};
use std::sync::Mutex;

use models::*;
use db::Database;

struct AppState {
    db: Mutex<Database>,
}

pub struct Cors;

#[rocket::async_trait]
impl Fairing for Cors {
    fn info(&self) -> Info {
        Info {
            name: "CORS Fairing",
            kind: Kind::Response,
        }
    }

    async fn on_response<'r>(&self, request: &'r Request<'_>, response: &mut Response<'r>) {
        let allowed_origins = vec![
            "http://localhost:3109",
            "http://127.0.0.1:3109",
        ];

        if let Some(origin) = request.headers().get_one("Origin") {
            if allowed_origins.contains(&origin) {
                response.set_header(rocket::http::Header::new("Access-Control-Allow-Origin", origin));
                response.set_header(rocket::http::Header::new("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"));
                response.set_header(rocket::http::Header::new("Access-Control-Allow-Headers", "Content-Type, Authorization"));
                response.set_header(rocket::http::Header::new("Access-Control-Allow-Credentials", "true"));
            }
        }
    }
}

struct AuthUser(User);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for AuthUser {
    type Error = ();

    async fn from_request(request: &'r Request<'_>) -> request::Outcome<Self, Self::Error> {
        let auth_header = request.headers().get_one("Authorization");
        
        let token = match auth_header {
            Some(auth) if auth.starts_with("Bearer ") => &auth[7..],
            _ => return Outcome::Error((Status::Unauthorized, ())),
        };

        if token.is_empty() {
            return Outcome::Error((Status::Unauthorized, ()));
        }

        let state = match request.rocket().state::<AppState>() {
            Some(s) => s,
            None => return Outcome::Error((Status::InternalServerError, ())),
        };

        let db = state.db.lock().unwrap();
        match db.get_user_by_id(token) {
            Some(user) => Outcome::Success(AuthUser(user)),
            None => Outcome::Error((Status::Unauthorized, ())),
        }
    }
}

#[options("/<_path..>")]
fn options_handler(_path: std::path::PathBuf) -> Status {
    Status::NoContent
}

#[post("/auth/login", data = "<req>")]
fn login(state: &State<AppState>, req: Json<LoginRequest>) 
    -> Result<Json<ApiResponse<LoginResponse>>, Custom<Json<ApiResponse<()>>>> 
{
    let db = state.db.lock().unwrap();
    let user = db.login(&req.username, &req.password)
        .ok_or_else(|| Custom(Status::Unauthorized, Json(ApiResponse::err("用户名或密码错误"))))?;
    
    let response = LoginResponse {
        token: user.id.clone(),
        user: user.clone(),
    };
    
    Ok(Json(ApiResponse::ok(response)))
}

#[get("/auth/me")]
fn get_me(user: AuthUser) -> Json<ApiResponse<User>> {
    Json(ApiResponse::ok(user.0))
}

#[get("/applications?<status>&<clue_no>&<customer_name>&<node>&<handler>&<acting_role>&<invoice_status>&<loan_status>&<page>&<page_size>")]
fn list_applications(
    state: &State<AppState>,
    user: AuthUser,
    status: Option<String>,
    clue_no: Option<String>,
    customer_name: Option<String>,
    node: Option<String>,
    handler: Option<String>,
    acting_role: Option<String>,
    invoice_status: Option<String>,
    loan_status: Option<String>,
    page: Option<u64>,
    page_size: Option<u64>,
) -> Result<Json<ApiResponse<PaginatedResponse<FinanceApplication>>>, Custom<Json<ApiResponse<()>>>> {
    let query = ApplicationListQuery {
        status,
        clue_no,
        customer_name,
        node,
        handler,
        acting_role,
        invoice_status,
        loan_status,
        page,
        page_size,
    };
    
    let db = state.db.lock().unwrap();
    let result = db.list_applications(&query, &user.0)
        .map_err(|e| Custom(Status::InternalServerError, Json(ApiResponse::err(&e.to_string()))))?;
    
    Ok(Json(ApiResponse::ok(result)))
}

#[get("/applications/<id>")]
fn get_application(
    state: &State<AppState>,
    user: AuthUser,
    id: &str,
) -> Result<Json<ApiResponse<ApplicationDetail>>, Custom<Json<ApiResponse<()>>>> {
    let db = state.db.lock().unwrap();
    let result = db.get_application_detail(id, &user.0)
        .map_err(|e| Custom(Status::InternalServerError, Json(ApiResponse::err(&e.to_string()))))?;
    
    Ok(Json(ApiResponse::ok(result)))
}

#[post("/applications", data = "<req>")]
fn create_application(
    state: &State<AppState>,
    user: AuthUser,
    req: Json<CreateApplicationRequest>,
) -> Result<Json<ApiResponse<FinanceApplication>>, Custom<Json<ApiResponse<()>>>> {
    let db = state.db.lock().unwrap();
    let result = db.create_application(&req, &user.0)
        .map_err(|e| Custom(Status::BadRequest, Json(ApiResponse::err(&e.to_string()))))?;
    
    Ok(Json(ApiResponse::ok(result)))
}

#[post("/applications/<id>/process", data = "<req>")]
fn process_application(
    state: &State<AppState>,
    user: AuthUser,
    id: &str,
    req: Json<ProcessApplicationRequest>,
) -> Result<Json<ApiResponse<ApplicationDetail>>, Custom<Json<ApiResponse<()>>>> {
    let db = state.db.lock().unwrap();
    let result = db.process_application(id, &req, &user.0)
        .map_err(|e| Custom(Status::BadRequest, Json(ApiResponse::err(&e.to_string()))))?;
    
    Ok(Json(ApiResponse::ok(result)))
}

#[post("/applications/batch-process", data = "<req>")]
fn batch_process(
    state: &State<AppState>,
    user: AuthUser,
    req: Json<BatchProcessRequest>,
) -> Result<Json<ApiResponse<Vec<BatchProcessResult>>>, Custom<Json<ApiResponse<()>>>> {
    let db = state.db.lock().unwrap();
    let result = db.batch_process(&req, &user.0)
        .map_err(|e| Custom(Status::BadRequest, Json(ApiResponse::err(&e.to_string()))))?;
    
    Ok(Json(ApiResponse::ok(result)))
}

#[get("/statistics?<acting_role>")]
fn get_statistics(
    state: &State<AppState>,
    user: AuthUser,
    acting_role: Option<String>,
) -> Result<Json<ApiResponse<Statistics>>, Custom<Json<ApiResponse<()>>>> {
    let db = state.db.lock().unwrap();
    let result = db.get_statistics(&user.0, acting_role)
        .map_err(|e| Custom(Status::InternalServerError, Json(ApiResponse::err(&e.to_string()))))?;
    
    Ok(Json(ApiResponse::ok(result)))
}

#[get("/health")]
fn health() -> Json<ApiResponse<String>> {
    Json(ApiResponse::ok("ok".to_string()))
}

#[launch]
fn rocket() -> _ {
    let db_path = "data/finance.db";
    let init_sql = include_str!("../init.sql");
    
    let db = Database::new(db_path, init_sql)
        .expect("Failed to initialize database");
    
    rocket::build()
        .manage(AppState {
            db: Mutex::new(db),
        })
        .attach(Cors)
        .mount("/api", routes![
            health,
            login,
            get_me,
            list_applications,
            get_application,
            create_application,
            process_application,
            batch_process,
            get_statistics,
            options_handler,
        ])
}

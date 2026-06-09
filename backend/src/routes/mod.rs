use rocket::http::Status;
use rocket::request::{self, FromRequest, Request};
use rocket::serde::json::Json;
use rocket::State;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::*;
use crate::services::CarePlanService;

pub struct AuthedUser(pub User);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for AuthedUser {
    type Error = ();
    async fn from_request(req: &'r Request<'_>) -> request::Outcome<Self, Self::Error> {
        let service = req.rocket().state::<Arc<CarePlanService>>().unwrap();
        let token = req
            .headers()
            .get_one("Authorization")
            .and_then(|h| h.strip_prefix("Bearer "))
            .unwrap_or("");
        match service.authenticate(token) {
            Some(u) => Outcome::Success(AuthedUser(u)),
            None => Outcome::Error((Status::Unauthorized, ())),
        }
    }
}

fn resp<T: Serialize>(success: bool, message: &str, data: Option<T>) -> Json<ApiResponse<T>> {
    Json(ApiResponse { success, message: message.to_string(), data })
}

#[get("/api/auth/me")]
pub fn auth_me(user: AuthedUser) -> Json<ApiResponse<User>> {
    resp(true, "ok", Some(user.0))
}

#[get("/api/care-plans?<status>&<warning>&<keyword>")]
pub fn list_plans(
    user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    status: Option<String>,
    warning: Option<String>,
    keyword: Option<String>,
) -> Json<ApiResponse<Vec<CarePlan>>> {
    let query = PlanListQuery { status, warning, keyword };
    let plans = service.list_plans(&user.0, &query);
    resp(true, "ok", Some(plans))
}

#[get("/api/care-plans/<id>")]
pub fn get_plan(
    user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    id: &str,
) -> Result<Json<ApiResponse<CarePlan>>, Status> {
    let pid = Uuid::parse_str(id).map_err(|_| Status::BadRequest)?;
    match service.get_plan(&user.0, pid) {
        Some(p) => Ok(resp(true, "ok", Some(p))),
        None => Err(Status::NotFound),
    }
}

#[get("/api/care-plans/<id>/attachments")]
pub fn get_attachments(
    _user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    id: &str,
) -> Result<Json<ApiResponse<Vec<Attachment>>>, Status> {
    let pid = Uuid::parse_str(id).map_err(|_| Status::BadRequest)?;
    Ok(resp(true, "ok", Some(service.get_attachments(pid))))
}

#[get("/api/care-plans/<id>/records")]
pub fn get_records(
    _user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    id: &str,
) -> Result<Json<ApiResponse<Vec<ProcessingRecord>>>, Status> {
    let pid = Uuid::parse_str(id).map_err(|_| Status::BadRequest)?;
    Ok(resp(true, "ok", Some(service.get_processing_records(pid))))
}

#[get("/api/care-plans/<id>/audit")]
pub fn get_audit(
    _user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    id: &str,
) -> Result<Json<ApiResponse<Vec<AuditNote>>>, Status> {
    let pid = Uuid::parse_str(id).map_err(|_| Status::BadRequest)?;
    Ok(resp(true, "ok", Some(service.get_audit_notes(pid))))
}

#[get("/api/care-plans/<id>/exceptions")]
pub fn get_exceptions(
    _user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    id: &str,
) -> Result<Json<ApiResponse<Vec<ExceptionReason>>>, Status> {
    let pid = Uuid::parse_str(id).map_err(|_| Status::BadRequest)?;
    Ok(resp(true, "ok", Some(service.get_exceptions(pid))))
}

#[get("/api/stats")]
pub fn get_stats(user: AuthedUser, service: &State<Arc<CarePlanService>>) -> Json<ApiResponse<serde_json::Value>> {
    resp(true, "ok", Some(service.get_stats(&user.0)))
}

#[post("/api/care-plans", data = "<body>")]
pub fn create_plan(
    user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    body: Json<CreatePlanRequest>,
) -> Result<Json<ApiResponse<CarePlan>>, Status> {
    match service.create_plan(&user.0, &body) {
        Ok(p) => Ok(resp(true, "创建成功", Some(p))),
        Err((c, m)) => {
            let status = Status::from_code(c).unwrap_or(Status::InternalServerError);
            Err(status)
        }
    }
}

#[put("/api/care-plans/<id>", data = "<body>")]
pub fn update_plan(
    user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    id: &str,
    body: Json<UpdatePlanRequest>,
) -> Result<Json<ApiResponse<CarePlan>>, Status> {
    let pid = Uuid::parse_str(id).map_err(|_| Status::BadRequest)?;
    match service.update_plan(&user.0, pid, &body) {
        Ok(p) => Ok(resp(true, "更新成功", Some(p))),
        Err((c, m)) => {
            let status = Status::from_code(c).unwrap_or(Status::InternalServerError);
            Err(status)
        }
    }
}

#[post("/api/care-plans/<id>/dispatch", data = "<body>")]
pub fn dispatch_plan(
    user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    id: &str,
    body: Json<ActionRequest>,
) -> Result<Json<ApiResponse<CarePlan>>, Status> {
    let pid = Uuid::parse_str(id).map_err(|_| Status::BadRequest)?;
    match service.dispatch_plan(&user.0, pid, &body) {
        Ok(p) => Ok(resp(true, "派发成功", Some(p))),
        Err((c, m)) => Err(Status::from_code(c).unwrap_or(Status::InternalServerError)),
    }
}

#[post("/api/care-plans/<id>/submit", data = "<body>")]
pub fn submit_plan(
    user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    id: &str,
    body: Json<ActionRequest>,
) -> Result<Json<ApiResponse<CarePlan>>, Status> {
    let pid = Uuid::parse_str(id).map_err(|_| Status::BadRequest)?;
    match service.submit_plan(&user.0, pid, &body) {
        Ok(p) => Ok(resp(true, "提交复核成功", Some(p))),
        Err((c, m)) => Err(Status::from_code(c).unwrap_or(Status::InternalServerError)),
    }
}

#[post("/api/care-plans/<id>/review", data = "<body>")]
pub fn review_plan(
    user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    id: &str,
    body: Json<ActionRequest>,
) -> Result<Json<ApiResponse<CarePlan>>, Status> {
    let pid = Uuid::parse_str(id).map_err(|_| Status::BadRequest)?;
    match service.review_plan(&user.0, pid, &body) {
        Ok(p) => Ok(resp(true, "复核归档成功", Some(p))),
        Err((c, m)) => Err(Status::from_code(c).unwrap_or(Status::InternalServerError)),
    }
}

#[post("/api/care-plans/<id>/return", data = "<body>")]
pub fn return_plan(
    user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    id: &str,
    body: Json<ReturnRequest>,
) -> Result<Json<ApiResponse<CarePlan>>, Status> {
    let pid = Uuid::parse_str(id).map_err(|_| Status::BadRequest)?;
    match service.return_plan(&user.0, pid, &body) {
        Ok(p) => Ok(resp(true, "退回补正成功", Some(p))),
        Err((c, m)) => Err(Status::from_code(c).unwrap_or(Status::InternalServerError)),
    }
}

#[post("/api/care-plans/batch", data = "<body>")]
pub fn batch_action(
    user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    body: Json<BatchRequest>,
) -> Json<ApiResponse<Vec<BatchResult>>> {
    let results = service.batch_action(&user.0, &body);
    resp(true, "批量处理完成", Some(results))
}

#[get("/api/export?<status>&<warning>&<keyword>")]
pub fn export_plans(
    user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    status: Option<String>,
    warning: Option<String>,
    keyword: Option<String>,
) -> (Status, (rocket::http::ContentType, String)) {
    let query = PlanListQuery { status, warning, keyword };
    let csv = service.export_csv(&user.0, &query);
    (
        Status::Ok,
        (rocket::http::ContentType::CSV, csv),
    )
}

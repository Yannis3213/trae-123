use rocket::http::{ContentType, Status};
use rocket::request::{self, FromRequest, Request};
use rocket::response::Responder;
use rocket::serde::json::Json;
use rocket::{catch, catchers, Build, Rocket, State};
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
            Some(u) => request::Outcome::Success(AuthedUser(u)),
            None => request::Outcome::Error((Status::Unauthorized, ())),
        }
    }
}

fn resp<T: serde::Serialize>(success: bool, message: &str, data: Option<T>) -> Json<ApiResponse<T>> {
    Json(ApiResponse { success, message: message.to_string(), data })
}

fn err_resp(status: Status, message: &str) -> (Status, (ContentType, String)) {
    let body = serde_json::json!({
        "success": false,
        "message": message,
        "data": null,
    });
    (status, (ContentType::JSON, body.to_string()))
}

#[catch(400)]
fn bad_request() -> (Status, (ContentType, String)) {
    err_resp(Status::BadRequest, "请求参数错误")
}

#[catch(401)]
fn unauthorized() -> (Status, (ContentType, String)) {
    err_resp(Status::Unauthorized, "未授权访问，请使用正确的 Token")
}

#[catch(403)]
fn forbidden() -> (Status, (ContentType, String)) {
    err_resp(Status::Forbidden, "当前角色无权限执行该操作")
}

#[catch(404)]
fn not_found() -> (Status, (ContentType, String)) {
    err_resp(Status::NotFound, "资源不存在")
}

#[catch(409)]
fn conflict() -> (Status, (ContentType, String)) {
    err_resp(Status::Conflict, "状态冲突或版本冲突，请刷新后重试")
}

#[catch(500)]
fn internal_error() -> (Status, (ContentType, String)) {
    err_resp(Status::InternalServerError, "服务器内部错误")
}

pub fn register_catchers(rocket: Rocket<Build>) -> Rocket<Build> {
    rocket.register("/", catchers![bad_request, unauthorized, forbidden, not_found, conflict, internal_error])
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
) -> Result<Json<ApiResponse<CarePlan>>, (Status, (ContentType, String))> {
    let pid = Uuid::parse_str(id).map_err(|_| err_resp(Status::BadRequest, "计划单ID格式错误"))?;
    match service.get_plan(&user.0, pid) {
        Some(p) => Ok(resp(true, "ok", Some(p))),
        None => Err(err_resp(Status::NotFound, "护理计划单不存在或无权限访问")),
    }
}

#[get("/api/care-plans/<id>/attachments")]
pub fn get_attachments(
    user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    id: &str,
) -> Result<Json<ApiResponse<Vec<Attachment>>>, (Status, (ContentType, String))> {
    let pid = Uuid::parse_str(id).map_err(|_| err_resp(Status::BadRequest, "计划单ID格式错误"))?;
    service.get_plan(&user.0, pid).ok_or_else(|| err_resp(Status::NotFound, "护理计划单不存在或无权限访问"))?;
    Ok(resp(true, "ok", Some(service.get_attachments(pid))))
}

#[post("/api/care-plans/<id>/attachments", data = "<body>")]
pub fn upload_attachment(
    user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    id: &str,
    body: Json<UploadAttachmentRequest>,
) -> Result<Json<ApiResponse<Attachment>>, (Status, (ContentType, String))> {
    let pid = Uuid::parse_str(id).map_err(|_| err_resp(Status::BadRequest, "计划单ID格式错误"))?;
    service.get_plan(&user.0, pid).ok_or_else(|| err_resp(Status::NotFound, "护理计划单不存在或无权限访问"))?;
    match service.upload_attachment(&user.0, pid, &body) {
        Ok(a) => Ok(resp(true, "附件上传成功", Some(a))),
        Err((c, m)) => Err(err_resp(Status::from_code(c).unwrap_or(Status::InternalServerError), &m)),
    }
}

#[get("/api/care-plans/<id>/records")]
pub fn get_records(
    user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    id: &str,
) -> Result<Json<ApiResponse<Vec<ProcessingRecord>>>, (Status, (ContentType, String))> {
    let pid = Uuid::parse_str(id).map_err(|_| err_resp(Status::BadRequest, "计划单ID格式错误"))?;
    service.get_plan(&user.0, pid).ok_or_else(|| err_resp(Status::NotFound, "护理计划单不存在或无权限访问"))?;
    Ok(resp(true, "ok", Some(service.get_processing_records(pid))))
}

#[get("/api/care-plans/<id>/audit")]
pub fn get_audit(
    user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    id: &str,
) -> Result<Json<ApiResponse<Vec<AuditNote>>>, (Status, (ContentType, String))> {
    let pid = Uuid::parse_str(id).map_err(|_| err_resp(Status::BadRequest, "计划单ID格式错误"))?;
    service.get_plan(&user.0, pid).ok_or_else(|| err_resp(Status::NotFound, "护理计划单不存在或无权限访问"))?;
    Ok(resp(true, "ok", Some(service.get_audit_notes(pid))))
}

#[get("/api/care-plans/<id>/exceptions")]
pub fn get_exceptions(
    user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    id: &str,
) -> Result<Json<ApiResponse<Vec<ExceptionReason>>>, (Status, (ContentType, String))> {
    let pid = Uuid::parse_str(id).map_err(|_| err_resp(Status::BadRequest, "计划单ID格式错误"))?;
    service.get_plan(&user.0, pid).ok_or_else(|| err_resp(Status::NotFound, "护理计划单不存在或无权限访问"))?;
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
) -> Result<Json<ApiResponse<CarePlan>>, (Status, (ContentType, String))> {
    match service.create_plan(&user.0, &body) {
        Ok(p) => Ok(resp(true, "创建成功", Some(p))),
        Err((c, m)) => Err(err_resp(Status::from_code(c).unwrap_or(Status::InternalServerError), &m)),
    }
}

#[put("/api/care-plans/<id>", data = "<body>")]
pub fn update_plan(
    user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    id: &str,
    body: Json<UpdatePlanRequest>,
) -> Result<Json<ApiResponse<CarePlan>>, (Status, (ContentType, String))> {
    let pid = Uuid::parse_str(id).map_err(|_| err_resp(Status::BadRequest, "计划单ID格式错误"))?;
    match service.update_plan(&user.0, pid, &body) {
        Ok(p) => Ok(resp(true, "更新成功", Some(p))),
        Err((c, m)) => Err(err_resp(Status::from_code(c).unwrap_or(Status::InternalServerError), &m)),
    }
}

#[post("/api/care-plans/<id>/dispatch", data = "<body>")]
pub fn dispatch_plan(
    user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    id: &str,
    body: Json<ActionRequest>,
) -> Result<Json<ApiResponse<CarePlan>>, (Status, (ContentType, String))> {
    let pid = Uuid::parse_str(id).map_err(|_| err_resp(Status::BadRequest, "计划单ID格式错误"))?;
    match service.dispatch_plan(&user.0, pid, &body) {
        Ok(p) => Ok(resp(true, "派发成功", Some(p))),
        Err((c, m)) => Err(err_resp(Status::from_code(c).unwrap_or(Status::InternalServerError), &m)),
    }
}

#[post("/api/care-plans/<id>/submit", data = "<body>")]
pub fn submit_plan(
    user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    id: &str,
    body: Json<ActionRequest>,
) -> Result<Json<ApiResponse<CarePlan>>, (Status, (ContentType, String))> {
    let pid = Uuid::parse_str(id).map_err(|_| err_resp(Status::BadRequest, "计划单ID格式错误"))?;
    match service.submit_plan(&user.0, pid, &body) {
        Ok(p) => Ok(resp(true, "提交复核成功", Some(p))),
        Err((c, m)) => Err(err_resp(Status::from_code(c).unwrap_or(Status::InternalServerError), &m)),
    }
}

#[post("/api/care-plans/<id>/review", data = "<body>")]
pub fn review_plan(
    user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    id: &str,
    body: Json<ActionRequest>,
) -> Result<Json<ApiResponse<CarePlan>>, (Status, (ContentType, String))> {
    let pid = Uuid::parse_str(id).map_err(|_| err_resp(Status::BadRequest, "计划单ID格式错误"))?;
    match service.review_plan(&user.0, pid, &body) {
        Ok(p) => Ok(resp(true, "复核归档成功", Some(p))),
        Err((c, m)) => Err(err_resp(Status::from_code(c).unwrap_or(Status::InternalServerError), &m)),
    }
}

#[post("/api/care-plans/<id>/return", data = "<body>")]
pub fn return_plan(
    user: AuthedUser,
    service: &State<Arc<CarePlanService>>,
    id: &str,
    body: Json<ReturnRequest>,
) -> Result<Json<ApiResponse<CarePlan>>, (Status, (ContentType, String))> {
    let pid = Uuid::parse_str(id).map_err(|_| err_resp(Status::BadRequest, "计划单ID格式错误"))?;
    match service.return_plan(&user.0, pid, &body) {
        Ok(p) => Ok(resp(true, "退回补正成功", Some(p))),
        Err((c, m)) => Err(err_resp(Status::from_code(c).unwrap_or(Status::InternalServerError), &m)),
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
) -> (Status, (ContentType, String)) {
    let query = PlanListQuery { status, warning, keyword };
    let csv = service.export_csv(&user.0, &query);
    let ct = ContentType::new("text", "csv").with_params(("charset", "utf-8"));
    (Status::Ok, (ct, csv))
}

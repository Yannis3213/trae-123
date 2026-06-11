use crate::auth::check_role_permission;
use crate::errors::AppError;
use crate::models::{
    AddAttachmentRequest, AddAuditNoteRequest, BatchProcessRequest, BatchProcessResult,
    CaseStatus, CaseWithDetail, CreateCaseRequest, ExpiryStatus, PaginatedResponse,
    ProcessingRecord, ProcessingStage, Role, StatisticsResponse, UpdateStatusRequest, User,
};
use crate::services::case_service;
use rocket::serde::json::Json;
use rocket::State;
use sqlx::SqlitePool;
use uuid::Uuid;

#[get("/cases?<status>&<stage>&<expiry>&<keyword>&<page>&<page_size>")]
pub async fn list_cases(
    user: User,
    status: Option<String>,
    stage: Option<String>,
    expiry: Option<String>,
    keyword: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
    pool: &State<SqlitePool>,
) -> Result<Json<PaginatedResponse<CaseWithDetail>>, AppError> {
    let status = status.and_then(|s| CaseStatus::from_str(&s));
    let stage = stage.and_then(|s| ProcessingStage::from_str(&s));
    let expiry = expiry.and_then(|s| match s.as_str() {
        "normal" => Some(ExpiryStatus::Normal),
        "nearing_expiry" => Some(ExpiryStatus::NearingExpiry),
        "overdue" => Some(ExpiryStatus::Overdue),
        _ => None,
    });
    let page = page.unwrap_or(1);
    let page_size = page_size.unwrap_or(20);

    let result = case_service::list_cases(
        pool.inner(),
        status,
        stage,
        expiry,
        keyword,
        page,
        page_size,
        &user,
    )
    .await?;

    Ok(Json(result))
}

#[get("/cases/<id>")]
pub async fn get_case_detail(
    user: User,
    id: String,
    pool: &State<SqlitePool>,
) -> Result<Json<CaseWithDetail>, AppError> {
    let case_id = Uuid::parse_str(&id).map_err(|_| AppError::BadRequest("无效的案件ID".into()))?;
    let result = case_service::get_case_detail(pool.inner(), case_id).await?;
    Ok(Json(result))
}

#[post("/cases", data = "<req>")]
pub async fn create_case(
    user: User,
    req: Json<CreateCaseRequest>,
    pool: &State<SqlitePool>,
) -> Result<Json<crate::models::Case>, AppError> {
    check_role_permission(&user, &[Role::Dispatcher])?;

    let result = case_service::create_case(pool.inner(), req.into_inner(), &user).await?;
    Ok(Json(result))
}

#[put("/cases/status", data = "<req>")]
pub async fn update_case_status(
    user: User,
    req: Json<UpdateStatusRequest>,
    pool: &State<SqlitePool>,
) -> Result<Json<CaseWithDetail>, AppError> {
    let result = case_service::update_case_status(pool.inner(), req.into_inner(), &user).await?;
    Ok(Json(result))
}

#[post("/cases/batch", data = "<req>")]
pub async fn batch_process(
    user: User,
    req: Json<BatchProcessRequest>,
    pool: &State<SqlitePool>,
) -> Result<Json<Vec<BatchProcessResult>>, AppError> {
    let result = case_service::batch_process_cases(
        pool.inner(),
        req.case_ids.clone(),
        req.to_status,
        req.remarks.clone(),
        req.version_map.clone(),
        &user,
    )
    .await?;
    Ok(Json(result))
}

#[post("/cases/attachments", data = "<req>")]
pub async fn add_attachment(
    user: User,
    req: Json<AddAttachmentRequest>,
    pool: &State<SqlitePool>,
) -> Result<Json<crate::models::Attachment>, AppError> {
    check_role_permission(&user, &[Role::Dispatcher, Role::PoliceOfficer, Role::Reviewer])?;

    match (user.role, req.category.as_str()) {
        (Role::Dispatcher, "registration") => {}
        (Role::Dispatcher, _) => {
            return Err(AppError::Forbidden(
                format!("无权限: 警情处置登记员只能上传登记材料(registration)，不能上传[{}]", req.category)
            ));
        }
        (Role::PoliceOfficer, "evidence") | (Role::PoliceOfficer, "followup") => {}
        (Role::PoliceOfficer, _) => {
            return Err(AppError::Forbidden(
                format!("无权限: 警情处置审核主管只能上传证据材料(evidence)或回访材料(followup)，不能上传[{}]", req.category)
            ));
        }
        (Role::Reviewer, _) => {}
    }

    let case = case_service::get_case_by_id(pool.inner(), req.case_id).await?;
    if case.status == CaseStatus::Completed {
        return Err(AppError::Forbidden("案件已办结，无法添加附件".into()));
    }

    let result = case_service::add_attachment(
        pool.inner(),
        req.case_id,
        req.file_name.clone(),
        req.file_type.clone(),
        req.file_size,
        req.category.clone(),
        &user,
    )
    .await?;
    Ok(Json(result))
}

#[post("/cases/notes", data = "<req>")]
pub async fn add_audit_note(
    user: User,
    req: Json<AddAuditNoteRequest>,
    pool: &State<SqlitePool>,
) -> Result<Json<crate::models::AuditNote>, AppError> {
    check_role_permission(&user, &[Role::Reviewer, Role::PoliceOfficer])?;

    let result = case_service::add_audit_note(
        pool.inner(),
        req.case_id,
        req.note.clone(),
        req.anomaly_reason.clone(),
        &user,
    )
    .await?;
    Ok(Json(result))
}

#[get("/cases/<id>/records")]
pub async fn get_processing_records(
    user: User,
    id: String,
    pool: &State<SqlitePool>,
) -> Result<Json<Vec<ProcessingRecord>>, AppError> {
    let case_id = Uuid::parse_str(&id).map_err(|_| AppError::BadRequest("无效的案件ID".into()))?;
    let result = case_service::get_processing_records(pool.inner(), case_id).await?;
    Ok(Json(result))
}

#[get("/cases/expiring")]
pub async fn get_expiring_cases(
    user: User,
    pool: &State<SqlitePool>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = case_service::get_expiring_cases(pool.inner()).await?;
    Ok(Json(result))
}

#[get("/statistics")]
pub async fn get_statistics(
    user: User,
    pool: &State<SqlitePool>,
) -> Result<Json<StatisticsResponse>, AppError> {
    let result = case_service::get_statistics(pool.inner()).await?;
    Ok(Json(result))
}

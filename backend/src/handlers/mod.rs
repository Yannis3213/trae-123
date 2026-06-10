use actix_web::{web, HttpResponse, Responder, http::header::ContentType};
use crate::services::*;
use crate::db::DbPool;
use serde::Deserialize;

pub async fn health_check() -> impl Responder {
    HttpResponse::Ok()
        .content_type(ContentType::json())
        .body(serde_json::json!({"status": "ok", "service": "sampling-task-backend"}).to_string())
}

pub async fn create_task(
    pool: web::Data<DbPool>,
    req: web::Json<CreateTaskRequest>,
) -> impl Responder {
    match TaskService::create_task(&pool, req.into_inner()).await {
        Ok(task) => HttpResponse::Ok().json(serde_json::json!({
            "code": 0,
            "message": "success",
            "data": task
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "code": 1,
            "message": e.to_string(),
            "data": null
        })),
    }
}

pub async fn get_task(
    pool: web::Data<DbPool>,
    path: web::Path<String>,
    query: web::Query<TaskDetailQuery>,
) -> impl Responder {
    let task_id = path.into_inner();
    let role = query.role.clone().unwrap_or_else(|| "sampling_registrar".to_string());

    match TaskService::get_task_with_details(&pool, &task_id, &role).await {
        Ok(data) => HttpResponse::Ok().json(serde_json::json!({
            "code": 0,
            "message": "success",
            "data": data
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "code": 1,
            "message": e.to_string(),
            "data": null
        })),
    }
}

#[derive(Debug, Deserialize)]
pub struct TaskDetailQuery {
    pub role: Option<String>,
}

pub async fn list_tasks(
    pool: web::Data<DbPool>,
    query: web::Query<TaskQueryParams>,
) -> impl Responder {
    match TaskService::list_tasks(&pool, query.into_inner()).await {
        Ok(response) => HttpResponse::Ok().json(serde_json::json!({
            "code": 0,
            "message": "success",
            "data": response
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "code": 1,
            "message": e.to_string(),
            "data": null
        })),
    }
}

pub async fn process_task(
    pool: web::Data<DbPool>,
    req: web::Json<ProcessTaskRequest>,
) -> impl Responder {
    match TaskService::process_task(&pool, req.into_inner()).await {
        Ok(task) => HttpResponse::Ok().json(serde_json::json!({
            "code": 0,
            "message": "success",
            "data": task
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "code": 1,
            "message": e.to_string(),
            "data": null
        })),
    }
}

pub async fn batch_process(
    pool: web::Data<DbPool>,
    req: web::Json<BatchProcessRequest>,
) -> impl Responder {
    match TaskService::batch_process(&pool, req.into_inner()).await {
        Ok(results) => HttpResponse::Ok().json(serde_json::json!({
            "code": 0,
            "message": "success",
            "data": results
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "code": 1,
            "message": e.to_string(),
            "data": null
        })),
    }
}

pub async fn get_statistics(
    pool: web::Data<DbPool>,
    query: web::Query<StatsQuery>,
) -> impl Responder {
    let role = query.role.clone().unwrap_or_else(|| "sampling_registrar".to_string());

    match TaskService::get_statistics(&pool, &role).await {
        Ok(stats) => HttpResponse::Ok().json(serde_json::json!({
            "code": 0,
            "message": "success",
            "data": stats
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "code": 1,
            "message": e.to_string(),
            "data": null
        })),
    }
}

#[derive(Debug, Deserialize)]
pub struct StatsQuery {
    pub role: Option<String>,
}

pub async fn get_processing_records(
    pool: web::Data<DbPool>,
    path: web::Path<String>,
    query: web::Query<RecordsQuery>,
) -> impl Responder {
    let task_id = path.into_inner();
    let role = query.role.clone().unwrap_or_else(|| "sampling_registrar".to_string());

    match TaskService::get_processing_records(&pool, &task_id, &role).await {
        Ok(records) => HttpResponse::Ok().json(serde_json::json!({
            "code": 0,
            "message": "success",
            "data": records
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "code": 1,
            "message": e.to_string(),
            "data": null
        })),
    }
}

#[derive(Debug, Deserialize)]
pub struct RecordsQuery {
    pub role: Option<String>,
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api")
            .route("/health", web::get().to(health_check))
            .route("/tasks", web::get().to(list_tasks))
            .route("/tasks", web::post().to(create_task))
            .route("/tasks/process", web::post().to(process_task))
            .route("/tasks/batch-process", web::post().to(batch_process))
            .route("/tasks/statistics", web::get().to(get_statistics))
            .route("/tasks/{id}", web::get().to(get_task))
            .route("/tasks/{id}/records", web::get().to(get_processing_records))
    );
}

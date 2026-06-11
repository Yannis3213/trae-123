use rocket::http::Status;
use rocket::request::Request;
use rocket::response::{Responder, Response};
use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("未授权: {0}")]
    Unauthorized(String),

    #[error("无权限: {0}")]
    Forbidden(String),

    #[error("参数错误: {0}")]
    BadRequest(String),

    #[error("未找到: {0}")]
    NotFound(String),

    #[error("状态冲突: {0}")]
    Conflict(String),

    #[error("校验失败: {0}")]
    Validation(ValidationErrors),

    #[error("内部错误: {0}")]
    Internal(String),
}

#[derive(Debug, Serialize, Clone)]
pub struct ValidationErrors {
    pub errors: Vec<ValidationError>,
}

impl std::fmt::Display for ValidationErrors {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "校验失败: {} 个错误", self.errors.len())
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
}

impl ValidationErrors {
    pub fn new() -> Self {
        Self { errors: Vec::new() }
    }

    pub fn add(&mut self, field: &str, message: &str) {
        self.errors.push(ValidationError {
            field: field.to_string(),
            message: message.to_string(),
        });
    }

    pub fn is_empty(&self) -> bool {
        self.errors.is_empty()
    }
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    details: Option<ValidationErrors>,
}

impl<'r> Responder<'r, 'static> for AppError {
    fn respond_to(self, req: &'r Request<'_>) -> rocket::response::Result<'static> {
        let (status, error) = match &self {
            AppError::Unauthorized(msg) => (Status::Unauthorized, "UNAUTHORIZED"),
            AppError::Forbidden(msg) => (Status::Forbidden, "FORBIDDEN"),
            AppError::BadRequest(msg) => (Status::BadRequest, "BAD_REQUEST"),
            AppError::NotFound(msg) => (Status::NotFound, "NOT_FOUND"),
            AppError::Conflict(msg) => (Status::Conflict, "CONFLICT"),
            AppError::Validation(errs) => (Status::BadRequest, "VALIDATION_ERROR"),
            AppError::Internal(msg) => (Status::InternalServerError, "INTERNAL_ERROR"),
        };

        let details: Option<ValidationErrors> = match &self {
            AppError::Validation(errs) => Some(errs.clone()),
            _ => None,
        };

        let body = serde_json::to_string(&ErrorResponse {
            error: error.to_string(),
            message: self.to_string(),
            details,
        })
        .unwrap_or_else(|_| r#"{"error":"INTERNAL_ERROR","message":"序列化错误"}"#.into());

        Response::build_from(body.respond_to(req)?)
            .header(rocket::http::ContentType::JSON)
            .status(status)
            .ok()
    }
}

#[catch(404)]
pub fn not_found(_req: &Request) -> AppError {
    AppError::NotFound("请求的资源不存在".into())
}

#[catch(401)]
pub fn unauthorized(_req: &Request) -> AppError {
    AppError::Unauthorized("请先登录".into())
}

#[catch(403)]
pub fn forbidden(_req: &Request) -> AppError {
    AppError::Forbidden("无权限执行此操作".into())
}

#[catch(500)]
pub fn internal_error(_req: &Request) -> AppError {
    AppError::Internal("服务器内部错误".into())
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        match e {
            sqlx::Error::RowNotFound => AppError::NotFound("记录不存在".into()),
            _ => AppError::Internal(format!("数据库错误: {}", e)),
        }
    }
}

impl From<jsonwebtoken::errors::Error> for AppError {
    fn from(e: jsonwebtoken::errors::Error) -> Self {
        AppError::Unauthorized(format!("Token错误: {}", e))
    }
}

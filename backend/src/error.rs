use poem_openapi::payload::Json;
use poem_openapi::{ApiResponse, Object};
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("数据库错误: {0}")]
    Database(String),
    #[error("未授权: {0}")]
    Unauthorized(String),
    #[error("禁止访问: {0}")]
    Forbidden(String),
    #[error("资源不存在: {0}")]
    NotFound(String),
    #[error("状态冲突: {0}")]
    StatusConflict(String),
    #[error("版本冲突: {0}")]
    VersionConflict(String),
    #[error("参数错误: {0}")]
    BadRequest(String),
    #[error("缺少证据: {0}")]
    MissingEvidence(String),
    #[error("重复提交: {0}")]
    DuplicateSubmit(String),
}

#[derive(Debug, Object, Serialize)]
pub struct ErrorResponse {
    pub code: i32,
    pub message: String,
    pub details: Option<String>,
}

#[derive(ApiResponse)]
pub enum ApiError {
    #[oai(status = 400)]
    BadRequest(Json<ErrorResponse>),
    #[oai(status = 401)]
    Unauthorized(Json<ErrorResponse>),
    #[oai(status = 403)]
    Forbidden(Json<ErrorResponse>),
    #[oai(status = 404)]
    NotFound(Json<ErrorResponse>),
    #[oai(status = 409)]
    Conflict(Json<ErrorResponse>),
    #[oai(status = 422)]
    Unprocessable(Json<ErrorResponse>),
    #[oai(status = 500)]
    Internal(Json<ErrorResponse>),
}

impl From<AppError> for ApiError {
    fn from(err: AppError) -> Self {
        match err {
            AppError::BadRequest(msg) => ApiError::BadRequest(Json(ErrorResponse {
                code: 400,
                message: msg,
                details: None,
            })),
            AppError::Unauthorized(msg) => ApiError::Unauthorized(Json(ErrorResponse {
                code: 401,
                message: msg,
                details: None,
            })),
            AppError::Forbidden(msg) => ApiError::Forbidden(Json(ErrorResponse {
                code: 403,
                message: msg,
                details: None,
            })),
            AppError::NotFound(msg) => ApiError::NotFound(Json(ErrorResponse {
                code: 404,
                message: msg,
                details: None,
            })),
            AppError::StatusConflict(msg) | AppError::VersionConflict(msg) | AppError::DuplicateSubmit(msg) => {
                ApiError::Conflict(Json(ErrorResponse {
                    code: 409,
                    message: msg,
                    details: None,
                }))
            }
            AppError::MissingEvidence(msg) => ApiError::Unprocessable(Json(ErrorResponse {
                code: 422,
                message: msg,
                details: None,
            })),
            AppError::Database(msg) => ApiError::Internal(Json(ErrorResponse {
                code: 500,
                message: msg,
                details: None,
            })),
        }
    }
}

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        AppError::Database(err.to_string())
    }
}

pub type ApiResult<T> = Result<T, ApiError>;

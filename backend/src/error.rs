use actix_web::{HttpResponse, ResponseError, http::StatusCode};
use thiserror::Error;
use serde::Serialize;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("数据库错误: {0}")]
    Database(String),

    #[error("权限错误: {0}")]
    Permission(String),

    #[error("校验错误: {0}")]
    Validation(String),

    #[error("版本冲突: {0}")]
    VersionConflict(String),

    #[error("状态冲突: {0}")]
    StatusConflict(String),

    #[error("资料缺失: {0}")]
    MissingMaterial(String),

    #[error("资源未找到: {0}")]
    NotFound(String),

    #[error("内部错误: {0}")]
    Internal(String),
}

#[derive(Serialize)]
struct ErrorResponse {
    success: bool,
    error: String,
}

impl ResponseError for AppError {
    fn status_code(&self) -> StatusCode {
        match self {
            AppError::Permission(_) => StatusCode::FORBIDDEN,
            AppError::Validation(_) | AppError::MissingMaterial(_) => StatusCode::BAD_REQUEST,
            AppError::VersionConflict(_) | AppError::StatusConflict(_) => StatusCode::CONFLICT,
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_response(&self) -> HttpResponse {
        let status = self.status_code();
        let body = ErrorResponse {
            success: false,
            error: self.to_string(),
        };
        HttpResponse::build(status).json(body)
    }
}

impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::Internal(err.to_string())
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::Database(err.to_string())
    }
}

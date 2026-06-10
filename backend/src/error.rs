use poem_openapi::payload::Json;
use poem_openapi::{ApiError, Object};
use serde::Serialize;

#[derive(Debug, Object, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
}

#[derive(Debug, ApiError)]
pub enum AppError {
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

    #[oai(status = 500)]
    Internal(Json<ErrorResponse>),
}

impl AppError {
    pub fn bad_request(msg: impl Into<String>) -> Self {
        AppError::BadRequest(Json(ErrorResponse {
            error: "BadRequest".to_string(),
            message: msg.into(),
        }))
    }

    pub fn unauthorized(msg: impl Into<String>) -> Self {
        AppError::Unauthorized(Json(ErrorResponse {
            error: "Unauthorized".to_string(),
            message: msg.into(),
        }))
    }

    pub fn forbidden(msg: impl Into<String>) -> Self {
        AppError::Forbidden(Json(ErrorResponse {
            error: "Forbidden".to_string(),
            message: msg.into(),
        }))
    }

    pub fn not_found(msg: impl Into<String>) -> Self {
        AppError::NotFound(Json(ErrorResponse {
            error: "NotFound".to_string(),
            message: msg.into(),
        }))
    }

    pub fn conflict(msg: impl Into<String>) -> Self {
        AppError::Conflict(Json(ErrorResponse {
            error: "Conflict".to_string(),
            message: msg.into(),
        }))
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        AppError::Internal(Json(ErrorResponse {
            error: "InternalServerError".to_string(),
            message: msg.into(),
        }))
    }
}

impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::internal(err.to_string())
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::internal(err.to_string())
    }
}

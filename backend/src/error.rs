use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),
    #[error("Authentication error: {0}")]
    AuthError(String),
    #[error("Authorization error: {0}")]
    AuthorizationError(String),
    #[error("Validation error: {0}")]
    ValidationError(String),
    #[error("State conflict error: {0}")]
    StateConflictError(String),
    #[error("Version conflict error: {0}")]
    VersionConflictError(String),
    #[error("Missing required evidence: {0}")]
    MissingEvidenceError(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Internal server error: {0}")]
    InternalError(String),
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
    code: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code) = match &self {
            AppError::DatabaseError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "DATABASE_ERROR"),
            AppError::AuthError(_) => (StatusCode::UNAUTHORIZED, "AUTH_ERROR"),
            AppError::AuthorizationError(_) => (StatusCode::FORBIDDEN, "AUTHORIZATION_ERROR"),
            AppError::ValidationError(_) => (StatusCode::BAD_REQUEST, "VALIDATION_ERROR"),
            AppError::StateConflictError(_) => (StatusCode::CONFLICT, "STATE_CONFLICT"),
            AppError::VersionConflictError(_) => (StatusCode::CONFLICT, "VERSION_CONFLICT"),
            AppError::MissingEvidenceError(_) => (StatusCode::BAD_REQUEST, "MISSING_EVIDENCE"),
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, "NOT_FOUND"),
            AppError::InternalError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR"),
        };

        let body = Json(ErrorResponse {
            error: self.to_string(),
            code: code.to_string(),
        });

        (status, body).into_response()
    }
}

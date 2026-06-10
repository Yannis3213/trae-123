use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Status conflict: {0}")]
    StatusConflict(String),

    #[error("Version conflict: stale version {0}, expected {1}")]
    VersionConflict(i64, i64),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Missing evidence: {0}")]
    MissingEvidence(String),
}

pub type AppResult<T> = Result<T, AppError>;

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::Database(e.to_string())
    }
}

impl From<r2d2::Error> for AppError {
    fn from(e: r2d2::Error) -> Self {
        AppError::Database(e.to_string())
    }
}

use rocket::http::Status;
use rocket::serde::json::{json, Value};
use rocket::Request;

impl<'r> rocket::response::Responder<'r, 'static> for AppError {
    fn respond_to(self, _req: &'r Request<'_>) -> rocket::response::Result<'static> {
        let status = match &self {
            AppError::Unauthorized(_) => Status::Unauthorized,
            AppError::Forbidden(_) => Status::Forbidden,
            AppError::Validation(_) | AppError::MissingEvidence(_) => Status::BadRequest,
            AppError::StatusConflict(_) | AppError::VersionConflict(_, _) => Status::Conflict,
            AppError::NotFound(_) => Status::NotFound,
            AppError::Database(_) => Status::InternalServerError,
        };

        let body: Value = json!({
            "error": status.to_string(),
            "message": self.to_string(),
        });

        rocket::response::Response::build()
            .status(status)
            .header(rocket::http::ContentType::JSON)
            .sized_body(body.to_string().len(), std::io::Cursor::new(body.to_string()))
            .ok()
    }
}

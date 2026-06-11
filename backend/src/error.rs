use poem::http::StatusCode;
use poem::IntoResponse;
use serde::Serialize;

#[derive(Debug, Clone)]
pub enum AppError {
    NotFound(String),
    Validation(String),
    Unauthorized(String),
    Conflict(String),
    Internal(String),
}

#[derive(Serialize)]
struct ErrorBody {
    code: i32,
    message: String,
}

impl AppError {
    pub fn status_code(&self) -> StatusCode {
        match self {
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::Validation(_) => StatusCode::BAD_REQUEST,
            AppError::Unauthorized(_) => StatusCode::FORBIDDEN,
            AppError::Conflict(_) => StatusCode::CONFLICT,
            AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    pub fn error_code(&self) -> i32 {
        match self {
            AppError::NotFound(_) => 404,
            AppError::Validation(_) => 400,
            AppError::Unauthorized(_) => 403,
            AppError::Conflict(_) => 409,
            AppError::Internal(_) => 500,
        }
    }

    pub fn message(&self) -> String {
        match self {
            AppError::NotFound(m) => m.clone(),
            AppError::Validation(m) => m.clone(),
            AppError::Unauthorized(m) => m.clone(),
            AppError::Conflict(m) => m.clone(),
            AppError::Internal(m) => m.clone(),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> poem::Response {
        let body = ErrorBody {
            code: self.error_code(),
            message: self.message(),
        };
        let json = serde_json::to_string(&body).unwrap_or_else(|_| r#"{"code":500,"message":"Internal Server Error"}"#.to_string());
        poem::Response::builder()
            .status(self.status_code())
            .header("content-type", "application/json")
            .body(json)
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::Internal(e.to_string())
    }
}

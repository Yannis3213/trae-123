use poem::http::StatusCode;
use poem::IntoResponse;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ApiError {
    pub error_code: String,
    pub message: String,
}

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("未授权")]
    Unauthorized,
    #[error("权限不足")]
    Forbidden,
    #[error("资源未找到: {0}")]
    NotFound(String),
    #[error("版本冲突")]
    VersionConflict,
    #[error("缺少必要证据: {0}")]
    MissingEvidence(String),
    #[error("状态不允许此操作")]
    InvalidStatus,
    #[error("当前用户不是处理人")]
    NotHandler,
    #[error("参数错误: {0}")]
    BadRequest(String),
    #[error("内部错误: {0}")]
    Internal(String),
}

impl AppError {
    pub fn error_code(&self) -> &str {
        match self {
            AppError::Unauthorized => "ERR_UNAUTHORIZED",
            AppError::Forbidden => "ERR_FORBIDDEN",
            AppError::NotFound(_) => "ERR_NOT_FOUND",
            AppError::VersionConflict => "ERR_VERSION_CONFLICT",
            AppError::MissingEvidence(_) => "ERR_MISSING_EVIDENCE",
            AppError::InvalidStatus => "ERR_INVALID_STATUS",
            AppError::NotHandler => "ERR_NOT_HANDLER",
            AppError::BadRequest(_) => "ERR_BAD_REQUEST",
            AppError::Internal(_) => "ERR_INTERNAL",
        }
    }

    pub fn status_code(&self) -> StatusCode {
        match self {
            AppError::Unauthorized => StatusCode::UNAUTHORIZED,
            AppError::Forbidden => StatusCode::FORBIDDEN,
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::VersionConflict => StatusCode::CONFLICT,
            AppError::MissingEvidence(_) => StatusCode::UNPROCESSABLE_ENTITY,
            AppError::InvalidStatus => StatusCode::UNPROCESSABLE_ENTITY,
            AppError::NotHandler => StatusCode::FORBIDDEN,
            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,
            AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> poem::Response {
        let status = self.status_code();
        let body = ApiError {
            error_code: self.error_code().to_string(),
            message: self.to_string(),
        };
        (status, poem::web::Json(serde_json::json!(body))).into_response()
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::Internal(e.to_string())
    }
}

impl From<AppError> for poem::Error {
    fn from(err: AppError) -> Self {
        let status = err.status_code();
        poem::Error::new(err, status)
    }
}

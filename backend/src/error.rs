use rocket::http::Status;
use rocket::serde::json::Json;
use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("数据库错误: {0}")]
    DatabaseError(#[from] rusqlite::Error),
    #[error("认证失败: {0}")]
    AuthError(String),
    #[error("权限不足: {0}")]
    PermissionError(String),
    #[error("版本冲突: 预期版本 {expected}, 实际版本 {actual}")]
    VersionConflict { expected: i32, actual: i32 },
    #[error("信息不完整: {0}")]
    IncompleteInfo(String),
    #[error("状态流转错误: 无法从 {from} 流转到 {to}")]
    InvalidStatusTransition { from: String, to: String },
    #[error("资源不存在: {0}")]
    NotFound(String),
    #[error("参数错误: {0}")]
    BadRequest(String),
    #[error("服务器内部错误: {0}")]
    InternalError(String),
}

#[derive(Serialize)]
pub struct ErrorResponse {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl From<AppError> for (Status, Json<ErrorResponse>) {
    fn from(error: AppError) -> Self {
        let status = match &error {
            AppError::AuthError(_) => Status::Unauthorized,
            AppError::PermissionError(_) => Status::Forbidden,
            AppError::VersionConflict { .. } => Status::Conflict,
            AppError::IncompleteInfo(_) => Status::BadRequest,
            AppError::InvalidStatusTransition { .. } => Status::BadRequest,
            AppError::NotFound(_) => Status::NotFound,
            AppError::BadRequest(_) => Status::BadRequest,
            _ => Status::InternalServerError,
        };

        let response = ErrorResponse {
            success: false,
            message: error.to_string(),
            details: None,
        };

        (status, Json(response))
    }
}

pub type Result<T> = std::result::Result<T, AppError>;

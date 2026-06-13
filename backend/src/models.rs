use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UserRole {
    Registrar,
    Auditor,
    Reviewer,
}

impl UserRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            UserRole::Registrar => "registrar",
            UserRole::Auditor => "auditor",
            UserRole::Reviewer => "reviewer",
        }
    }
    pub fn display_name(&self) -> &'static str {
        match self {
            UserRole::Registrar => "选题登记员（采编助理）",
            UserRole::Auditor => "选题审核主管（责任编辑）",
            UserRole::Reviewer => "复核负责人（总编室）",
        }
    }
}

impl std::str::FromStr for UserRole {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "registrar" => Ok(UserRole::Registrar),
            "auditor" => Ok(UserRole::Auditor),
            "reviewer" => Ok(UserRole::Reviewer),
            _ => Err(format!("Unknown role: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: String,
    pub username: String,
    pub password: String,
    pub role: String,
    pub display_name: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TopicStatus {
    PendingDispatch,
    Processing,
    Returned,
    Closed,
    Archived,
}

impl TopicStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            TopicStatus::PendingDispatch => "待派发",
            TopicStatus::Processing => "处理中",
            TopicStatus::Returned => "退回补正",
            TopicStatus::Closed => "已关闭",
            TopicStatus::Archived => "已归档",
        }
    }
    pub fn slug(&self) -> &'static str {
        match self {
            TopicStatus::PendingDispatch => "pending_dispatch",
            TopicStatus::Processing => "processing",
            TopicStatus::Returned => "returned",
            TopicStatus::Closed => "closed",
            TopicStatus::Archived => "archived",
        }
    }
}

impl std::str::FromStr for TopicStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "pending_dispatch" | "待派发" => Ok(TopicStatus::PendingDispatch),
            "processing" | "处理中" => Ok(TopicStatus::Processing),
            "returned" | "退回补正" => Ok(TopicStatus::Returned),
            "closed" | "已关闭" => Ok(TopicStatus::Closed),
            "archived" | "已归档" => Ok(TopicStatus::Archived),
            _ => Err(format!("Unknown status: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Topic {
    pub id: String,
    pub title: String,
    pub description: String,
    pub source: String,
    pub priority: String,
    pub category: String,
    pub status: String,
    pub applicant_id: Option<String>,
    pub applicant_name: String,
    pub current_handler_id: Option<String>,
    pub current_handler_name: Option<String>,
    pub interview_deadline: Option<DateTime<Utc>>,
    pub submission_deadline: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AttachmentType {
    Declaration,
    Interview,
    Manuscript,
    Evidence,
}

impl AttachmentType {
    pub fn as_str(&self) -> &'static str {
        match self {
            AttachmentType::Declaration => "选题申报",
            AttachmentType::Interview => "采访安排",
            AttachmentType::Manuscript => "稿件提交",
            AttachmentType::Evidence => "补充证据",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Attachment {
    pub id: String,
    pub topic_id: String,
    pub attachment_type: String,
    pub file_name: String,
    pub file_url: String,
    pub description: String,
    pub uploaded_by: String,
    pub uploaded_by_name: String,
    pub uploaded_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProcessRecord {
    pub id: String,
    pub topic_id: String,
    pub action: String,
    pub from_status: Option<String>,
    pub to_status: Option<String>,
    pub handler_id: String,
    pub handler_name: String,
    pub handler_role: String,
    pub opinion: String,
    pub remark: Option<String>,
    pub created_at: DateTime<Utc>,
    pub version_after: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AuditLog {
    pub id: String,
    pub topic_id: String,
    pub user_id: String,
    pub user_name: String,
    pub user_role: String,
    pub action: String,
    pub detail: String,
    pub ip_address: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub username: String,
    pub role: String,
    pub display_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTopicRequest {
    pub title: String,
    pub description: String,
    pub source: String,
    pub priority: String,
    pub category: String,
    pub interview_deadline: Option<DateTime<Utc>>,
    pub submission_deadline: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTopicRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub source: Option<String>,
    pub priority: Option<String>,
    pub category: Option<String>,
    pub interview_deadline: Option<Option<DateTime<Utc>>>,
    pub submission_deadline: Option<Option<DateTime<Utc>>>,
    pub version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessTopicRequest {
    pub action: String,
    pub opinion: String,
    pub remark: Option<String>,
    pub target_handler_id: Option<String>,
    pub version: i64,
    pub attachments: Option<Vec<AttachmentInput>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentInput {
    pub attachment_type: String,
    pub file_name: String,
    pub file_url: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchProcessRequest {
    pub ids: Vec<String>,
    pub action: String,
    pub opinion: String,
    pub remark: Option<String>,
    pub target_handler_id: Option<String>,
    pub versions: std::collections::HashMap<String, i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchResultItem {
    pub id: String,
    pub title: String,
    pub success: bool,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub new_status: Option<String>,
    pub new_version: Option<i64>,
    pub record_id: Option<String>,
    pub audit_summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchProcessResponse {
    pub total: usize,
    pub success_count: usize,
    pub failed_count: usize,
    pub results: Vec<BatchResultItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopicListQuery {
    pub status: Option<String>,
    pub category: Option<String>,
    pub priority: Option<String>,
    pub keyword: Option<String>,
    pub page: Option<u64>,
    pub page_size: Option<u64>,
    pub warning: Option<String>,
    pub sort_by: Option<String>,
    pub sort_dir: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopicDetailResponse {
    pub topic: Topic,
    pub attachments: Vec<Attachment>,
    pub records: Vec<ProcessRecord>,
    pub audits: Vec<AuditLog>,
    pub warning_level: String,
    pub is_overdue: bool,
    pub overdue_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub code: String,
    pub message: String,
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub enum AppError {
    Unauthorized(String),
    Forbidden(String),
    NotFound(String),
    BadRequest(String),
    StateConflict(String),
    VersionConflict(String),
    ValidationFailed(String),
    Internal(String),
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::Unauthorized(s) => write!(f, "未授权: {}", s),
            AppError::Forbidden(s) => write!(f, "无权限: {}", s),
            AppError::NotFound(s) => write!(f, "未找到: {}", s),
            AppError::BadRequest(s) => write!(f, "请求错误: {}", s),
            AppError::StateConflict(s) => write!(f, "状态冲突: {}", s),
            AppError::VersionConflict(s) => write!(f, "版本冲突: {}", s),
            AppError::ValidationFailed(s) => write!(f, "校验失败: {}", s),
            AppError::Internal(s) => write!(f, "内部错误: {}", s),
        }
    }
}

impl std::error::Error for AppError {}

impl AppError {
    pub fn code(&self) -> &'static str {
        match self {
            AppError::Unauthorized(_) => "UNAUTHORIZED",
            AppError::Forbidden(_) => "FORBIDDEN",
            AppError::NotFound(_) => "NOT_FOUND",
            AppError::BadRequest(_) => "BAD_REQUEST",
            AppError::StateConflict(_) => "STATE_CONFLICT",
            AppError::VersionConflict(_) => "VERSION_CONFLICT",
            AppError::ValidationFailed(_) => "VALIDATION_FAILED",
            AppError::Internal(_) => "INTERNAL_ERROR",
        }
    }
    pub fn status_code(&self) -> poem::http::StatusCode {
        match self {
            AppError::Unauthorized(_) => poem::http::StatusCode::UNAUTHORIZED,
            AppError::Forbidden(_) => poem::http::StatusCode::FORBIDDEN,
            AppError::NotFound(_) => poem::http::StatusCode::NOT_FOUND,
            AppError::BadRequest(_) => poem::http::StatusCode::BAD_REQUEST,
            AppError::StateConflict(_) => poem::http::StatusCode::CONFLICT,
            AppError::VersionConflict(_) => poem::http::StatusCode::CONFLICT,
            AppError::ValidationFailed(_) => poem::http::StatusCode::BAD_REQUEST,
            AppError::Internal(_) => poem::http::StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SamplingTask {
    pub id: String,
    pub task_name: String,
    pub order_no: String,
    pub style_no: Option<String>,
    pub priority: String,
    pub status: String,
    pub current_handler: String,
    pub responsible_person: String,
    pub deadline: DateTime<Utc>,
    pub sample_confirmation_status: Option<String>,
    pub mass_production_evidence: Option<String>,
    #[sqlx(rename = "has_mass_production_evidence")]
    pub has_mass_production_evidence: bool,
    pub version: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: String,
    pub last_updated_by: String,
    #[sqlx(rename = "is_overdue")]
    pub is_overdue: bool,
    pub overdue_reason: Option<String>,
    pub return_reason: Option<String>,
    pub abnormal_tags: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Attachment {
    pub id: String,
    pub task_id: String,
    pub file_name: String,
    pub file_type: String,
    pub file_size: i64,
    pub file_url: String,
    pub uploaded_by: String,
    pub uploaded_at: DateTime<Utc>,
    pub evidence_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProcessingRecord {
    pub id: String,
    pub task_id: String,
    pub action: String,
    pub from_status: Option<String>,
    pub to_status: Option<String>,
    pub operator_role: String,
    pub operator_name: String,
    pub handler_before: Option<String>,
    pub handler_after: Option<String>,
    pub opinion: Option<String>,
    pub result: Option<String>,
    pub created_at: DateTime<Utc>,
    pub version: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AuditNote {
    pub id: String,
    pub task_id: String,
    pub note_content: String,
    pub operator_role: String,
    pub operator_name: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AbnormalReason {
    pub id: String,
    pub task_id: String,
    pub reason_type: String,
    pub description: String,
    pub operator_role: String,
    pub operator_name: String,
    pub created_at: DateTime<Utc>,
}

pub mod roles {
    pub const SAMPLING_REGISTRAR: &str = "sampling_registrar";
    pub const SAMPLING_SUPERVISOR: &str = "sampling_supervisor";
    pub const FACTORY_REVIEWER: &str = "factory_reviewer";
}

pub mod statuses {
    pub const PENDING_ASSIGNMENT: &str = "pending_assignment";
    pub const ASSIGNED: &str = "assigned";
    pub const PENDING_REVIEW: &str = "pending_review";
    pub const REVIEWED: &str = "reviewed";
    pub const PENDING_VERIFICATION: &str = "pending_verification";
    pub const VERIFIED: &str = "verified";
    pub const ARCHIVED: &str = "archived";
    pub const RETURNED: &str = "returned";
    pub const OVERDUE: &str = "overdue";
    pub const RECTIFIED: &str = "rectified";
    pub const TRANSFERRED: &str = "transferred";
    pub const VISITED: &str = "visited";
}

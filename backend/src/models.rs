use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UserRole {
    StoreManager,
    OperationsSupervisor,
    HeadquartersOperations,
    ReplenishmentRegistrar,
    ReplenishmentAuditor,
    ChainReviewLead,
}

impl UserRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            UserRole::StoreManager => "store_manager",
            UserRole::OperationsSupervisor => "operations_supervisor",
            UserRole::HeadquartersOperations => "headquarters_operations",
            UserRole::ReplenishmentRegistrar => "replenishment_registrar",
            UserRole::ReplenishmentAuditor => "replenishment_auditor",
            UserRole::ChainReviewLead => "chain_review_lead",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "store_manager" => Some(UserRole::StoreManager),
            "operations_supervisor" => Some(UserRole::OperationsSupervisor),
            "headquarters_operations" => Some(UserRole::HeadquartersOperations),
            "replenishment_registrar" => Some(UserRole::ReplenishmentRegistrar),
            "replenishment_auditor" => Some(UserRole::ReplenishmentAuditor),
            "chain_review_lead" => Some(UserRole::ChainReviewLead),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApplicationStatus {
    Draft,
    PendingSignature,
    ExceptionReturned,
    SignatureComplete,
    Archived,
    CorrectionPending,
}

impl ApplicationStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ApplicationStatus::Draft => "draft",
            ApplicationStatus::PendingSignature => "pending_signature",
            ApplicationStatus::ExceptionReturned => "exception_returned",
            ApplicationStatus::SignatureComplete => "signature_complete",
            ApplicationStatus::Archived => "archived",
            ApplicationStatus::CorrectionPending => "correction_pending",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "draft" => Some(ApplicationStatus::Draft),
            "pending_signature" => Some(ApplicationStatus::PendingSignature),
            "exception_returned" => Some(ApplicationStatus::ExceptionReturned),
            "signature_complete" => Some(ApplicationStatus::SignatureComplete),
            "archived" => Some(ApplicationStatus::Archived),
            "correction_pending" => Some(ApplicationStatus::CorrectionPending),
            _ => None,
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            ApplicationStatus::Draft => "草稿",
            ApplicationStatus::PendingSignature => "待签收",
            ApplicationStatus::ExceptionReturned => "异常回传",
            ApplicationStatus::SignatureComplete => "签收完成",
            ApplicationStatus::Archived => "已归档",
            ApplicationStatus::CorrectionPending => "待补正",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Priority {
    Low,
    Medium,
    High,
    Urgent,
}

impl Priority {
    pub fn as_str(&self) -> &'static str {
        match self {
            Priority::Low => "low",
            Priority::Medium => "medium",
            Priority::High => "high",
            Priority::Urgent => "urgent",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "low" => Some(Priority::Low),
            "medium" => Some(Priority::Medium),
            "high" => Some(Priority::High),
            "urgent" => Some(Priority::Urgent),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub display_name: String,
    pub role: UserRole,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplenishmentApplication {
    pub id: String,
    pub application_no: String,
    pub store_id: String,
    pub store_name: String,
    pub title: String,
    pub description: String,
    pub status: ApplicationStatus,
    pub priority: Priority,
    pub responsible_person: String,
    pub current_handler: String,
    pub deadline: DateTime<Utc>,
    pub version: i64,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub exception_tags: Vec<String>,
    pub is_overdue: bool,
    pub is_near_deadline: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: String,
    pub application_id: String,
    pub file_name: String,
    pub file_type: String,
    pub uploaded_by: String,
    pub uploaded_at: DateTime<Utc>,
    pub is_evidence: bool,
    pub file_content_base64: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingRecord {
    pub id: String,
    pub application_id: String,
    pub from_status: Option<ApplicationStatus>,
    pub to_status: ApplicationStatus,
    pub action: String,
    pub operator_id: String,
    pub operator_name: String,
    pub result: Option<String>,
    pub return_reason: Option<String>,
    pub processed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditNote {
    pub id: String,
    pub application_id: String,
    pub author_id: String,
    pub author_name: String,
    pub note: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExceptionLog {
    pub id: String,
    pub application_id: String,
    pub exception_type: String,
    pub description: String,
    pub operator_id: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessRequest {
    pub application_id: String,
    pub action: String,
    pub result: Option<String>,
    pub return_reason: Option<String>,
    pub evidence_required: Vec<String>,
    pub current_version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchProcessItem {
    pub application_id: String,
    pub action: String,
    pub result: Option<String>,
    pub return_reason: Option<String>,
    pub current_version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchProcessRequest {
    pub items: Vec<BatchProcessItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchResultItem {
    pub application_id: String,
    pub application_no: String,
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchProcessResponse {
    pub results: Vec<BatchResultItem>,
    pub total_success: usize,
    pub total_failed: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplicationDetail {
    pub application: ReplenishmentApplication,
    pub attachments: Vec<Attachment>,
    pub processing_records: Vec<ProcessingRecord>,
    pub audit_notes: Vec<AuditNote>,
    pub exception_logs: Vec<ExceptionLog>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateApplicationRequest {
    pub store_id: String,
    pub store_name: String,
    pub title: String,
    pub description: String,
    pub priority: Priority,
    pub deadline: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentUploadRequest {
    pub application_id: String,
    pub file_name: String,
    pub file_type: String,
    pub file_content_base64: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisibleScope {
    pub can_create: bool,
    pub can_process: bool,
    pub can_view_all: bool,
    pub allowed_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginResponse {
    pub user: User,
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplicationFilter {
    pub status: Option<ApplicationStatus>,
    pub priority: Option<Priority>,
    pub store_id: Option<String>,
    pub responsible_person: Option<String>,
    pub is_overdue: Option<bool>,
    pub keyword: Option<String>,
}

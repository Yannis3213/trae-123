use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Dispatcher,
    PoliceOfficer,
    Reviewer,
}

impl Role {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "dispatcher" => Some(Role::Dispatcher),
            "police_officer" => Some(Role::PoliceOfficer),
            "reviewer" => Some(Role::Reviewer),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Role::Dispatcher => "dispatcher",
            Role::PoliceOfficer => "police_officer",
            Role::Reviewer => "reviewer",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Role::Dispatcher => "警情处置登记员",
            Role::PoliceOfficer => "警情处置审核主管",
            Role::Reviewer => "派出所复核负责人",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CaseStatus {
    PendingCorrection,
    UnderReview,
    Completed,
}

impl CaseStatus {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "pending_correction" => Some(CaseStatus::PendingCorrection),
            "under_review" => Some(CaseStatus::UnderReview),
            "completed" => Some(CaseStatus::Completed),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            CaseStatus::PendingCorrection => "pending_correction",
            CaseStatus::UnderReview => "under_review",
            CaseStatus::Completed => "completed",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            CaseStatus::PendingCorrection => "待补正",
            CaseStatus::UnderReview => "复核中",
            CaseStatus::Completed => "办结",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ProcessingStage {
    Registration,
    Dispatch,
    Review,
}

impl ProcessingStage {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "registration" => Some(ProcessingStage::Registration),
            "dispatch" => Some(ProcessingStage::Dispatch),
            "review" => Some(ProcessingStage::Review),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            ProcessingStage::Registration => "registration",
            ProcessingStage::Dispatch => "dispatch",
            ProcessingStage::Review => "review",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            ProcessingStage::Registration => "警情登记",
            ProcessingStage::Dispatch => "处置派警",
            ProcessingStage::Review => "复核归档",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExpiryStatus {
    Normal,
    NearingExpiry,
    Overdue,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub real_name: String,
    pub role: Role,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Case {
    pub id: Uuid,
    pub case_number: String,
    pub title: String,
    pub description: String,
    pub case_type: String,
    pub location: String,
    pub reporter_name: String,
    pub reporter_phone: String,
    pub status: CaseStatus,
    pub current_stage: ProcessingStage,
    pub current_handler_id: Option<Uuid>,
    pub current_handler_name: Option<String>,
    pub registration_materials_complete: bool,
    pub dispatch_timeline_met: bool,
    pub followup_evidence_complete: bool,
    pub deadline: DateTime<Utc>,
    pub version: i64,
    pub created_by: Uuid,
    pub created_by_name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CaseWithDetail {
    #[serde(flatten)]
    pub case: Case,
    pub expiry_status: ExpiryStatus,
    pub attachments: Vec<Attachment>,
    pub processing_records: Vec<ProcessingRecord>,
    pub audit_notes: Vec<AuditNote>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Attachment {
    pub id: Uuid,
    pub case_id: Uuid,
    pub file_name: String,
    pub file_type: String,
    pub file_size: i64,
    pub category: String,
    pub uploaded_by: Uuid,
    pub uploaded_by_name: String,
    pub uploaded_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessingRecord {
    pub id: Uuid,
    pub case_id: Uuid,
    pub stage: ProcessingStage,
    pub action: String,
    pub from_status: Option<CaseStatus>,
    pub to_status: CaseStatus,
    pub handler_id: Uuid,
    pub handler_name: String,
    pub handler_role: Role,
    pub remarks: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuditNote {
    pub id: Uuid,
    pub case_id: Uuid,
    pub note: String,
    pub anomaly_reason: Option<String>,
    pub noted_by: Uuid,
    pub noted_by_name: String,
    pub noted_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: User,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub user_id: Uuid,
    pub username: String,
    pub role: Role,
    pub exp: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateCaseRequest {
    pub title: String,
    pub description: String,
    pub case_type: String,
    pub location: String,
    pub reporter_name: String,
    pub reporter_phone: String,
    pub deadline: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStatusRequest {
    pub case_id: Uuid,
    pub to_status: CaseStatus,
    pub remarks: String,
    pub version: i64,
    pub registration_materials_complete: Option<bool>,
    pub dispatch_timeline_met: Option<bool>,
    pub followup_evidence_complete: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct BatchProcessRequest {
    pub case_ids: Vec<Uuid>,
    pub to_status: CaseStatus,
    pub remarks: String,
    pub version_map: std::collections::HashMap<String, i64>,
}

#[derive(Debug, Serialize)]
pub struct BatchProcessResult {
    pub case_id: Uuid,
    pub case_number: String,
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_details: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct AddAttachmentRequest {
    pub case_id: Uuid,
    pub file_name: String,
    pub file_type: String,
    pub file_size: i64,
    pub category: String,
}

#[derive(Debug, Deserialize)]
pub struct AddAuditNoteRequest {
    pub case_id: Uuid,
    pub note: String,
    pub anomaly_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CaseListQuery {
    pub status: Option<CaseStatus>,
    pub stage: Option<ProcessingStage>,
    pub expiry: Option<ExpiryStatus>,
    pub keyword: Option<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

#[derive(Debug, Serialize)]
pub struct StatisticsResponse {
    pub total_cases: i64,
    pub pending_correction: i64,
    pub under_review: i64,
    pub completed: i64,
    pub normal: i64,
    pub nearing_expiry: i64,
    pub overdue: i64,
    pub by_stage_registration: i64,
    pub by_stage_dispatch: i64,
    pub by_stage_review: i64,
}

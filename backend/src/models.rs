use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    CreativeRegistrar,
    ReviewSupervisor,
    ReviewManager,
}

impl Role {
    pub fn as_str(&self) -> &str {
        match self {
            Role::CreativeRegistrar => "creative_registrar",
            Role::ReviewSupervisor => "review_supervisor",
            Role::ReviewManager => "review_manager",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "creative_registrar" => Some(Role::CreativeRegistrar),
            "review_supervisor" => Some(Role::ReviewSupervisor),
            "review_manager" => Some(Role::ReviewManager),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Draft,
    PendingSubmit,
    Submitted,
    UnderReview,
    Returned,
    Resubmitted,
    Reviewed,
    Archived,
}

impl Status {
    pub fn as_str(&self) -> &str {
        match self {
            Status::Draft => "draft",
            Status::PendingSubmit => "pending_submit",
            Status::Submitted => "submitted",
            Status::UnderReview => "under_review",
            Status::Returned => "returned",
            Status::Resubmitted => "resubmitted",
            Status::Reviewed => "reviewed",
            Status::Archived => "archived",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "draft" => Some(Status::Draft),
            "pending_submit" => Some(Status::PendingSubmit),
            "submitted" => Some(Status::Submitted),
            "under_review" => Some(Status::UnderReview),
            "returned" => Some(Status::Returned),
            "resubmitted" => Some(Status::Resubmitted),
            "reviewed" => Some(Status::Reviewed),
            "archived" => Some(Status::Archived),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BriefStatus {
    Pending,
    Received,
    Missing,
}

impl BriefStatus {
    pub fn as_str(&self) -> &str {
        match self {
            BriefStatus::Pending => "pending",
            BriefStatus::Received => "received",
            BriefStatus::Missing => "missing",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "pending" => Some(BriefStatus::Pending),
            "received" => Some(BriefStatus::Received),
            "missing" => Some(BriefStatus::Missing),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ScheduleStatus {
    Pending,
    Scheduled,
    Missing,
}

impl ScheduleStatus {
    pub fn as_str(&self) -> &str {
        match self {
            ScheduleStatus::Pending => "pending",
            ScheduleStatus::Scheduled => "scheduled",
            ScheduleStatus::Missing => "missing",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "pending" => Some(ScheduleStatus::Pending),
            "scheduled" => Some(ScheduleStatus::Scheduled),
            "missing" => Some(ScheduleStatus::Missing),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DeadlineWarning {
    Normal,
    Approaching,
    Overdue,
}

impl DeadlineWarning {
    pub fn as_str(&self) -> &str {
        match self {
            DeadlineWarning::Normal => "normal",
            DeadlineWarning::Approaching => "approaching",
            DeadlineWarning::Overdue => "overdue",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum NoteType {
    Audit,
    Supplement,
    Exception,
}

impl NoteType {
    pub fn as_str(&self) -> &str {
        match self {
            NoteType::Audit => "audit",
            NoteType::Supplement => "supplement",
            NoteType::Exception => "exception",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "audit" => Some(NoteType::Audit),
            "supplement" => Some(NoteType::Supplement),
            "exception" => Some(NoteType::Exception),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AttachmentCategory {
    Brief,
    Schedule,
    CreativeMaterial,
    Other,
}

impl AttachmentCategory {
    pub fn as_str(&self) -> &str {
        match self {
            AttachmentCategory::Brief => "brief",
            AttachmentCategory::Schedule => "schedule",
            AttachmentCategory::CreativeMaterial => "creative_material",
            AttachmentCategory::Other => "other",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "brief" => Some(AttachmentCategory::Brief),
            "schedule" => Some(AttachmentCategory::Schedule),
            "creative_material" => Some(AttachmentCategory::CreativeMaterial),
            "other" => Some(AttachmentCategory::Other),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub display_name: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreativeRequest {
    pub id: i64,
    pub request_number: String,
    pub title: String,
    pub client_name: String,
    pub brand: String,
    pub campaign_name: String,
    pub brief_status: String,
    pub schedule_status: String,
    pub status: String,
    pub current_handler_role: String,
    pub current_handler_id: i64,
    pub deadline: String,
    pub version: i64,
    pub description: String,
    pub created_by: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreativeRequestWithExtras {
    #[serde(flatten)]
    pub request: CreativeRequest,
    pub deadline_warning: String,
    pub handler_name: String,
    pub creator_name: String,
    pub attachments: Vec<Attachment>,
    pub processing_records: Vec<ProcessingRecord>,
    pub audit_notes: Vec<AuditNote>,
    pub exception_reasons: Vec<ExceptionReason>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreativeRequestListItem {
    #[serde(flatten)]
    pub request: CreativeRequest,
    pub deadline_warning: String,
    pub handler_name: String,
    pub creator_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: i64,
    pub request_id: i64,
    pub file_name: String,
    pub file_path: String,
    pub file_type: String,
    pub category: String,
    pub uploaded_by: i64,
    pub uploaded_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingRecord {
    pub id: i64,
    pub request_id: i64,
    pub handler_id: i64,
    pub handler_role: String,
    pub action: String,
    pub opinion: String,
    pub from_status: String,
    pub to_status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditNote {
    pub id: i64,
    pub request_id: i64,
    pub author_id: i64,
    pub content: String,
    pub note_type: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExceptionReason {
    pub id: i64,
    pub request_id: i64,
    pub reason_type: String,
    pub description: String,
    pub reported_by: i64,
    pub resolved: bool,
    pub resolved_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateRequestPayload {
    pub title: String,
    pub client_name: String,
    pub brand: String,
    pub campaign_name: String,
    pub brief_status: Option<String>,
    pub schedule_status: Option<String>,
    pub deadline: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRequestPayload {
    pub title: Option<String>,
    pub client_name: Option<String>,
    pub brand: Option<String>,
    pub campaign_name: Option<String>,
    pub brief_status: Option<String>,
    pub schedule_status: Option<String>,
    pub deadline: Option<String>,
    pub description: Option<String>,
    pub version: i64,
}

#[derive(Debug, Deserialize)]
pub struct SubmitRequestPayload {
    pub version: i64,
}

#[derive(Debug, Deserialize)]
pub struct ReviewRequestPayload {
    pub action: String,
    pub opinion: String,
    pub version: i64,
}

#[derive(Debug, Deserialize)]
pub struct SupplementRequestPayload {
    pub brief_status: Option<String>,
    pub schedule_status: Option<String>,
    pub description: Option<String>,
    pub version: i64,
}

#[derive(Debug, Deserialize)]
pub struct BatchItem {
    pub id: i64,
    pub version: i64,
    pub action: String,
    pub opinion: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BatchRequestPayload {
    pub items: Vec<BatchItem>,
}

#[derive(Debug, Serialize)]
pub struct BatchResult {
    pub results: Vec<BatchItemResult>,
}

#[derive(Debug, Serialize)]
pub struct BatchItemResult {
    pub id: i64,
    pub success: bool,
    pub error: Option<String>,
    pub new_status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LoginPayload {
    pub username: String,
}

#[derive(Debug, Deserialize)]
pub struct ListQueryParams {
    pub status: Option<String>,
    pub role: Option<String>,
    pub keyword: Option<String>,
    pub deadline_warning: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddAuditNotePayload {
    pub content: String,
    pub note_type: String,
}

#[derive(Debug, Deserialize)]
pub struct UploadAttachmentPayload {
    pub file_name: String,
    pub file_data: String,
    pub file_type: String,
    pub category: String,
}

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub total: i64,
    pub draft: i64,
    pub pending_submit: i64,
    pub submitted: i64,
    pub under_review: i64,
    pub returned: i64,
    pub resubmitted: i64,
    pub reviewed: i64,
    pub archived: i64,
    pub overdue: i64,
    pub approaching: i64,
}

pub fn compute_deadline_warning(deadline_str: &str) -> DeadlineWarning {
    let now = chrono::Utc::now().naive_utc();
    let three_days_secs: i64 = 3 * 24 * 3600;
    match NaiveDateTime::parse_from_str(deadline_str, "%Y-%m-%d %H:%M:%S") {
        Ok(deadline) => {
            let diff = deadline.signed_duration_since(now);
            let secs = diff.num_seconds();
            if secs > three_days_secs {
                DeadlineWarning::Normal
            } else if secs > 0 {
                DeadlineWarning::Approaching
            } else {
                DeadlineWarning::Overdue
            }
        }
        Err(_) => match chrono::NaiveDate::parse_from_str(deadline_str, "%Y-%m-%d") {
            Ok(date) => {
                let deadline = date.and_hms_opt(23, 59, 59).unwrap();
                let diff = deadline.signed_duration_since(now);
                let secs = diff.num_seconds();
                if secs > three_days_secs {
                    DeadlineWarning::Normal
                } else if secs > 0 {
                    DeadlineWarning::Approaching
                } else {
                    DeadlineWarning::Overdue
                }
            }
            Err(_) => DeadlineWarning::Normal,
        },
    }
}

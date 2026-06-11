use chrono::{DateTime, NaiveDateTime, TimeZone, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

fn parse_sqlite_datetime(s: &str) -> Result<DateTime<Utc>, String> {
    if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
        return Ok(dt.with_timezone(&Utc));
    }
    if let Ok(naive) = NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S") {
        return Ok(Utc.from_utc_datetime(&naive));
    }
    Err(format!("无法解析时间字符串: {}", s))
}

fn parse_optional_sqlite_datetime(s: Option<&str>) -> Result<Option<DateTime<Utc>>, String> {
    match s {
        Some(s) if !s.is_empty() => parse_sqlite_datetime(s).map(Some),
        _ => Ok(None),
    }
}

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

#[derive(Debug, FromRow)]
pub struct UserRow {
    pub id: String,
    pub username: String,
    pub real_name: String,
    pub role: String,
    pub password_hash: String,
    pub created_at: String,
    pub updated_at: String,
}

impl TryFrom<UserRow> for User {
    type Error = String;
    fn try_from(r: UserRow) -> Result<Self, Self::Error> {
        Ok(User {
            id: Uuid::parse_str(&r.id).map_err(|e| format!("{}", e))?,
            username: r.username,
            real_name: r.real_name,
            role: Role::from_str(&r.role).ok_or_else(|| format!("无效的role: {}", r.role))?,
            password_hash: r.password_hash,
            created_at: parse_sqlite_datetime(&r.created_at)?,
            updated_at: parse_sqlite_datetime(&r.updated_at)?,
        })
    }
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

#[derive(Debug, FromRow)]
pub struct CaseRow {
    pub id: String,
    pub case_number: String,
    pub title: String,
    pub description: String,
    pub case_type: String,
    pub location: String,
    pub reporter_name: String,
    pub reporter_phone: String,
    pub status: String,
    pub current_stage: String,
    pub current_handler_id: Option<String>,
    pub current_handler_name: Option<String>,
    pub registration_materials_complete: i32,
    pub dispatch_timeline_met: i32,
    pub followup_evidence_complete: i32,
    pub deadline: String,
    pub version: i64,
    pub created_by: String,
    pub created_by_name: String,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
}

impl TryFrom<CaseRow> for Case {
    type Error = String;
    fn try_from(r: CaseRow) -> Result<Self, Self::Error> {
        Ok(Case {
            id: Uuid::parse_str(&r.id).map_err(|e| format!("{}", e))?,
            case_number: r.case_number,
            title: r.title,
            description: r.description,
            case_type: r.case_type,
            location: r.location,
            reporter_name: r.reporter_name,
            reporter_phone: r.reporter_phone,
            status: CaseStatus::from_str(&r.status).ok_or_else(|| format!("无效的status: {}", r.status))?,
            current_stage: ProcessingStage::from_str(&r.current_stage).ok_or_else(|| format!("无效的stage: {}", r.current_stage))?,
            current_handler_id: r.current_handler_id.as_deref().map(Uuid::parse_str).transpose().map_err(|e| format!("{}", e))?,
            current_handler_name: r.current_handler_name,
            registration_materials_complete: r.registration_materials_complete != 0,
            dispatch_timeline_met: r.dispatch_timeline_met != 0,
            followup_evidence_complete: r.followup_evidence_complete != 0,
            deadline: parse_sqlite_datetime(&r.deadline)?,
            version: r.version,
            created_by: Uuid::parse_str(&r.created_by).map_err(|e| format!("{}", e))?,
            created_by_name: r.created_by_name,
            created_at: parse_sqlite_datetime(&r.created_at)?,
            updated_at: parse_sqlite_datetime(&r.updated_at)?,
            completed_at: parse_optional_sqlite_datetime(r.completed_at.as_deref())?,
        })
    }
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

#[derive(Debug, FromRow)]
pub struct AttachmentRow {
    pub id: String,
    pub case_id: String,
    pub file_name: String,
    pub file_type: String,
    pub file_size: i64,
    pub category: String,
    pub uploaded_by: String,
    pub uploaded_by_name: String,
    pub uploaded_at: String,
}

impl TryFrom<AttachmentRow> for Attachment {
    type Error = String;
    fn try_from(r: AttachmentRow) -> Result<Self, Self::Error> {
        Ok(Attachment {
            id: Uuid::parse_str(&r.id).map_err(|e| format!("{}", e))?,
            case_id: Uuid::parse_str(&r.case_id).map_err(|e| format!("{}", e))?,
            file_name: r.file_name,
            file_type: r.file_type,
            file_size: r.file_size,
            category: r.category,
            uploaded_by: Uuid::parse_str(&r.uploaded_by).map_err(|e| format!("{}", e))?,
            uploaded_by_name: r.uploaded_by_name,
            uploaded_at: parse_sqlite_datetime(&r.uploaded_at)?,
        })
    }
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

#[derive(Debug, FromRow)]
pub struct ProcessingRecordRow {
    pub id: String,
    pub case_id: String,
    pub stage: String,
    pub action: String,
    pub from_status: Option<String>,
    pub to_status: String,
    pub handler_id: String,
    pub handler_name: String,
    pub handler_role: String,
    pub remarks: String,
    pub created_at: String,
}

impl TryFrom<ProcessingRecordRow> for ProcessingRecord {
    type Error = String;
    fn try_from(r: ProcessingRecordRow) -> Result<Self, Self::Error> {
        Ok(ProcessingRecord {
            id: Uuid::parse_str(&r.id).map_err(|e| format!("{}", e))?,
            case_id: Uuid::parse_str(&r.case_id).map_err(|e| format!("{}", e))?,
            stage: ProcessingStage::from_str(&r.stage).ok_or_else(|| format!("无效的stage: {}", r.stage))?,
            action: r.action,
            from_status: r.from_status.as_deref().and_then(CaseStatus::from_str),
            to_status: CaseStatus::from_str(&r.to_status).ok_or_else(|| format!("无效的to_status: {}", r.to_status))?,
            handler_id: Uuid::parse_str(&r.handler_id).map_err(|e| format!("{}", e))?,
            handler_name: r.handler_name,
            handler_role: Role::from_str(&r.handler_role).ok_or_else(|| format!("无效的handler_role: {}", r.handler_role))?,
            remarks: r.remarks,
            created_at: parse_sqlite_datetime(&r.created_at)?,
        })
    }
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

#[derive(Debug, FromRow)]
pub struct AuditNoteRow {
    pub id: String,
    pub case_id: String,
    pub note: String,
    pub anomaly_reason: Option<String>,
    pub noted_by: String,
    pub noted_by_name: String,
    pub noted_at: String,
}

impl TryFrom<AuditNoteRow> for AuditNote {
    type Error = String;
    fn try_from(r: AuditNoteRow) -> Result<Self, Self::Error> {
        Ok(AuditNote {
            id: Uuid::parse_str(&r.id).map_err(|e| format!("{}", e))?,
            case_id: Uuid::parse_str(&r.case_id).map_err(|e| format!("{}", e))?,
            note: r.note,
            anomaly_reason: r.anomaly_reason,
            noted_by: Uuid::parse_str(&r.noted_by).map_err(|e| format!("{}", e))?,
            noted_by_name: r.noted_by_name,
            noted_at: parse_sqlite_datetime(&r.noted_at)?,
        })
    }
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

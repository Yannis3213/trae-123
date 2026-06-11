use chrono::{DateTime, Utc};
use rusqlite::Row;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub trait FromRow: Sized {
    fn from_row(row: &Row) -> rusqlite::Result<Self>;
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum UserRole {
    #[serde(rename = "registrar")]
    Registrar,
    #[serde(rename = "supervisor")]
    Supervisor,
    #[serde(rename = "reviewer")]
    Reviewer,
    #[serde(rename = "director")]
    Director,
    #[serde(rename = "assistant")]
    Assistant,
    #[serde(rename = "lawyer")]
    Lawyer,
}

pub use UserRole as Role;

impl UserRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            UserRole::Registrar => "registrar",
            UserRole::Supervisor => "supervisor",
            UserRole::Reviewer => "reviewer",
            UserRole::Director => "director",
            UserRole::Assistant => "assistant",
            UserRole::Lawyer => "lawyer",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "registrar" => Some(UserRole::Registrar),
            "supervisor" => Some(UserRole::Supervisor),
            "reviewer" => Some(UserRole::Reviewer),
            "director" => Some(UserRole::Director),
            "assistant" => Some(UserRole::Assistant),
            "lawyer" => Some(UserRole::Lawyer),
            _ => None,
        }
    }

    pub fn description(&self) -> &'static str {
        match self {
            UserRole::Registrar => "法律咨询登记员（发起/补正）",
            UserRole::Supervisor => "法律咨询审核主管（办理）",
            UserRole::Reviewer => "法务服务中心复核负责人（复核归档）",
            UserRole::Director => "律所主任",
            UserRole::Assistant => "案件助理",
            UserRole::Lawyer => "承办律师",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            UserRole::Registrar => "法律咨询登记员",
            UserRole::Supervisor => "法律咨询审核主管",
            UserRole::Reviewer => "法务服务中心复核负责人",
            UserRole::Director => "律所主任",
            UserRole::Assistant => "案件助理",
            UserRole::Lawyer => "承办律师",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum CaseStatus {
    #[serde(rename = "draft")]
    Draft,
    #[serde(rename = "pending_submit")]
    PendingSubmit,
    #[serde(rename = "submitted")]
    Submitted,
    #[serde(rename = "returned")]
    Returned,
    #[serde(rename = "resubmitted")]
    Resubmitted,
    #[serde(rename = "reviewing")]
    Reviewing,
    #[serde(rename = "assigned")]
    Assigned,
    #[serde(rename = "followup")]
    Followup,
    #[serde(rename = "completed")]
    Completed,
    #[serde(rename = "archived")]
    Archived,
}

impl CaseStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            CaseStatus::Draft => "draft",
            CaseStatus::PendingSubmit => "pending_submit",
            CaseStatus::Submitted => "submitted",
            CaseStatus::Returned => "returned",
            CaseStatus::Resubmitted => "resubmitted",
            CaseStatus::Reviewing => "reviewing",
            CaseStatus::Assigned => "assigned",
            CaseStatus::Followup => "followup",
            CaseStatus::Completed => "completed",
            CaseStatus::Archived => "archived",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "draft" => Some(CaseStatus::Draft),
            "pending_submit" => Some(CaseStatus::PendingSubmit),
            "submitted" => Some(CaseStatus::Submitted),
            "returned" => Some(CaseStatus::Returned),
            "resubmitted" => Some(CaseStatus::Resubmitted),
            "reviewing" => Some(CaseStatus::Reviewing),
            "assigned" => Some(CaseStatus::Assigned),
            "followup" => Some(CaseStatus::Followup),
            "completed" => Some(CaseStatus::Completed),
            "archived" => Some(CaseStatus::Archived),
            _ => None,
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            CaseStatus::Draft => "草稿",
            CaseStatus::PendingSubmit => "待提交",
            CaseStatus::Submitted => "已提交",
            CaseStatus::Returned => "已退回",
            CaseStatus::Resubmitted => "已补正",
            CaseStatus::Reviewing => "审核中",
            CaseStatus::Assigned => "已分派",
            CaseStatus::Followup => "回访中",
            CaseStatus::Completed => "已完成",
            CaseStatus::Archived => "已归档",
        }
    }

    pub fn can_transition_to(&self, next: &CaseStatus) -> bool {
        match (self, next) {
            (CaseStatus::Draft, CaseStatus::PendingSubmit) => true,
            (CaseStatus::PendingSubmit, CaseStatus::Submitted) => true,
            (CaseStatus::Submitted, CaseStatus::Reviewing) => true,
            (CaseStatus::Submitted, CaseStatus::Returned) => true,
            (CaseStatus::Returned, CaseStatus::Resubmitted) => true,
            (CaseStatus::Resubmitted, CaseStatus::Reviewing) => true,
            (CaseStatus::Reviewing, CaseStatus::Assigned) => true,
            (CaseStatus::Reviewing, CaseStatus::Returned) => true,
            (CaseStatus::Assigned, CaseStatus::Followup) => true,
            (CaseStatus::Followup, CaseStatus::Completed) => true,
            (CaseStatus::Completed, CaseStatus::Archived) => true,
            _ => false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum CaseQueue {
    #[serde(rename = "registration")]
    Registration,
    #[serde(rename = "review")]
    Review,
    #[serde(rename = "assignment")]
    Assignment,
    #[serde(rename = "followup")]
    Followup,
    #[serde(rename = "archive")]
    Archive,
}

impl CaseQueue {
    pub fn as_str(&self) -> &'static str {
        match self {
            CaseQueue::Registration => "registration",
            CaseQueue::Review => "review",
            CaseQueue::Assignment => "assignment",
            CaseQueue::Followup => "followup",
            CaseQueue::Archive => "archive",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "registration" => Some(CaseQueue::Registration),
            "review" => Some(CaseQueue::Review),
            "assignment" => Some(CaseQueue::Assignment),
            "followup" => Some(CaseQueue::Followup),
            "archive" => Some(CaseQueue::Archive),
            _ => None,
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            CaseQueue::Registration => "登记队列",
            CaseQueue::Review => "审核队列",
            CaseQueue::Assignment => "分派队列",
            CaseQueue::Followup => "回访队列",
            CaseQueue::Archive => "归档队列",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum CasePriority {
    #[serde(rename = "low")]
    Low,
    #[serde(rename = "normal")]
    Normal,
    #[serde(rename = "high")]
    High,
    #[serde(rename = "urgent")]
    Urgent,
}

impl CasePriority {
    pub fn as_str(&self) -> &'static str {
        match self {
            CasePriority::Low => "low",
            CasePriority::Normal => "normal",
            CasePriority::High => "high",
            CasePriority::Urgent => "urgent",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "low" => Some(CasePriority::Low),
            "normal" => Some(CasePriority::Normal),
            "high" => Some(CasePriority::High),
            "urgent" => Some(CasePriority::Urgent),
            _ => None,
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            CasePriority::Low => "低",
            CasePriority::Normal => "普通",
            CasePriority::High => "高",
            CasePriority::Urgent => "紧急",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum WarningStatus {
    #[serde(rename = "normal")]
    Normal,
    #[serde(rename = "approaching")]
    Approaching,
    #[serde(rename = "overdue")]
    Overdue,
}

impl WarningStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            WarningStatus::Normal => "normal",
            WarningStatus::Approaching => "approaching",
            WarningStatus::Overdue => "overdue",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            WarningStatus::Normal => "正常",
            WarningStatus::Approaching => "即将到期",
            WarningStatus::Overdue => "已逾期",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub password_hash: String,
    pub real_name: String,
    pub role: UserRole,
    pub department: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl FromRow for User {
    fn from_row(row: &Row) -> rusqlite::Result<Self> {
        let role_str: String = row.get(4)?;
        let role = UserRole::from_str(&role_str).unwrap_or(UserRole::Registrar);
        
        Ok(Self {
            id: row.get(0)?,
            username: row.get(1)?,
            password_hash: row.get(2)?,
            real_name: row.get(3)?,
            role,
            department: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
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
    pub user: UserInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: i64,
    pub username: String,
    pub real_name: String,
    pub role: UserRole,
    pub department: Option<String>,
}

impl From<User> for UserInfo {
    fn from(user: User) -> Self {
        UserInfo {
            id: user.id,
            username: user.username,
            real_name: user.real_name,
            role: user.role,
            department: user.department,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub user_id: i64,
    pub username: String,
    pub role: String,
    pub exp: usize,
    pub iat: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T, message: &str) -> Self {
        ApiResponse {
            success: true,
            message: message.to_string(),
            data: Some(data),
        }
    }

    pub fn success_no_data(message: &str) -> Self {
        ApiResponse {
            success: true,
            message: message.to_string(),
            data: None,
        }
    }

    pub fn error(message: &str) -> Self {
        ApiResponse {
            success: false,
            message: message.to_string(),
            data: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegalCase {
    pub id: i64,
    pub case_no: String,
    pub title: String,
    pub priority: CasePriority,
    pub status: CaseStatus,
    pub queue: CaseQueue,
    pub current_handler_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_handler_name: Option<String>,
    pub deadline: Option<DateTime<Utc>>,
    pub version: i32,
    pub created_by: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warning_status: Option<WarningStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseRegistration {
    pub id: i64,
    pub case_id: i64,
    pub client_name: Option<String>,
    pub client_phone: Option<String>,
    pub client_id_card: Option<String>,
    pub consultation_type: Option<String>,
    pub consultation_content: Option<String>,
    pub evidence_provided: Option<String>,
    pub registration_remark: Option<String>,
    pub registered_by: Option<i64>,
    pub registered_at: Option<DateTime<Utc>>,
    pub is_complete: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseAssignment {
    pub id: i64,
    pub case_id: i64,
    pub assistant_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assistant_name: Option<String>,
    pub lawyer_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lawyer_name: Option<String>,
    pub assignment_reason: Option<String>,
    pub assignment_remark: Option<String>,
    pub assigned_by: Option<i64>,
    pub assigned_at: Option<DateTime<Utc>>,
    pub is_complete: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseFollowup {
    pub id: i64,
    pub case_id: i64,
    pub followup_result: Option<String>,
    pub client_satisfaction: Option<String>,
    pub followup_remark: Option<String>,
    pub followup_by: Option<i64>,
    pub followup_at: Option<DateTime<Utc>>,
    pub is_complete: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: i64,
    pub case_id: i64,
    pub module: String,
    pub file_name: String,
    pub file_path: String,
    pub file_type: Option<String>,
    pub file_size: Option<i64>,
    pub uploaded_by: Option<i64>,
    pub created_at: DateTime<Utc>,
}

impl FromRow for Attachment {
    fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get(0)?,
            case_id: row.get(1)?,
            module: row.get(2)?,
            file_name: row.get(3)?,
            file_path: row.get(4)?,
            file_type: row.get(5)?,
            file_size: row.get(6)?,
            uploaded_by: row.get(7)?,
            created_at: row.get(8)?,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingRecord {
    pub id: i64,
    pub case_id: i64,
    pub action: String,
    pub from_status: Option<String>,
    pub to_status: Option<String>,
    pub operator_id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operator_name: Option<String>,
    pub remark: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl FromRow for ProcessingRecord {
    fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get(0)?,
            case_id: row.get(1)?,
            action: row.get(2)?,
            from_status: row.get(3)?,
            to_status: row.get(4)?,
            operator_id: row.get(5)?,
            operator_name: None,
            remark: row.get(6)?,
            created_at: row.get(7)?,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditNote {
    pub id: i64,
    pub case_id: i64,
    pub module: Option<String>,
    pub audit_type: String,
    pub content: String,
    pub operator_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operator_name: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl FromRow for AuditNote {
    fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get(0)?,
            case_id: row.get(1)?,
            module: row.get(2)?,
            audit_type: row.get(3)?,
            content: row.get(4)?,
            operator_id: row.get(5)?,
            operator_name: None,
            created_at: row.get(6)?,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExceptionReason {
    pub id: i64,
    pub case_id: i64,
    pub exception_type: String,
    pub reason: String,
    pub module: Option<String>,
    pub operator_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operator_name: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl FromRow for ExceptionReason {
    fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get(0)?,
            case_id: row.get(1)?,
            exception_type: row.get(2)?,
            reason: row.get(3)?,
            module: row.get(4)?,
            operator_id: row.get(5)?,
            operator_name: None,
            created_at: row.get(6)?,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseDetail {
    pub id: i64,
    pub case_no: String,
    pub title: String,
    pub priority: CasePriority,
    pub status: CaseStatus,
    pub queue: CaseQueue,
    pub current_handler_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_handler_name: Option<String>,
    pub deadline: Option<DateTime<Utc>>,
    pub version: i32,
    pub created_by: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warning_status: Option<WarningStatus>,
    pub registration: Option<CaseRegistration>,
    pub assignment: Option<CaseAssignment>,
    pub followup: Option<CaseFollowup>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CaseListRequest {
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub handler_id: Option<i64>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub deadline_from: Option<String>,
    pub deadline_to: Option<String>,
    pub keyword: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CaseListResponse {
    pub list: Vec<LegalCase>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateCaseRequest {
    pub title: String,
    pub priority: String,
    pub deadline: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateCaseRequest {
    pub case_id: Option<i64>,
    pub title: Option<String>,
    pub priority: Option<String>,
    pub deadline: Option<DateTime<Utc>>,
    pub version: Option<i32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CaseActionRequest {
    pub case_id: Option<i64>,
    pub action: String,
    pub remark: Option<String>,
    pub version: Option<i32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RegistrationUpdateRequest {
    pub case_id: Option<i64>,
    pub client_name: Option<String>,
    pub client_phone: Option<String>,
    pub client_id_card: Option<String>,
    pub consultation_type: Option<String>,
    pub consultation_content: Option<String>,
    pub evidence_provided: Option<String>,
    pub registration_remark: Option<String>,
    pub version: Option<i32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AssignmentUpdateRequest {
    pub case_id: Option<i64>,
    pub assistant_id: Option<i64>,
    pub lawyer_id: Option<i64>,
    pub assignment_reason: Option<String>,
    pub assignment_remark: Option<String>,
    pub version: Option<i32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FollowupUpdateRequest {
    pub case_id: Option<i64>,
    pub followup_result: Option<String>,
    pub client_satisfaction: Option<String>,
    pub followup_remark: Option<String>,
    pub version: Option<i32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BatchResult {
    pub case_id: i64,
    pub case_no: String,
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BatchProcessRequest {
    pub case_ids: Vec<i64>,
    pub action: String,
    pub remark: Option<String>,
    pub versions: HashMap<i64, i32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StatisticsData {
    pub total: i64,
    pub draft: i64,
    pub pending_submit: i64,
    pub submitted: i64,
    pub returned: i64,
    pub reviewing: i64,
    pub completed: i64,
    pub normal: i64,
    pub approaching: i64,
    pub overdue: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewUser {
    pub username: String,
    pub password_hash: String,
    pub real_name: String,
    pub role: String,
    pub department: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewLegalCase {
    pub case_no: String,
    pub title: String,
    pub priority: String,
    pub status: String,
    pub queue: String,
    pub current_handler_id: Option<i64>,
    pub deadline: Option<DateTime<Utc>>,
    pub created_by: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewCaseRegistration {
    pub case_id: i64,
    pub client_name: Option<String>,
    pub client_phone: Option<String>,
    pub client_id_card: Option<String>,
    pub consultation_type: Option<String>,
    pub consultation_content: Option<String>,
    pub evidence_provided: Option<String>,
    pub registration_remark: Option<String>,
    pub registered_by: Option<i64>,
    pub registered_at: Option<DateTime<Utc>>,
    pub is_complete: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewCaseAssignment {
    pub case_id: i64,
    pub assistant_id: Option<i64>,
    pub lawyer_id: Option<i64>,
    pub assignment_reason: Option<String>,
    pub assignment_remark: Option<String>,
    pub assigned_by: Option<i64>,
    pub assigned_at: Option<DateTime<Utc>>,
    pub is_complete: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewCaseFollowup {
    pub case_id: i64,
    pub followup_result: Option<String>,
    pub client_satisfaction: Option<String>,
    pub followup_remark: Option<String>,
    pub followup_by: Option<i64>,
    pub followup_at: Option<DateTime<Utc>>,
    pub is_complete: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewAttachment {
    pub case_id: i64,
    pub module: String,
    pub file_name: String,
    pub file_path: String,
    pub file_type: Option<String>,
    pub file_size: Option<i64>,
    pub uploaded_by: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewProcessingRecord {
    pub case_id: i64,
    pub action: String,
    pub from_status: Option<String>,
    pub to_status: Option<String>,
    pub operator_id: i64,
    pub remark: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewAuditNote {
    pub case_id: i64,
    pub module: Option<String>,
    pub audit_type: String,
    pub content: String,
    pub operator_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewExceptionReason {
    pub case_id: i64,
    pub exception_type: String,
    pub reason: String,
    pub module: Option<String>,
    pub operator_id: Option<i64>,
}

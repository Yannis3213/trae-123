use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc, NaiveDate};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    RegistrationClerk,
    CirculationLibrarian,
    CatalogingLibrarian,
    AuditSupervisor,
    LibraryDirector,
}

impl Role {
    pub fn as_str(&self) -> &'static str {
        match self {
            Role::RegistrationClerk => "借阅登记员",
            Role::CirculationLibrarian => "流通馆员",
            Role::CatalogingLibrarian => "采编馆员",
            Role::AuditSupervisor => "借阅审核主管",
            Role::LibraryDirector => "馆长",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "借阅登记员" | "registration_clerk" => Some(Role::RegistrationClerk),
            "流通馆员" | "circulation_librarian" => Some(Role::CirculationLibrarian),
            "采编馆员" | "cataloging_librarian" => Some(Role::CatalogingLibrarian),
            "借阅审核主管" | "audit_supervisor" => Some(Role::AuditSupervisor),
            "馆长" | "library_director" => Some(Role::LibraryDirector),
            _ => None,
        }
    }

    pub fn all() -> Vec<Role> {
        vec![
            Role::RegistrationClerk,
            Role::CirculationLibrarian,
            Role::CatalogingLibrarian,
            Role::AuditSupervisor,
            Role::LibraryDirector,
        ]
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum BorrowStatus {
    PendingAssignment,
    Transferred,
    Revisited,
    ReturnedForCorrection,
    ReviewedArchived,
    Overdue,
}

impl BorrowStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            BorrowStatus::PendingAssignment => "待分派",
            BorrowStatus::Transferred => "已转办",
            BorrowStatus::Revisited => "已回访",
            BorrowStatus::ReturnedForCorrection => "退回补正",
            BorrowStatus::ReviewedArchived => "复核归档",
            BorrowStatus::Overdue => "已逾期",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "待分派" | "pending_assignment" => Some(BorrowStatus::PendingAssignment),
            "已转办" | "transferred" => Some(BorrowStatus::Transferred),
            "已回访" | "revisited" => Some(BorrowStatus::Revisited),
            "退回补正" | "returned_for_correction" => Some(BorrowStatus::ReturnedForCorrection),
            "复核归档" | "reviewed_archived" => Some(BorrowStatus::ReviewedArchived),
            "已逾期" | "overdue" => Some(BorrowStatus::Overdue),
            _ => None,
        }
    }

    pub fn all() -> Vec<BorrowStatus> {
        vec![
            BorrowStatus::PendingAssignment,
            BorrowStatus::Transferred,
            BorrowStatus::Revisited,
            BorrowStatus::ReturnedForCorrection,
            BorrowStatus::ReviewedArchived,
            BorrowStatus::Overdue,
        ]
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OverdueLevel {
    Normal,
    Approaching,
    Overdue,
}

impl OverdueLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            OverdueLevel::Normal => "正常",
            OverdueLevel::Approaching => "临期",
            OverdueLevel::Overdue => "逾期",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reader {
    pub id: Uuid,
    pub name: String,
    pub card_number: String,
    pub department: String,
    pub phone: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BorrowRecord {
    pub id: Uuid,
    pub reader_id: Uuid,
    pub reader_name: String,
    pub reader_card_number: String,
    pub book_title: String,
    pub book_isbn: String,
    pub borrow_date: NaiveDate,
    pub due_date: NaiveDate,
    pub return_date: Option<NaiveDate>,
    pub status: BorrowStatus,
    pub current_handler: Option<String>,
    pub current_handler_role: Option<Role>,
    pub version: i64,
    pub created_by: String,
    pub created_by_role: Role,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub overdue_level: OverdueLevel,
    pub node_timeout: bool,
    pub timeout_responsible: Option<String>,
    pub missing_materials: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: Uuid,
    pub borrow_record_id: Uuid,
    pub file_name: String,
    pub file_type: String,
    pub uploaded_by: String,
    pub uploaded_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessRecord {
    pub id: Uuid,
    pub borrow_record_id: Uuid,
    pub from_status: BorrowStatus,
    pub to_status: BorrowStatus,
    pub action: String,
    pub operator: String,
    pub operator_role: Role,
    pub remark: Option<String>,
    pub evidence_required: Vec<String>,
    pub evidence_provided: Vec<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditNote {
    pub id: Uuid,
    pub borrow_record_id: Uuid,
    pub status_snapshot: BorrowStatus,
    pub note: String,
    pub operator: String,
    pub operator_role: Role,
    pub exception_type: Option<String>,
    pub exception_detail: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateBorrowRecordRequest {
    pub reader_id: Uuid,
    pub book_title: String,
    pub book_isbn: String,
    pub borrow_date: NaiveDate,
    pub due_date: NaiveDate,
    pub operator: String,
    pub operator_role: Role,
    pub initial_materials: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessBorrowRecordRequest {
    pub action: String,
    pub target_status: BorrowStatus,
    pub operator: String,
    pub operator_role: Role,
    pub remark: Option<String>,
    pub evidence: Vec<String>,
    pub version: i64,
    pub assign_to: Option<String>,
    pub assign_to_role: Option<Role>,
    pub correction_items: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchProcessRequest {
    pub record_ids: Vec<Uuid>,
    pub action: String,
    pub target_status: BorrowStatus,
    pub operator: String,
    pub operator_role: Role,
    pub remark: Option<String>,
    pub evidence: Vec<String>,
    pub versions: std::collections::HashMap<Uuid, i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchProcessResultItem {
    pub record_id: Uuid,
    pub success: bool,
    pub message: String,
    pub from_status: Option<BorrowStatus>,
    pub to_status: Option<BorrowStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchProcessResponse {
    pub total: usize,
    pub success_count: usize,
    pub failure_count: usize,
    pub results: Vec<BatchProcessResultItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Statistics {
    pub total_count: i64,
    pub pending_assignment: i64,
    pub transferred: i64,
    pub revisited: i64,
    pub returned_for_correction: i64,
    pub reviewed_archived: i64,
    pub overdue: i64,
    pub normal: i64,
    pub approaching: i64,
    pub overdue_count: i64,
    pub node_timeout_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListQueryParams {
    pub role: Option<Role>,
    pub handler: Option<String>,
    pub status: Option<BorrowStatus>,
    pub overdue_level: Option<OverdueLevel>,
    pub reader_keyword: Option<String>,
    pub page: Option<usize>,
    pub page_size: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        ApiResponse {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn err(msg: &str) -> Self {
        ApiResponse {
            success: false,
            data: None,
            error: Some(msg.to_string()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleInfo {
    pub role: Role,
    pub name: String,
    pub description: String,
}

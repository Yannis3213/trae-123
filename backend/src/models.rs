use chrono::{DateTime, Utc};
use poem_openapi::Object;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum Role {
    Registrar,
    Supervisor,
    Reviewer,
    Agent,
    QaSupervisor,
    CsManager,
}

impl Role {
    pub fn as_str(&self) -> &'static str {
        match self {
            Role::Registrar => "registrar",
            Role::Supervisor => "supervisor",
            Role::Reviewer => "reviewer",
            Role::Agent => "agent",
            Role::QaSupervisor => "qa_supervisor",
            Role::CsManager => "cs_manager",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "registrar" => Some(Role::Registrar),
            "supervisor" => Some(Role::Supervisor),
            "reviewer" => Some(Role::Reviewer),
            "agent" => Some(Role::Agent),
            "qa_supervisor" => Some(Role::QaSupervisor),
            "cs_manager" => Some(Role::CsManager),
            _ => None,
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Role::Registrar => "客服登记员",
            Role::Supervisor => "客服审核主管",
            Role::Reviewer => "客服呼叫中心复核负责人",
            Role::Agent => "客服坐席",
            Role::QaSupervisor => "质检主管",
            Role::CsManager => "客服经理",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum TicketStatus {
    PendingReceipt,
    ExceptionReturned,
    ReceiptCompleted,
    CallRegistered,
    Dispatched,
    CallbackClosed,
    Archived,
}

impl TicketStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            TicketStatus::PendingReceipt => "pending_receipt",
            TicketStatus::ExceptionReturned => "exception_returned",
            TicketStatus::ReceiptCompleted => "receipt_completed",
            TicketStatus::CallRegistered => "call_registered",
            TicketStatus::Dispatched => "dispatched",
            TicketStatus::CallbackClosed => "callback_closed",
            TicketStatus::Archived => "archived",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "pending_receipt" => Some(TicketStatus::PendingReceipt),
            "exception_returned" => Some(TicketStatus::ExceptionReturned),
            "receipt_completed" => Some(TicketStatus::ReceiptCompleted),
            "call_registered" => Some(TicketStatus::CallRegistered),
            "dispatched" => Some(TicketStatus::Dispatched),
            "callback_closed" => Some(TicketStatus::CallbackClosed),
            "archived" => Some(TicketStatus::Archived),
            _ => None,
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            TicketStatus::PendingReceipt => "待签收",
            TicketStatus::ExceptionReturned => "异常回传",
            TicketStatus::ReceiptCompleted => "签收完成",
            TicketStatus::CallRegistered => "来电登记",
            TicketStatus::Dispatched => "问题派单",
            TicketStatus::CallbackClosed => "回访关闭",
            TicketStatus::Archived => "已归档",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
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

    pub fn display_name(&self) -> &'static str {
        match self {
            Priority::Low => "低",
            Priority::Medium => "中",
            Priority::High => "高",
            Priority::Urgent => "紧急",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ExpiryStatus {
    Normal,
    NearExpiry,
    Overdue,
}

impl ExpiryStatus {
    pub fn display_name(&self) -> &'static str {
        match self {
            ExpiryStatus::Normal => "正常",
            ExpiryStatus::NearExpiry => "临期",
            ExpiryStatus::Overdue => "逾期",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct User {
    pub id: String,
    pub username: String,
    pub role: String,
    pub role_display: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct Ticket {
    pub id: String,
    pub title: String,
    pub description: String,
    pub customer_name: String,
    pub customer_phone: String,
    pub status: String,
    pub status_display: String,
    pub priority: String,
    pub priority_display: String,
    pub responsible_id: String,
    pub responsible_name: String,
    pub current_handler_id: String,
    pub current_handler_name: String,
    pub next_handler_id: Option<String>,
    pub next_handler_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub deadline: DateTime<Utc>,
    pub version: i64,
    pub exception_tags: Vec<String>,
    pub expiry_status: String,
    pub expiry_display: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct TicketDetail {
    pub ticket: Ticket,
    pub attachments: Vec<Attachment>,
    pub processing_records: Vec<ProcessingRecord>,
    pub audit_remarks: Vec<AuditRemark>,
    pub exception_reasons: Vec<ExceptionReason>,
    pub processing_result: Option<String>,
    pub return_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct Attachment {
    pub id: String,
    pub ticket_id: String,
    pub filename: String,
    pub file_type: String,
    pub uploaded_by: String,
    pub uploaded_by_name: String,
    pub uploaded_at: DateTime<Utc>,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct ProcessingRecord {
    pub id: String,
    pub ticket_id: String,
    pub action: String,
    pub from_status: String,
    pub to_status: String,
    pub from_handler_id: String,
    pub from_handler_name: String,
    pub to_handler_id: String,
    pub to_handler_name: String,
    pub operator_id: String,
    pub operator_name: String,
    pub operator_role: String,
    pub remark: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct AuditRemark {
    pub id: String,
    pub ticket_id: String,
    pub content: String,
    pub operator_id: String,
    pub operator_name: String,
    pub operator_role: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct ExceptionReason {
    pub id: String,
    pub ticket_id: String,
    pub reason_type: String,
    pub description: String,
    pub reported_by: String,
    pub reported_by_name: String,
    pub created_at: DateTime<Utc>,
    pub resolved: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct CreateTicketRequest {
    pub title: String,
    pub description: String,
    pub customer_name: String,
    pub customer_phone: String,
    pub priority: String,
    pub responsible_id: String,
    pub deadline_days: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct ProcessTicketRequest {
    pub action: String,
    pub target_status: String,
    pub remark: Option<String>,
    pub processing_result: Option<String>,
    pub return_reason: Option<String>,
    pub version: i64,
    pub evidence_required: Option<bool>,
    pub evidence: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct BatchProcessRequest {
    pub ticket_ids: Vec<String>,
    pub action: String,
    pub target_status: String,
    pub remark: Option<String>,
    pub return_reason: Option<String>,
    pub version_map: Option<std::collections::HashMap<String, i64>>,
    pub evidence: Option<std::collections::HashMap<String, Vec<String>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct BatchProcessResultItem {
    pub ticket_id: String,
    pub success: bool,
    pub message: String,
    pub failed_reason: Option<String>,
    pub new_status: Option<String>,
    pub new_status_key: Option<String>,
    pub new_handler_id: Option<String>,
    pub new_handler_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct BatchProcessResponse {
    pub total: i64,
    pub success_count: i64,
    pub failed_count: i64,
    pub results: Vec<BatchProcessResultItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct TicketListResponse {
    pub items: Vec<Ticket>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct TicketStatistics {
    pub total: i64,
    pub pending: i64,
    pub processing: i64,
    pub completed: i64,
    pub overdue: i64,
    pub exception: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct LoginResponse {
    pub user: User,
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct AddAttachmentRequest {
    pub filename: String,
    pub file_type: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct AddAuditRemarkRequest {
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct AddExceptionReasonRequest {
    pub reason_type: String,
    pub description: String,
}

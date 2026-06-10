use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum UserRole {
    Registrar,
    Auditor,
    Reviewer,
}

impl UserRole {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "registrar" => Some(UserRole::Registrar),
            "auditor" => Some(UserRole::Auditor),
            "reviewer" => Some(UserRole::Reviewer),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            UserRole::Registrar => "registrar",
            UserRole::Auditor => "auditor",
            UserRole::Reviewer => "reviewer",
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            UserRole::Registrar => "旅游登记员",
            UserRole::Auditor => "旅游审核主管",
            UserRole::Reviewer => "旅行社复核负责人",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub role: UserRole,
    pub display_name: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum OrderStatus {
    Draft,
    PendingAudit,
    PendingCorrection,
    PendingReview,
    Archived,
    Rejected,
}

impl OrderStatus {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "draft" => Some(OrderStatus::Draft),
            "pending_audit" => Some(OrderStatus::PendingAudit),
            "pending_correction" => Some(OrderStatus::PendingCorrection),
            "pending_review" => Some(OrderStatus::PendingReview),
            "archived" => Some(OrderStatus::Archived),
            "rejected" => Some(OrderStatus::Rejected),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            OrderStatus::Draft => "draft",
            OrderStatus::PendingAudit => "pending_audit",
            OrderStatus::PendingCorrection => "pending_correction",
            OrderStatus::PendingReview => "pending_review",
            OrderStatus::Archived => "archived",
            OrderStatus::Rejected => "rejected",
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            OrderStatus::Draft => "草稿",
            OrderStatus::PendingAudit => "待审核",
            OrderStatus::PendingCorrection => "待补正",
            OrderStatus::PendingReview => "待复核",
            OrderStatus::Archived => "已归档",
            OrderStatus::Rejected => "已拒绝",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TourOrder {
    pub id: Uuid,
    pub order_no: String,
    pub route_name: String,
    pub customer_name: String,
    pub customer_phone: String,
    pub traveler_count: i32,
    pub departure_date: DateTime<Utc>,
    pub return_date: DateTime<Utc>,
    pub quoted_price: f64,
    pub status: OrderStatus,
    pub current_handler_id: Option<Uuid>,
    pub current_handler_name: Option<String>,
    pub version: i32,
    pub is_overdue: bool,
    pub deadline: Option<DateTime<Utc>>,
    pub exception_reason: Option<String>,
    pub correction_note: Option<String>,
    pub route_quote_evidence: bool,
    pub registration_confirm_evidence: bool,
    pub tour_audit_evidence: bool,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateOrderRequest {
    pub order_no: Option<String>,
    pub route_name: String,
    pub customer_name: String,
    pub customer_phone: String,
    pub traveler_count: i32,
    pub departure_date: String,
    pub return_date: String,
    pub quoted_price: f64,
    pub deadline: Option<String>,
    pub as_draft: Option<bool>,
    pub route_quote_evidence: Option<bool>,
    pub registration_confirm_evidence: Option<bool>,
    pub tour_audit_evidence: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateOrderRequest {
    pub route_name: Option<String>,
    pub customer_name: Option<String>,
    pub customer_phone: Option<String>,
    pub traveler_count: Option<i32>,
    pub departure_date: Option<String>,
    pub return_date: Option<String>,
    pub quoted_price: Option<f64>,
    pub deadline: Option<String>,
    pub route_quote_evidence: Option<bool>,
    pub registration_confirm_evidence: Option<bool>,
    pub tour_audit_evidence: Option<bool>,
    pub version: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeStatusRequest {
    pub target_status: String,
    pub version: i32,
    pub note: Option<String>,
    pub exception_reason: Option<String>,
    pub route_quote_evidence: Option<bool>,
    pub registration_confirm_evidence: Option<bool>,
    pub tour_audit_evidence: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchProcessRequest {
    pub order_ids: Vec<String>,
    pub target_status: String,
    pub note: Option<String>,
    pub version_map: Option<std::collections::HashMap<String, i32>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchProcessResult {
    pub order_id: String,
    pub order_no: String,
    pub success: bool,
    pub code: String,
    pub message: String,
    pub old_status: Option<String>,
    pub new_status: Option<String>,
    pub old_version: Option<i32>,
    pub new_version: Option<i32>,
    pub old_handler_name: Option<String>,
    pub new_handler_name: Option<String>,
    pub trace_saved: Option<bool>,
}

impl Default for BatchProcessResult {
    fn default() -> Self {
        Self {
            order_id: String::new(),
            order_no: String::new(),
            success: false,
            code: String::new(),
            message: String::new(),
            old_status: None,
            new_status: None,
            old_version: None,
            new_version: None,
            old_handler_name: None,
            new_handler_name: None,
            trace_saved: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: Uuid,
    pub order_id: Uuid,
    pub file_name: String,
    pub file_type: String,
    pub file_size: i64,
    pub evidence_type: String,
    pub uploaded_by: Uuid,
    pub uploaded_by_name: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadAttachmentRequest {
    pub file_name: String,
    pub file_type: String,
    pub file_size: i64,
    pub evidence_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingRecord {
    pub id: Uuid,
    pub order_id: Uuid,
    pub from_status: Option<String>,
    pub to_status: String,
    pub action: String,
    pub handler_id: Uuid,
    pub handler_name: String,
    pub handler_role: String,
    pub note: Option<String>,
    pub exception_reason: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddRecordRequest {
    pub action: String,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditNote {
    pub id: Uuid,
    pub order_id: Uuid,
    pub content: String,
    pub created_by: Uuid,
    pub created_by_name: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddAuditNoteRequest {
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: User,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub role: String,
    pub exp: usize,
    pub username: String,
    pub display_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderListQuery {
    pub status: Option<String>,
    pub overdue: Option<String>,
    pub search: Option<String>,
    pub page: Option<i32>,
    pub page_size: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardStats {
    pub total_mine: i64,
    pub to_audit: i64,
    pub to_review: i64,
    pub correction: i64,
    pub archived: i64,
    pub overdue: i64,
    pub normal_queue: Vec<TourOrder>,
    pub overdue_queue: Vec<TourOrder>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum EvidenceType {
    RouteQuote,
    RegistrationConfirm,
    TourAudit,
}

impl EvidenceType {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "route_quote" => Some(EvidenceType::RouteQuote),
            "registration_confirm" => Some(EvidenceType::RegistrationConfirm),
            "tour_audit" => Some(EvidenceType::TourAudit),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            EvidenceType::RouteQuote => "route_quote",
            EvidenceType::RegistrationConfirm => "registration_confirm",
            EvidenceType::TourAudit => "tour_audit",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            EvidenceType::RouteQuote => "线路报价单",
            EvidenceType::RegistrationConfirm => "报名确认表",
            EvidenceType::TourAudit => "出团审核表",
        }
    }

    pub fn field_name(self) -> &'static str {
        match self {
            EvidenceType::RouteQuote => "route_quote_evidence",
            EvidenceType::RegistrationConfirm => "registration_confirm_evidence",
            EvidenceType::TourAudit => "tour_audit_evidence",
        }
    }
}

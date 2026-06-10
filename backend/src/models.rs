use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
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

    pub fn as_str(&self) -> &str {
        match self {
            UserRole::Registrar => "registrar",
            UserRole::Auditor => "auditor",
            UserRole::Reviewer => "reviewer",
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
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

    pub fn as_str(&self) -> &str {
        match self {
            OrderStatus::Draft => "draft",
            OrderStatus::PendingAudit => "pending_audit",
            OrderStatus::PendingCorrection => "pending_correction",
            OrderStatus::PendingReview => "pending_review",
            OrderStatus::Archived => "archived",
            OrderStatus::Rejected => "rejected",
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
    pub current_handler: Option<Uuid>,
    pub version: i32,
    pub is_overdue: bool,
    pub deadline: Option<DateTime<Utc>>,
    pub exception_reason: Option<String>,
    pub correction_note: Option<String>,
    pub route_quote_evidence: Option<bool>,
    pub registration_confirm_evidence: Option<bool>,
    pub tour_audit_evidence: Option<bool>,
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
    pub departure_date: DateTime<Utc>,
    pub return_date: DateTime<Utc>,
    pub quoted_price: f64,
    pub deadline: Option<DateTime<Utc>>,
    pub as_draft: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateOrderRequest {
    pub route_name: Option<String>,
    pub customer_name: Option<String>,
    pub customer_phone: Option<String>,
    pub traveler_count: Option<i32>,
    pub departure_date: Option<DateTime<Utc>>,
    pub return_date: Option<DateTime<Utc>>,
    pub quoted_price: Option<f64>,
    pub deadline: Option<DateTime<Utc>>,
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
    pub order_ids: Vec<Uuid>,
    pub target_status: String,
    pub note: Option<String>,
    pub version_map: Option<std::collections::HashMap<String, i32>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchProcessResult {
    pub order_id: Uuid,
    pub success: bool,
    pub message: String,
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
    pub created_at: DateTime<Utc>,
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
    pub role: Option<String>,
    pub overdue: Option<bool>,
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
    pub draft_count: i64,
    pub pending_audit_count: i64,
    pub pending_correction_count: i64,
    pub pending_review_count: i64,
    pub archived_count: i64,
    pub overdue_count: i64,
    pub warning_count: i64,
    pub normal_count: i64,
}

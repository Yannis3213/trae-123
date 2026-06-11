use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    WarehouseKeeper,
    WarehouseSupervisor,
    OperationsManager,
}

impl Role {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "warehouse_keeper" => Some(Role::WarehouseKeeper),
            "warehouse_supervisor" => Some(Role::WarehouseSupervisor),
            "operations_manager" => Some(Role::OperationsManager),
            _ => None,
        }
    }
    pub fn to_str(&self) -> &'static str {
        match self {
            Role::WarehouseKeeper => "warehouse_keeper",
            Role::WarehouseSupervisor => "warehouse_supervisor",
            Role::OperationsManager => "operations_manager",
        }
    }
    pub fn display_name(&self) -> &'static str {
        match self {
            Role::WarehouseKeeper => "库管员",
            Role::WarehouseSupervisor => "仓储主管",
            Role::OperationsManager => "运营经理",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub name: String,
    pub role: Role,
    pub password_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum OrderStatus {
    PendingConfirmation,
    Exception,
    Rechecked,
}

impl OrderStatus {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "pending_confirmation" => Some(OrderStatus::PendingConfirmation),
            "exception" => Some(OrderStatus::Exception),
            "rechecked" => Some(OrderStatus::Rechecked),
            _ => None,
        }
    }
    pub fn to_str(&self) -> &'static str {
        match self {
            OrderStatus::PendingConfirmation => "pending_confirmation",
            OrderStatus::Exception => "exception",
            OrderStatus::Rechecked => "rechecked",
        }
    }
    pub fn display_name(&self) -> &'static str {
        match self {
            OrderStatus::PendingConfirmation => "待确认",
            OrderStatus::Exception => "异常",
            OrderStatus::Rechecked => "已复查",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InboundOrder {
    pub id: String,
    pub order_no: String,
    pub supplier_name: String,
    pub material_name: String,
    pub quantity: i64,
    pub status: OrderStatus,
    pub version: i64,
    pub current_handler_role: String,
    pub current_handler_id: Option<String>,
    pub current_handler_name: Option<String>,
    pub deadline: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub appointment_evidence: Option<String>,
    pub appointment_complete: bool,
    pub inspection_evidence: Option<String>,
    pub inspection_complete: bool,
    pub registration_evidence: Option<String>,
    pub registration_complete: bool,
    pub last_opinion: Option<String>,
    pub last_attachment_id: Option<String>,
    pub last_audit_note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: String,
    pub order_id: String,
    pub filename: String,
    pub uploaded_by: String,
    pub uploaded_at: DateTime<Utc>,
    pub uploader_role: String,
    pub module: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingRecord {
    pub id: String,
    pub order_id: String,
    pub handler_id: String,
    pub handler_name: String,
    pub handler_role: String,
    pub action: String,
    pub opinion: String,
    pub from_status: String,
    pub to_status: String,
    pub processed_at: DateTime<Utc>,
    pub attachment_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditNote {
    pub id: String,
    pub order_id: String,
    pub note: String,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    pub creator_role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExceptionReason {
    pub id: String,
    pub order_id: String,
    pub reason: String,
    pub module: String,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub username: String,
    pub name: String,
    pub role: String,
    pub role_display: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessOrderRequest {
    pub order_id: String,
    pub version: i64,
    pub action: String,
    pub opinion: String,
    pub audit_note: Option<String>,
    pub attachment_id: Option<String>,
    pub appointment_evidence: Option<String>,
    pub inspection_evidence: Option<String>,
    pub registration_evidence: Option<String>,
    pub exception_reason: Option<String>,
    pub exception_module: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchProcessRequest {
    pub orders: Vec<ProcessOrderRequest>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchProcessResultItem {
    pub order_id: String,
    pub order_no: String,
    pub success: bool,
    pub message: String,
    pub new_status: Option<String>,
    pub new_status_display: Option<String>,
    pub new_version: Option<i64>,
    pub current_handler_role: Option<String>,
    pub current_handler_name: Option<String>,
    pub last_opinion: Option<String>,
    pub exception_count: Option<i64>,
    pub exception_latest: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub message: String,
    pub data: Option<T>,
}

impl<T> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        ApiResponse { success: true, message: "操作成功".to_string(), data: Some(data) }
    }
    pub fn ok_msg(msg: &str) -> Self {
        ApiResponse { success: true, message: msg.to_string(), data: None }
    }
    pub fn err(msg: &str) -> Self {
        ApiResponse { success: false, message: msg.to_string(), data: None }
    }
}

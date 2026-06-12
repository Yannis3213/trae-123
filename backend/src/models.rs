use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc, NaiveDateTime};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub id: String,
    pub username: String,
    pub real_name: String,
    #[serde(skip_serializing)]
    pub password: String,
    pub roles: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LoginResponse {
    pub token: String,
    pub user: User,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FinanceApplication {
    pub id: String,
    pub application_no: String,
    pub clue_no: Option<String>,
    pub customer_name: String,
    pub finance_amount: f64,
    pub invoice_count: i64,
    pub status: String,
    pub current_handler: Option<String>,
    pub current_handler_name: Option<String>,
    pub current_node: String,
    pub node_deadline: Option<NaiveDateTime>,
    pub warning_level: Option<String>,
    pub version: i64,
    pub created_by: String,
    pub created_by_name: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub invoice_verify_status: String,
    pub loan_confirm_status: String,
    pub remark: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateApplicationRequest {
    pub clue_no: Option<String>,
    pub customer_name: String,
    pub finance_amount: f64,
    pub invoice_count: i64,
    pub remark: Option<String>,
    pub attachment_ids: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessApplicationRequest {
    pub action: String,
    pub comment: Option<String>,
    pub version: i64,
    pub evidence_required: Option<Vec<String>>,
    pub evidence_provided: Option<Vec<String>>,
    pub exception_reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BatchProcessRequest {
    pub ids: Vec<String>,
    pub action: String,
    pub comment: Option<String>,
    pub version_map: Option<std::collections::HashMap<String, i64>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BatchProcessResult {
    pub id: String,
    pub application_no: String,
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Attachment {
    pub id: String,
    pub application_id: String,
    pub file_name: String,
    pub file_type: Option<String>,
    pub file_size: Option<i64>,
    pub evidence_type: String,
    pub uploaded_by: String,
    pub uploaded_by_name: Option<String>,
    pub uploaded_at: NaiveDateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessingRecord {
    pub id: String,
    pub application_id: String,
    pub from_status: Option<String>,
    pub to_status: String,
    pub from_node: Option<String>,
    pub to_node: Option<String>,
    pub action: String,
    pub action_name: Option<String>,
    pub handler: String,
    pub handler_name: Option<String>,
    pub handler_role: String,
    pub handler_role_name: Option<String>,
    pub comment: Option<String>,
    pub version_before: Option<i64>,
    pub version_after: Option<i64>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExceptionReason {
    pub id: String,
    pub application_id: String,
    pub record_id: Option<String>,
    pub exception_type: String,
    pub exception_type_name: Option<String>,
    pub reason: String,
    pub severity: String,
    pub resolved: bool,
    pub resolved_by: Option<String>,
    pub resolved_at: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuditNote {
    pub id: String,
    pub application_id: String,
    pub note: String,
    pub created_by: String,
    pub created_by_name: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApplicationDetail {
    pub application: FinanceApplication,
    pub attachments: Vec<Attachment>,
    pub records: Vec<ProcessingRecord>,
    pub exceptions: Vec<ExceptionReason>,
    pub audit_notes: Vec<AuditNote>,
    pub can_process: bool,
    pub allowed_actions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApplicationListQuery {
    pub status: Option<String>,
    pub clue_no: Option<String>,
    pub customer_name: Option<String>,
    pub node: Option<String>,
    pub handler: Option<String>,
    pub page: Option<u64>,
    pub page_size: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PaginatedResponse<T> {
    pub list: Vec<T>,
    pub total: i64,
    pub page: u64,
    pub page_size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Statistics {
    pub total: i64,
    pub pending_verify: i64,
    pub verify_failed: i64,
    pub verify_completed: i64,
    pub pending_review: i64,
    pub archived: i64,
    pub overdue: i64,
    pub pending_correction: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub message: String,
    pub data: Option<T>,
}

impl<T> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        ApiResponse {
            success: true,
            message: "success".to_string(),
            data: Some(data),
        }
    }

    pub fn err(message: &str) -> Self {
        ApiResponse {
            success: false,
            message: message.to_string(),
            data: None,
        }
    }
}

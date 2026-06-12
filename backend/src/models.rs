use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub password_hash: String,
    pub role: String,
    pub display_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditOrder {
    pub id: String,
    pub order_no: String,
    pub status: String,
    pub expiry_date: String,
    pub creator_id: String,
    pub current_handler_id: Option<String>,
    pub version: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NannyProfile {
    pub id: String,
    pub audit_id: String,
    pub name: String,
    pub id_card: String,
    pub phone: String,
    pub service_type: String,
    pub work_experience: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualificationReview {
    pub id: String,
    pub audit_id: String,
    pub health_cert: String,
    pub health_cert_expiry: String,
    pub training_cert: String,
    pub training_cert_expiry: String,
    pub background_check: String,
    pub background_check_result: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OnDutyConfirmation {
    pub id: String,
    pub audit_id: String,
    pub on_duty_date: String,
    pub service_area: String,
    pub contract_no: String,
    pub confirmation_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLog {
    pub id: String,
    pub audit_id: String,
    pub operator_id: String,
    pub action: String,
    pub from_status: String,
    pub to_status: String,
    pub comment: String,
    pub exception_reason: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginResponse {
    pub token: String,
    pub role: String,
    pub username: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAuditRequest {
    pub nanny_profile: NannyProfileInput,
    pub expiry_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NannyProfileInput {
    pub name: String,
    pub id_card: String,
    pub phone: String,
    pub service_type: String,
    pub work_experience: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessAuditRequest {
    pub action: String,
    pub comment: Option<String>,
    pub exception_reason: Option<String>,
    pub version: i32,
    pub nanny_profile: Option<NannyProfileInput>,
    pub qualification_review: Option<QualificationReviewInput>,
    pub on_duty_confirmation: Option<OnDutyConfirmationInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualificationReviewInput {
    pub health_cert: Option<String>,
    pub health_cert_expiry: Option<String>,
    pub training_cert: Option<String>,
    pub training_cert_expiry: Option<String>,
    pub background_check: Option<String>,
    pub background_check_result: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OnDutyConfirmationInput {
    pub on_duty_date: Option<String>,
    pub service_area: Option<String>,
    pub contract_no: Option<String>,
    pub confirmation_status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchProcessRequest {
    pub action: String,
    pub audit_ids: Vec<String>,
    pub comment: Option<String>,
    pub exception_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchProcessResultItem {
    pub audit_id: String,
    pub order_no: String,
    pub success: bool,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchProcessResponse {
    pub total: i64,
    pub success_count: i64,
    pub fail_count: i64,
    pub results: Vec<BatchProcessResultItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardStats {
    pub pending_count: i64,
    pub processing_count: i64,
    pub reviewing_count: i64,
    pub correction_needed_count: i64,
    pub completed_count: i64,
    pub overdue_count: i64,
    pub expiring_soon_count: i64,
}

use poem_openapi::Object;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize, Object, sqlx::FromRow)]
pub struct Appointment {
    pub id: String,
    pub order_no: String,
    pub customer_name: String,
    pub customer_phone: String,
    pub service_item: String,
    pub beautician: String,
    pub consultant: String,
    pub store_manager: String,
    pub status: String,
    pub current_handler: String,
    pub current_handler_role: String,
    pub appointment_time: String,
    pub deadline: String,
    pub exception_type: Option<String>,
    pub exception_reason: Option<String>,
    pub correction_note: Option<String>,
    pub version: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct CardEvidenceSummary {
    pub has_customer_appointment: bool,
    pub has_project_confirmation: bool,
    pub has_service_followup: bool,
    pub customer_appointment_count: i64,
    pub project_confirmation_count: i64,
    pub service_followup_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct AppointmentListItem {
    pub id: String,
    pub order_no: String,
    pub customer_name: String,
    pub service_item: String,
    pub status: String,
    pub status_label: String,
    pub current_handler: String,
    pub current_handler_role: String,
    pub deadline: String,
    pub deadline_status: String,
    pub exception_type: Option<String>,
    pub exception_type_label: Option<String>,
    pub beautician: String,
    pub consultant: String,
    pub version: i64,
    pub evidence_summary: CardEvidenceSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct AppointmentDetail {
    pub appointment: Appointment,
    pub attachments: Vec<Attachment>,
    pub audit_trails: Vec<AuditTrail>,
    pub processing_records: Vec<ProcessingRecord>,
    pub evidence_summary: EvidenceSummary,
    pub deadline_status: String,
    pub status_label: String,
    pub exception_type_label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object, sqlx::FromRow)]
pub struct Attachment {
    pub id: String,
    pub appointment_id: String,
    pub evidence_type: String,
    pub file_name: String,
    pub file_url: String,
    pub uploaded_by: String,
    pub uploaded_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object, sqlx::FromRow)]
pub struct AuditTrail {
    pub id: String,
    pub appointment_id: String,
    pub action: String,
    pub action_label: String,
    pub from_status: Option<String>,
    pub to_status: Option<String>,
    pub from_version: Option<i64>,
    pub to_version: Option<i64>,
    pub operator: String,
    pub operator_role: String,
    pub operator_role_label: String,
    pub remark: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object, sqlx::FromRow)]
pub struct ProcessingRecord {
    pub id: String,
    pub appointment_id: String,
    pub action: String,
    pub handler: String,
    pub handler_role: String,
    pub detail: Option<String>,
    pub exception_reason: Option<String>,
    pub correction_note: Option<String>,
    pub from_version: Option<i64>,
    pub to_version: Option<i64>,
    pub batch_fail_reason: Option<String>,
    pub audit_remark: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct EvidenceSummary {
    pub customer_appointment: Vec<Attachment>,
    pub project_confirmation: Vec<Attachment>,
    pub service_followup: Vec<Attachment>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DeadlineStatus {
    Normal,
    Approaching,
    Overdue,
}

impl DeadlineStatus {
    pub fn to_string(&self) -> String {
        match self {
            DeadlineStatus::Normal => "normal".to_string(),
            DeadlineStatus::Approaching => "approaching".to_string(),
            DeadlineStatus::Overdue => "overdue".to_string(),
        }
    }
}

pub fn status_label(s: &str) -> String {
    match s {
        "draft" => "草稿".to_string(),
        "pending_review" => "待复核".to_string(),
        "archived" => "已归档".to_string(),
        _ => s.to_string(),
    }
}

pub fn exception_type_label(t: &Option<String>) -> Option<String> {
    match t {
        Some(v) => match v.as_str() {
            "missing_materials" => Some("缺材料".to_string()),
            "overdue" => Some("逾期".to_string()),
            "returned" => Some("退回补正".to_string()),
            _ => Some(v.clone()),
        },
        None => None,
    }
}

pub fn role_label(r: &str) -> String {
    match r {
        "beautician" => "护理师".to_string(),
        "consultant" => "美容顾问".to_string(),
        "store_manager" => "门店店长".to_string(),
        "system" => "系统".to_string(),
        "archived" => "已归档".to_string(),
        _ => r.to_string(),
    }
}

pub fn action_label(a: &str) -> String {
    match a {
        "create" => "创建".to_string(),
        "submit_review" => "提交复核".to_string(),
        "review_pass" => "复核通过".to_string(),
        "review_reject" => "复核拒绝".to_string(),
        "return_to_correct" => "退回补正".to_string(),
        "correction_submit" => "补正提交".to_string(),
        "archive" => "归档".to_string(),
        "mark_overdue" => "标记逾期".to_string(),
        "correction" => "补正处理".to_string(),
        _ => a.to_string(),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct CreateAppointmentRequest {
    pub customer_name: String,
    pub customer_phone: String,
    pub service_item: String,
    pub beautician: String,
    pub consultant: String,
    pub store_manager: String,
    pub appointment_time: String,
    pub deadline_days: i32,
}

impl CreateAppointmentRequest {
    pub fn to_appointment(&self) -> Appointment {
        let now = Utc::now();
        let deadline = now + chrono::Duration::days(self.deadline_days as i64);
        Appointment {
            id: Uuid::new_v4().to_string(),
            order_no: format!(
                "MR{}",
                now.format("%Y%m%d%H%M%S")
            ),
            customer_name: self.customer_name.clone(),
            customer_phone: self.customer_phone.clone(),
            service_item: self.service_item.clone(),
            beautician: self.beautician.clone(),
            consultant: self.consultant.clone(),
            store_manager: self.store_manager.clone(),
            status: "draft".to_string(),
            current_handler: self.beautician.clone(),
            current_handler_role: "beautician".to_string(),
            appointment_time: self.appointment_time.clone(),
            deadline: deadline.format("%Y-%m-%d %H:%M:%S").to_string(),
            exception_type: None,
            exception_reason: None,
            correction_note: None,
            version: 1,
            created_at: now.format("%Y-%m-%d %H:%M:%S").to_string(),
            updated_at: now.format("%Y-%m-%d %H:%M:%S").to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct ProcessAppointmentRequest {
    pub action: String,
    pub remark: Option<String>,
    pub exception_type: Option<String>,
    pub exception_reason: Option<String>,
    pub correction_note: Option<String>,
    pub version: i64,
    pub evidence_required: Vec<String>,
    pub attachments: Vec<AttachmentInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct AttachmentInput {
    pub evidence_type: String,
    pub file_name: String,
    pub file_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct BatchProcessRequest {
    pub appointment_ids: Vec<String>,
    pub action: String,
    pub remark: Option<String>,
    pub version_map: Option<serde_json::Value>,
    pub exception_type: Option<String>,
    pub exception_reason: Option<String>,
    pub correction_note: Option<String>,
    pub attachments: Option<Vec<AttachmentInput>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct BatchResultItem {
    pub appointment_id: String,
    pub order_no: String,
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct BatchProcessResponse {
    pub total: i32,
    pub success_count: i32,
    pub fail_count: i32,
    pub results: Vec<BatchResultItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct UserInfo {
    pub role: String,
    pub role_label: String,
    pub username: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct SwitchRoleRequest {
    pub role: String,
    pub username: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T: Serialize + Send + Sync> {
    pub success: bool,
    pub message: String,
    pub data: Option<T>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct AppointmentsApiResponse {
    pub success: bool,
    pub message: String,
    pub data: Option<AppointmentsResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct AppointmentDetailApiResponse {
    pub success: bool,
    pub message: String,
    pub data: Option<AppointmentDetail>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct AppointmentApiResponse {
    pub success: bool,
    pub message: String,
    pub data: Option<Appointment>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct UserInfoApiResponse {
    pub success: bool,
    pub message: String,
    pub data: Option<UserInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct BatchProcessApiResponse {
    pub success: bool,
    pub message: String,
    pub data: Option<BatchProcessResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct AppointmentsResponse {
    pub normal: Vec<AppointmentListItem>,
    pub approaching: Vec<AppointmentListItem>,
    pub overdue: Vec<AppointmentListItem>,
    pub stats: AppointmentStats,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct AppointmentStats {
    pub total: i32,
    pub normal_count: i32,
    pub approaching_count: i32,
    pub overdue_count: i32,
    pub draft_count: i32,
    pub pending_review_count: i32,
    pub archived_count: i32,
}

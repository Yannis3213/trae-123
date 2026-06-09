use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Role {
    #[serde(rename = "registrar")]
    Registrar,
    #[serde(rename = "supervisor")]
    Supervisor,
    #[serde(rename = "director")]
    Director,
}

impl Role {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "registrar" => Some(Role::Registrar),
            "supervisor" => Some(Role::Supervisor),
            "director" => Some(Role::Director),
            _ => None,
        }
    }

    pub fn to_str(&self) -> &str {
        match self {
            Role::Registrar => "registrar",
            Role::Supervisor => "supervisor",
            Role::Director => "director",
        }
    }

    pub fn display_name(&self) -> &str {
        match self {
            Role::Registrar => "护理计划登记员",
            Role::Supervisor => "护理计划审核主管",
            Role::Director => "养老护理院复核负责人",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PlanStatus {
    #[serde(rename = "待派发")]
    PendingDispatch,
    #[serde(rename = "处理中")]
    InProgress,
    #[serde(rename = "已关闭")]
    Closed,
}

impl PlanStatus {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "待派发" => Some(PlanStatus::PendingDispatch),
            "处理中" => Some(PlanStatus::InProgress),
            "已关闭" => Some(PlanStatus::Closed),
            _ => None,
        }
    }

    pub fn to_str(&self) -> &str {
        match self {
            PlanStatus::PendingDispatch => "待派发",
            PlanStatus::InProgress => "处理中",
            PlanStatus::Closed => "已关闭",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WarningLevel {
    #[serde(rename = "正常")]
    Normal,
    #[serde(rename = "临期")]
    Approaching,
    #[serde(rename = "逾期")]
    Overdue,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub role: Role,
    pub display_name: String,
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CarePlan {
    pub id: Uuid,
    pub plan_no: String,
    pub elder_name: String,
    pub elder_id_card: String,
    pub room_no: String,
    pub admission_date: String,
    pub status: PlanStatus,
    pub current_handler: String,
    pub responsible_person: String,
    pub deadline: String,
    pub version: i32,
    pub assessment_done: bool,
    pub assessment_note: Option<String>,
    pub plan_done: bool,
    pub plan_note: Option<String>,
    pub family_confirmed: bool,
    pub family_note: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub warning_level: Option<WarningLevel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: Uuid,
    pub care_plan_id: Uuid,
    pub file_name: String,
    pub file_type: String,
    pub uploaded_by: String,
    pub uploaded_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingRecord {
    pub id: Uuid,
    pub care_plan_id: Uuid,
    pub action: String,
    pub operator: String,
    pub operator_role: String,
    pub prev_status: String,
    pub new_status: String,
    pub remark: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditNote {
    pub id: Uuid,
    pub care_plan_id: Uuid,
    pub operator: String,
    pub operator_role: String,
    pub action: String,
    pub prev_status: String,
    pub new_status: String,
    pub success: bool,
    pub failure_reason: Option<String>,
    pub remark: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExceptionReason {
    pub id: Uuid,
    pub care_plan_id: Uuid,
    pub exception_type: String,
    pub description: String,
    pub operator: String,
    pub resolved: bool,
    pub created_at: String,
    pub resolved_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePlanRequest {
    pub elder_name: String,
    pub elder_id_card: String,
    pub room_no: String,
    pub admission_date: String,
    pub deadline: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePlanRequest {
    pub assessment_done: Option<bool>,
    pub assessment_note: Option<String>,
    pub plan_done: Option<bool>,
    pub plan_note: Option<String>,
    pub family_confirmed: Option<bool>,
    pub family_note: Option<String>,
    pub remark: Option<String>,
    pub version: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionRequest {
    pub remark: Option<String>,
    pub version: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReturnRequest {
    pub remark: String,
    pub version: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchResult {
    pub plan_id: Uuid,
    pub plan_no: String,
    pub elder_name: String,
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchRequest {
    pub plan_ids: Vec<Uuid>,
    pub action: String,
    pub remark: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub message: String,
    pub data: Option<T>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanListQuery {
    pub status: Option<String>,
    pub warning: Option<String>,
    pub keyword: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadAttachmentRequest {
    pub file_name: String,
    pub file_type: String,
    pub file_base64: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorBody {
    pub success: bool,
    pub message: String,
    pub data: Option<serde_json::Value>,
}

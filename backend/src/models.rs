use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Role {
    #[serde(rename = "pond_admin")]
    PondAdmin,
    #[serde(rename = "quality_engineer")]
    QualityEngineer,
    #[serde(rename = "base_director")]
    BaseDirector,
}

impl Role {
    pub fn as_str(&self) -> &str {
        match self {
            Role::PondAdmin => "pond_admin",
            Role::QualityEngineer => "quality_engineer",
            Role::BaseDirector => "base_director",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "pond_admin" => Some(Role::PondAdmin),
            "quality_engineer" => Some(Role::QualityEngineer),
            "base_director" => Some(Role::BaseDirector),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Status {
    #[serde(rename = "pending_review")]
    PendingReview,
    #[serde(rename = "under_review")]
    UnderReview,
    #[serde(rename = "approved")]
    Approved,
    #[serde(rename = "pending_correction")]
    PendingCorrection,
    #[serde(rename = "synced")]
    Synced,
}

impl Status {
    pub fn as_str(&self) -> &str {
        match self {
            Status::PendingReview => "pending_review",
            Status::UnderReview => "under_review",
            Status::Approved => "approved",
            Status::PendingCorrection => "pending_correction",
            Status::Synced => "synced",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "pending_review" => Some(Status::PendingReview),
            "under_review" => Some(Status::UnderReview),
            "approved" => Some(Status::Approved),
            "pending_correction" => Some(Status::PendingCorrection),
            "synced" => Some(Status::Synced),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OverdueType {
    #[serde(rename = "normal")]
    Normal,
    #[serde(rename = "approaching")]
    Approaching,
    #[serde(rename = "overdue")]
    Overdue,
}

impl OverdueType {
    pub fn as_str(&self) -> &str {
        match self {
            OverdueType::Normal => "normal",
            OverdueType::Approaching => "approaching",
            OverdueType::Overdue => "overdue",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "normal" => Some(OverdueType::Normal),
            "approaching" => Some(OverdueType::Approaching),
            "overdue" => Some(OverdueType::Overdue),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Action {
    #[serde(rename = "submit")]
    Submit,
    #[serde(rename = "approve")]
    Approve,
    #[serde(rename = "reject")]
    Reject,
    #[serde(rename = "correct")]
    Correct,
    #[serde(rename = "confirm_sync")]
    ConfirmSync,
}

impl Action {
    pub fn as_str(&self) -> &str {
        match self {
            Action::Submit => "submit",
            Action::Approve => "approve",
            Action::Reject => "reject",
            Action::Correct => "correct",
            Action::ConfirmSync => "confirm_sync",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "submit" => Some(Action::Submit),
            "approve" => Some(Action::Approve),
            "reject" => Some(Action::Reject),
            "correct" => Some(Action::Correct),
            "confirm_sync" => Some(Action::ConfirmSync),
            _ => None,
        }
    }
}

pub fn compute_overdue_type(deadline: &str) -> OverdueType {
    let now = chrono::Local::now().date_naive();
    let dl = NaiveDate::parse_from_str(deadline, "%Y-%m-%d").unwrap_or(now);
    let approaching_line = dl - chrono::Duration::days(3);
    if now > dl {
        OverdueType::Overdue
    } else if now >= approaching_line {
        OverdueType::Approaching
    } else {
        OverdueType::Normal
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Inspection {
    pub id: String,
    pub pond_id: String,
    pub pond_name: String,
    pub inspector: String,
    pub inspector_role: String,
    pub status: String,
    pub current_handler: String,
    pub current_handler_role: String,
    pub deadline: String,
    pub version: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestIndicator {
    pub id: String,
    pub inspection_id: String,
    pub name: String,
    pub value: String,
    pub unit: String,
    pub standard: String,
    pub is_qualified: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: String,
    pub inspection_id: String,
    pub filename: String,
    pub file_type: String,
    pub file_size: i64,
    pub uploaded_by: String,
    pub uploaded_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditRecord {
    pub id: String,
    pub inspection_id: String,
    pub action: String,
    pub operator: String,
    pub operator_role: String,
    pub comment: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExceptionReason {
    pub id: String,
    pub inspection_id: String,
    pub audit_record_id: String,
    pub reason: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessNode {
    pub step: i32,
    pub title: String,
    pub role: String,
    pub operator: Option<String>,
    pub status: String,
    pub time: Option<String>,
}

pub fn build_process_flow(inspection: &Inspection, audit_records: &[AuditRecord]) -> Vec<ProcessNode> {
    let mut nodes = vec![
        ProcessNode {
            step: 1,
            title: "塘口管理员登记".to_string(),
            role: "pond_admin".to_string(),
            operator: Some(inspection.inspector.clone()),
            status: "completed".to_string(),
            time: Some(inspection.created_at.clone()),
        },
        ProcessNode {
            step: 2,
            title: "水质工程师核验".to_string(),
            role: "quality_engineer".to_string(),
            operator: None,
            status: "pending".to_string(),
            time: None,
        },
        ProcessNode {
            step: 3,
            title: "基地负责人确认".to_string(),
            role: "base_director".to_string(),
            operator: None,
            status: "pending".to_string(),
            time: None,
        },
    ];

    let status = inspection.status.as_str();
    match status {
        "under_review" | "approved" | "pending_correction" | "synced" => {
            let submit_record = audit_records.iter().find(|r| r.action == "submit" || r.action == "correct");
            nodes[1].status = "active".to_string();
            if let Some(r) = submit_record {
                nodes[1].operator = Some(r.operator.clone());
                nodes[1].time = Some(r.created_at.clone());
            }
        }
        _ => {}
    }

    match status {
        "approved" | "synced" => {
            let approve_record = audit_records.iter().find(|r| r.action == "approve");
            nodes[1].status = "completed".to_string();
            if let Some(r) = approve_record {
                nodes[1].operator = Some(r.operator.clone());
                nodes[1].time = Some(r.created_at.clone());
            }
            nodes[2].status = "active".to_string();
        }
        "pending_correction" => {
            let reject_record = audit_records.iter().rev().find(|r| r.action == "reject");
            nodes[1].status = "rejected".to_string();
            if let Some(r) = reject_record {
                nodes[1].operator = Some(r.operator.clone());
                nodes[1].time = Some(r.created_at.clone());
            }
        }
        _ => {}
    }

    if status == "synced" {
        let sync_record = audit_records.iter().find(|r| r.action == "confirm_sync");
        nodes[2].status = "completed".to_string();
        if let Some(r) = sync_record {
            nodes[2].operator = Some(r.operator.clone());
            nodes[2].time = Some(r.created_at.clone());
        }
    }

    nodes
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateInspectionRequest {
    pub pond_id: String,
    pub pond_name: String,
    pub inspector: String,
    pub inspector_role: String,
    pub deadline: String,
    pub indicators: Vec<TestIndicatorInput>,
    pub attachments: Vec<AttachmentInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestIndicatorInput {
    pub name: String,
    pub value: String,
    pub unit: String,
    pub standard: String,
    pub is_qualified: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentInput {
    pub filename: String,
    pub file_type: String,
    pub file_size: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessRequest {
    pub action: String,
    pub operator: String,
    pub operator_role: String,
    pub comment: Option<String>,
    pub exception_reason: Option<String>,
    pub version: i32,
    pub attachments: Option<Vec<AttachmentInput>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchItem {
    pub id: String,
    pub version: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchProcessRequest {
    pub action: String,
    pub operator: String,
    pub operator_role: String,
    pub comment: Option<String>,
    pub exception_reason: Option<String>,
    pub items: Vec<BatchItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchResult {
    pub id: String,
    pub success: bool,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T: Serialize> {
    pub code: i32,
    pub message: String,
    pub data: Option<T>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        ApiResponse {
            code: 0,
            message: "success".to_string(),
            data: Some(data),
        }
    }

    pub fn error(code: i32, message: String) -> ApiResponse<()> {
        ApiResponse {
            code,
            message,
            data: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stats {
    pub total: i64,
    pub pending_review: i64,
    pub under_review: i64,
    pub approved: i64,
    pub pending_correction: i64,
    pub synced: i64,
    pub overdue: i64,
    pub approaching: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pagination {
    pub page: i64,
    pub page_size: i64,
    pub total: i64,
    pub total_pages: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectionListResponse {
    pub items: Vec<Inspection>,
    pub pagination: Pagination,
}

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
    let mut sorted_audits: Vec<&AuditRecord> = audit_records.iter().collect();
    sorted_audits.sort_by(|a, b| a.created_at.cmp(&b.created_at));

    let has_correct = sorted_audits.iter().any(|r| r.action == "correct");
    let last_reject = sorted_audits.iter().rev().find(|r| r.action == "reject");
    let last_correct = sorted_audits.iter().rev().find(|r| r.action == "correct");
    let last_approve = sorted_audits.iter().rev().find(|r| r.action == "approve");
    let last_confirm = sorted_audits.iter().rev().find(|r| r.action == "confirm_sync");

    let status = inspection.status.as_str();

    let mut nodes: Vec<ProcessNode> = Vec::new();

    nodes.push(ProcessNode {
        step: 1,
        title: "塘口管理员登记".to_string(),
        role: "pond_admin".to_string(),
        operator: Some(inspection.inspector.clone()),
        status: "completed".to_string(),
        time: Some(inspection.created_at.clone()),
    });

    if has_correct {
        nodes.push(ProcessNode {
            step: 2,
            title: "塘口管理员补正".to_string(),
            role: "pond_admin".to_string(),
            operator: last_correct.map(|r| r.operator.clone()),
            status: "completed".to_string(),
            time: last_correct.map(|r| r.created_at.clone()),
        });
    }

    let engineer_step = if has_correct { 3 } else { 2 };
    let (engineer_status, engineer_operator, engineer_time): (String, Option<String>, Option<String>) = match status {
        "pending_review" => (
            "active".to_string(),
            last_approve.or(last_reject).map(|r| r.operator.clone()),
            last_approve.or(last_reject).map(|r| r.created_at.clone()),
        ),
        "pending_correction" => (
            "rejected".to_string(),
            last_reject.map(|r| r.operator.clone()),
            last_reject.map(|r| r.created_at.clone()),
        ),
        "approved" | "synced" => (
            "completed".to_string(),
            last_approve.map(|r| r.operator.clone()),
            last_approve.map(|r| r.created_at.clone()),
        ),
        _ => (
            "pending".to_string(),
            None,
            None,
        ),
    };
    nodes.push(ProcessNode {
        step: engineer_step,
        title: "水质工程师核验".to_string(),
        role: "quality_engineer".to_string(),
        operator: engineer_operator,
        status: engineer_status,
        time: engineer_time,
    });

    let director_step = if has_correct { 4 } else { 3 };
    let (director_status, director_operator, director_time): (String, Option<String>, Option<String>) = match status {
        "approved" => (
            "active".to_string(),
            None,
            None,
        ),
        "synced" => (
            "completed".to_string(),
            last_confirm.map(|r| r.operator.clone()),
            last_confirm.map(|r| r.created_at.clone()),
        ),
        "pending_correction" => {
            let base_director_rejected = match (last_reject, last_approve) {
                (Some(r), Some(a)) => {
                    r.operator_role == "base_director" && r.created_at > a.created_at
                }
                _ => false,
            };
            if base_director_rejected {
                (
                    "rejected".to_string(),
                    last_reject.map(|r| r.operator.clone()),
                    last_reject.map(|r| r.created_at.clone()),
                )
            } else {
                ("pending".to_string(), None, None)
            }
        }
        _ => ("pending".to_string(), None, None),
    };
    nodes.push(ProcessNode {
        step: director_step,
        title: "基地负责人确认".to_string(),
        role: "base_director".to_string(),
        operator: director_operator,
        status: director_status,
        time: director_time,
    });

    nodes
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateInspectionRequest {
    pub pond_id: String,
    pub pond_name: String,
    pub inspector: String,
    pub inspector_role: String,
    pub deadline: String,
    pub comment: Option<String>,
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
    pub attachments: Option<Vec<AttachmentInput>>,
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

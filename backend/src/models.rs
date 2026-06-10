use chrono::{Duration, Local, NaiveDate};
use poem_openapi::Object;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub role: String,
    pub name: String,
    pub region: Option<String>,
    pub created_at: String,
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
pub struct Station {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub region: String,
    pub capacity_mw: f64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct PatrolOrder {
    pub id: i64,
    pub order_no: String,
    pub station_id: i64,
    pub station_name: Option<String>,
    pub status: String,
    pub priority: String,
    pub inspector_id: Option<i64>,
    pub inspector_name: Option<String>,
    pub engineer_id: Option<i64>,
    pub engineer_name: Option<String>,
    pub manager_id: Option<i64>,
    pub manager_name: Option<String>,
    pub current_handler: String,
    pub patrol_date: String,
    pub due_date: String,
    pub patrol_content: Option<String>,
    pub weather: Option<String>,
    pub temperature: Option<String>,
    pub patrol_evidence: Option<Vec<String>>,
    pub defect_count: i64,
    pub version: i64,
    pub previous_handler_id: Option<i64>,
    pub previous_opinion: Option<String>,
    pub previous_attachment: Option<String>,
    pub audit_remark: Option<String>,
    pub anomaly_reason: Option<String>,
    pub is_overdue: i64,
    pub overdue_level: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct PatrolOrderDetail {
    pub order: PatrolOrder,
    pub defects: Vec<DefectReport>,
    pub attachments: Vec<Attachment>,
    pub process_records: Vec<ProcessRecord>,
    pub acceptance_records: Vec<AcceptanceRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct CreatePatrolOrderRequest {
    pub station_id: i64,
    pub priority: Option<String>,
    pub inspector_id: Option<i64>,
    pub manager_id: Option<i64>,
    pub patrol_date: String,
    pub due_date: String,
    pub patrol_content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct UpdatePatrolOrderRequest {
    pub patrol_content: Option<String>,
    pub weather: Option<String>,
    pub temperature: Option<String>,
    pub patrol_evidence: Option<Vec<String>>,
    pub correction_note: Option<String>,
    pub version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct SubmitPatrolRequest {
    pub patrol_content: Option<String>,
    pub weather: Option<String>,
    pub temperature: Option<String>,
    pub patrol_evidence: Option<Vec<String>>,
    pub version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct DispatchRequest {
    pub engineer_id: i64,
    pub version: i64,
    pub remark: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct ProcessRequest {
    pub defect_evidences: std::collections::BTreeMap<String, Vec<String>>,
    pub opinion: Option<String>,
    pub version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct ReturnRequest {
    pub opinion: String,
    pub attachment: Option<String>,
    pub version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct ReviewRequest {
    pub result: String,
    pub remark: Option<String>,
    pub version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct BatchProcessItem {
    pub id: i64,
    pub version: i64,
    pub defect_evidences: Option<std::collections::BTreeMap<String, Vec<String>>>,
    pub opinion: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct BatchProcessRequest {
    pub items: Vec<BatchProcessItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct BatchResultItem {
    pub id: i64,
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct BatchCloseItem {
    pub id: i64,
    pub version: i64,
    pub remark: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct BatchCloseRequest {
    pub items: Vec<BatchCloseItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct DefectReport {
    pub id: i64,
    pub patrol_order_id: i64,
    pub defect_no: String,
    pub location: String,
    pub description: String,
    pub severity: String,
    pub category: String,
    pub reported_at: String,
    pub deadline: Option<String>,
    pub status: String,
    pub reporter_id: Option<i64>,
    pub reporter_name: Option<String>,
    pub assignee_id: Option<i64>,
    pub assignee_name: Option<String>,
    pub evidence: Option<Vec<String>>,
    pub anomaly_reason: Option<String>,
    pub version: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct CreateDefectRequest {
    pub patrol_order_id: i64,
    pub location: String,
    pub description: String,
    pub severity: String,
    pub category: String,
    pub deadline: Option<String>,
    pub evidence: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct UpdateDefectRequest {
    pub location: Option<String>,
    pub description: Option<String>,
    pub severity: Option<String>,
    pub category: Option<String>,
    pub deadline: Option<String>,
    pub status: Option<String>,
    pub assignee_id: Option<i64>,
    pub evidence: Option<Vec<String>>,
    pub version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct AcceptanceRequest {
    pub defect_id: i64,
    pub patrol_order_id: i64,
    pub result: String,
    pub evidence: Vec<String>,
    pub remark: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct AcceptanceRecord {
    pub id: i64,
    pub defect_id: i64,
    pub patrol_order_id: i64,
    pub result: String,
    pub evidence: Option<Vec<String>>,
    pub remark: Option<String>,
    pub acceptor_id: Option<i64>,
    pub acceptor_name: Option<String>,
    pub accepted_at: String,
    pub anomaly_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct Attachment {
    pub id: i64,
    pub patrol_order_id: Option<i64>,
    pub defect_id: Option<i64>,
    pub file_name: String,
    pub file_path: String,
    pub file_size: i64,
    pub file_type: String,
    pub uploaded_by: Option<i64>,
    pub uploaded_by_name: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct AuditTrail {
    pub id: i64,
    pub patrol_order_id: i64,
    pub action: String,
    pub from_status: Option<String>,
    pub to_status: Option<String>,
    pub actor_id: i64,
    pub actor_name: Option<String>,
    pub actor_role: String,
    pub remark: Option<String>,
    pub anomaly_reason: Option<String>,
    pub evidence: Option<Vec<String>>,
    pub previous_opinion: Option<String>,
    pub previous_attachment: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct ProcessRecord {
    pub id: i64,
    pub patrol_order_id: i64,
    pub step_order: i64,
    pub step_name: String,
    pub handler_id: Option<i64>,
    pub handler_name: Option<String>,
    pub handler_role: Option<String>,
    pub status: String,
    pub opinion: Option<String>,
    pub evidence: Option<Vec<String>>,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
    pub anomaly_reason: Option<String>,
    pub correction_note: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct Pagination {
    pub page: i64,
    pub page_size: i64,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct PatrolOrderListResponse {
    pub items: Vec<PatrolOrder>,
    pub pagination: Pagination,
    pub group_stats: DueGroupStats,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct DueGroupStats {
    pub normal: i64,
    pub near: i64,
    pub overdue: i64,
}

pub fn calculate_overdue_level(due_date: &str) -> (String, bool) {
    let today = Local::now().date_naive();
    if let Ok(due) = NaiveDate::parse_from_str(due_date, "%Y-%m-%d") {
        let diff = due - today;
        if diff > Duration::days(3) {
            ("normal".to_string(), false)
        } else if diff > Duration::days(0) {
            ("near".to_string(), false)
        } else {
            ("overdue".to_string(), true)
        }
    } else {
        ("normal".to_string(), false)
    }
}

pub fn generate_order_no() -> String {
    let now = Local::now();
    format!("PO{}{:06}", now.format("%Y%m"), rand_suffix())
}

pub fn generate_defect_no() -> String {
    let now = Local::now();
    format!("DF{}{:06}", now.format("%Y%m"), rand_suffix())
}

fn rand_suffix() -> u32 {
    use std::time::{SystemTime, UNIX_EPOCH};
    (SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos() as u32)
        .unwrap_or(0))
        % 1000000
}

pub mod state_machine {
    use super::super::error::AppError;

    pub const PENDING_DISPATCH: &str = "pending_dispatch";
    pub const IN_PROGRESS: &str = "in_progress";
    pub const RETURNED: &str = "returned";
    pub const REVIEWING: &str = "reviewing";
    pub const CLOSED: &str = "closed";
    pub const CANCELLED: &str = "cancelled";

    pub const STEP_INSPECTOR: i64 = 1;
    pub const STEP_ENGINEER: i64 = 2;
    pub const STEP_MANAGER: i64 = 3;

    pub const STATUS_PENDING: &str = "pending";
    pub const STATUS_IN_PROGRESS: &str = "in_progress";
    pub const STATUS_COMPLETED: &str = "completed";

    pub fn can_submit(current_status: &str) -> bool {
        matches!(current_status, PENDING_DISPATCH | RETURNED)
    }

    pub fn can_dispatch(current_status: &str) -> bool {
        matches!(current_status, PENDING_DISPATCH | RETURNED | IN_PROGRESS)
    }

    pub fn can_process(current_status: &str) -> bool {
        matches!(current_status, IN_PROGRESS)
    }

    pub fn can_return(current_status: &str) -> bool {
        matches!(current_status, IN_PROGRESS | REVIEWING)
    }

    pub fn can_review(current_status: &str) -> bool {
        matches!(current_status, REVIEWING)
    }

    pub fn can_close(current_status: &str) -> bool {
        matches!(current_status, REVIEWING)
    }

    pub fn can_update(current_status: &str, current_handler: &str, user_role: &str) -> bool {
        if user_role == "admin" {
            return true;
        }
        matches!(current_status, PENDING_DISPATCH | RETURNED)
            && current_handler == "inspector"
            && user_role == "inspector"
    }

    pub fn can_defect_report(current_status: &str, current_handler: &str) -> bool {
        matches!(current_status, PENDING_DISPATCH | IN_PROGRESS | RETURNED)
            && current_handler == "inspector"
    }

    pub fn can_acceptance(current_status: &str) -> bool {
        matches!(current_status, IN_PROGRESS | REVIEWING)
    }

    pub fn check_transition(current_status: &str, action: &str) -> Result<(), AppError> {
        let allowed = match action {
            "submit" => can_submit(current_status),
            "dispatch" => can_dispatch(current_status),
            "process" => can_process(current_status),
            "return" => can_return(current_status),
            "review" => can_review(current_status),
            "close" => can_close(current_status),
            "update" => true,
            _ => false,
        };
        if !allowed {
            return Err(AppError::bad_request(format!(
                "状态冲突：当前状态「{}」不允许执行「{}」操作",
                status_label(current_status), action_label(action)
            )));
        }
        Ok(())
    }

    pub fn status_label(status: &str) -> &str {
        match status {
            PENDING_DISPATCH => "待派发",
            IN_PROGRESS => "处理中",
            RETURNED => "已退回",
            REVIEWING => "复核中",
            CLOSED => "已关闭",
            CANCELLED => "已取消",
            _ => status,
        }
    }

    pub fn action_label(action: &str) -> &str {
        match action {
            "submit" => "提交",
            "dispatch" => "派发",
            "process" => "办理",
            "return" => "退回",
            "review" => "复核",
            "close" => "关闭",
            "update" => "更新",
            "batch_process" => "批量办理",
            "batch_close" => "批量关闭",
            _ => action,
        }
    }

    pub fn next_status_after_submit() -> &'static str {
        IN_PROGRESS
    }

    pub fn next_status_after_dispatch() -> &'static str {
        IN_PROGRESS
    }

    pub fn next_status_after_process() -> &'static str {
        REVIEWING
    }

    pub fn next_status_after_return() -> &'static str {
        RETURNED
    }

    pub fn next_status_after_review_pass() -> &'static str {
        CLOSED
    }

    pub fn next_status_after_review_fail() -> &'static str {
        RETURNED
    }

    pub fn next_handler_after_submit() -> &'static str {
        "manager"
    }

    pub fn next_handler_after_dispatch() -> &'static str {
        "engineer"
    }

    pub fn next_handler_after_process() -> &'static str {
        "manager"
    }

    pub fn next_handler_after_return(current_handler: &str) -> &'static str {
        match current_handler {
            "engineer" => "inspector",
            "manager" => "engineer",
            _ => "inspector",
        }
    }

    pub fn next_handler_after_review_pass() -> &'static str {
        "inspector"
    }

    pub fn next_handler_after_review_fail() -> &'static str {
        "engineer"
    }

    pub fn return_target_handler(returner_role: &str) -> &'static str {
        match returner_role {
            "engineer" => "inspector",
            "manager" => "engineer",
            _ => "inspector",
        }
    }

    pub fn return_step(returner_role: &str) -> i64 {
        match returner_role {
            "engineer" => STEP_INSPECTOR,
            "manager" => STEP_ENGINEER,
            _ => STEP_INSPECTOR,
        }
    }
}

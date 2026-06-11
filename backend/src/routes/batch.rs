use crate::auth::{can_access_case, check_permission, AuthGuard};
use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{
    ApiResponse, BatchProcessRequest, BatchResult, CaseStatus, UserRole,
};
use crate::utils::{
    check_version, get_case, record_audit_note, update_case_status,
};
use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::Route;

pub fn routes() -> Vec<Route> {
    rocket::routes![batch_process]
}

#[post("/cases/batch", data = "<req>")]
fn batch_process(
    db: &Database,
    auth: AuthGuard,
    req: Json<BatchProcessRequest>,
) -> Result<(Status, Json<ApiResponse<Vec<BatchResult>>>)> {
    if req.case_ids.is_empty() {
        return Err(AppError::BadRequest("请选择要处理的案件".to_string()));
    }

    let action = req.action.as_str();
    let (allowed_roles, new_status) = get_action_config(action)?;

    check_permission(&auth.user, &allowed_roles, &format!("批量{}", get_action_name(action)))?;

    let mut results: Vec<BatchResult> = Vec::new();

    for &case_id in &req.case_ids {
        let result = process_single_case(db, case_id, action, &new_status, &req.remark, &req.versions, &auth);
        match result {
            Ok(case_no) => {
                results.push(BatchResult {
                    case_id,
                    case_no,
                    success: true,
                    message: "操作成功".to_string(),
                });
            }
            Err(e) => {
                let case_no = get_case(db, case_id)
                    .map(|c| c.case_no)
                    .unwrap_or_else(|_| format!("未知案件({})", case_id));
                results.push(BatchResult {
                    case_id,
                    case_no,
                    success: false,
                    message: e.to_string(),
                });
            }
        }
    }

    let success_count = results.iter().filter(|r| r.success).count();
    let total_count = results.len();

    Ok((
        Status::Ok,
        Json(ApiResponse::success(
            results,
            &format!(
                "批量处理完成，成功 {}/{} 个案件",
                success_count, total_count
            ),
        )),
    ))
}

fn get_action_config(action: &str) -> Result<(Vec<UserRole>, Option<CaseStatus>)> {
    match action {
        "submit" => Ok((
            vec![UserRole::Registrar, UserRole::Supervisor, UserRole::Director],
            None,
        )),
        "resubmit" => Ok((
            vec![UserRole::Registrar, UserRole::Supervisor, UserRole::Director],
            Some(CaseStatus::Resubmitted),
        )),
        "review" => Ok((
            vec![UserRole::Reviewer, UserRole::Supervisor, UserRole::Director],
            Some(CaseStatus::Reviewing),
        )),
        "assign" => Ok((
            vec![UserRole::Supervisor, UserRole::Director],
            Some(CaseStatus::Assigned),
        )),
        "start_followup" => Ok((
            vec![UserRole::Assistant, UserRole::Lawyer, UserRole::Supervisor, UserRole::Director],
            Some(CaseStatus::Followup),
        )),
        "complete" => Ok((
            vec![UserRole::Assistant, UserRole::Lawyer, UserRole::Supervisor, UserRole::Director],
            Some(CaseStatus::Completed),
        )),
        "archive" => Ok((
            vec![UserRole::Supervisor, UserRole::Director],
            Some(CaseStatus::Archived),
        )),
        "return" => Ok((
            vec![UserRole::Reviewer, UserRole::Supervisor, UserRole::Director],
            Some(CaseStatus::Returned),
        )),
        _ => Err(AppError::BadRequest(format!("不支持的批量操作: {}", action))),
    }
}

fn get_action_name(action: &str) -> &str {
    match action {
        "submit" => "提交",
        "resubmit" => "重新提交",
        "review" => "审核",
        "assign" => "分派",
        "start_followup" => "开始回访",
        "complete" => "完成",
        "archive" => "归档",
        "return" => "退回",
        _ => "操作",
    }
}

fn process_single_case(
    db: &Database,
    case_id: i64,
    action: &str,
    new_status: &Option<CaseStatus>,
    remark: &Option<String>,
    versions: &std::collections::HashMap<i64, i32>,
    auth: &AuthGuard,
) -> Result<String> {
    let case = get_case(db, case_id)?;

    let expected_version = versions.get(&case_id).ok_or_else(|| {
        AppError::BadRequest(format!(
            "案件 {} 缺少版本号信息",
            case.case_no
        ))
    })?;

    check_version(case.version, *expected_version)?;

    if !can_access_case(&auth.user, case.created_by, case.current_handler_id, &case.status) {
        return Err(AppError::PermissionError(format!(
            "用户无权操作案件 {}",
            case.case_no
        )));
    }

    let actual_new_status = match action {
        "submit" => {
            if matches!(case.status, CaseStatus::Draft | CaseStatus::PendingSubmit) {
                CaseStatus::Submitted
            } else if matches!(case.status, CaseStatus::Returned) {
                CaseStatus::Resubmitted
            } else {
                return Err(AppError::InvalidStatusTransition {
                    from: case.status.as_str().to_string(),
                    to: "submitted".to_string(),
                });
            }
        }
        "review" => {
            if matches!(case.status, CaseStatus::Submitted | CaseStatus::Resubmitted) {
                CaseStatus::Reviewing
            } else {
                return Err(AppError::InvalidStatusTransition {
                    from: case.status.as_str().to_string(),
                    to: "reviewing".to_string(),
                });
            }
        }
        _ => new_status.clone().ok_or_else(|| {
            AppError::InternalError(format!("操作 {} 缺少目标状态", action))
        })?,
    };

    update_case_status(
        db,
        case_id,
        &case.status,
        &actual_new_status,
        auth.user.id,
        remark.as_deref(),
    )?;

    record_audit_note(
        db,
        case_id,
        None,
        "batch_status_change",
        &format!(
            "用户 {} 批量操作将案件状态从 {} 变更为 {}",
            auth.user.real_name,
            case.status.as_str(),
            actual_new_status.as_str()
        ),
        Some(auth.user.id),
    )?;

    Ok(case.case_no)
}

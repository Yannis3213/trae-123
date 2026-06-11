use crate::error::AppError;
use crate::models::{Action, Role, Status};

pub fn validate_role_action(role: &str, action: &Action) -> Result<(), AppError> {
    let role_enum = Role::from_str(role).ok_or_else(|| AppError::Validation(format!("无效角色: {}", role)))?;
    let allowed = match role_enum {
        Role::PondAdmin => matches!(action, Action::Submit | Action::Correct),
        Role::QualityEngineer => matches!(action, Action::Approve | Action::Reject),
        Role::BaseDirector => matches!(action, Action::ConfirmSync | Action::Reject),
    };
    if !allowed {
        return Err(AppError::Unauthorized("无权执行此操作".to_string()));
    }
    Ok(())
}

pub fn validate_status_transition(current_status: &str, action: &Action) -> Result<String, AppError> {
    let status = Status::from_str(current_status).ok_or_else(|| AppError::Validation(format!("无效状态: {}", current_status)))?;
    match action {
        Action::Submit => match status {
            Status::PendingReview | Status::UnderReview => Ok("under_review".to_string()),
            _ => Err(AppError::Validation(format!("当前状态 {} 不允许提交", current_status))),
        },
        Action::Approve => match status {
            Status::UnderReview => Ok("approved".to_string()),
            _ => Err(AppError::Validation(format!("当前状态 {} 不允许通过", current_status))),
        },
        Action::Reject => match status {
            Status::UnderReview | Status::Approved => Ok("pending_correction".to_string()),
            _ => Err(AppError::Validation(format!("当前状态 {} 不允许退回", current_status))),
        },
        Action::Correct => match status {
            Status::PendingCorrection => Ok("pending_review".to_string()),
            _ => Err(AppError::Validation(format!("当前状态 {} 不允许补正", current_status))),
        },
        Action::ConfirmSync => match status {
            Status::Approved => Ok("synced".to_string()),
            _ => Err(AppError::Validation(format!("当前状态 {} 不允许确认同步", current_status))),
        },
    }
}

pub fn validate_version(db_version: i32, request_version: i32) -> Result<(), AppError> {
    if db_version != request_version {
        return Err(AppError::Conflict("版本冲突，请刷新后重试".to_string()));
    }
    Ok(())
}

pub fn validate_evidence_required(action: &Action, attachment_count: usize) -> Result<(), AppError> {
    match action {
        Action::Submit | Action::Correct => {
            if attachment_count == 0 {
                return Err(AppError::Validation("提交和补正时必须至少上传1个附件".to_string()));
            }
        }
        _ => {}
    }
    Ok(())
}

pub fn validate_reject_requires_reason(action: &Action, reason: Option<&str>) -> Result<(), AppError> {
    if matches!(action, Action::Reject) {
        if reason.is_none() || reason.map(|r| r.trim().is_empty()).unwrap_or(true) {
            return Err(AppError::Validation("退回时必须填写异常原因".to_string()));
        }
    }
    Ok(())
}

pub fn get_next_handler(action: &Action) -> (&'static str, &'static str) {
    match action {
        Action::Submit => ("quality_engineer_default", "quality_engineer"),
        Action::Approve => ("base_director_default", "base_director"),
        Action::Reject => ("pond_admin_default", "pond_admin"),
        Action::Correct => ("quality_engineer_default", "quality_engineer"),
        Action::ConfirmSync => ("base_director_default", "base_director"),
    }
}

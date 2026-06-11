use crate::errors::{AppError, ValidationErrors};
use crate::models::{Case, CaseStatus, ExpiryStatus, ProcessingStage, Role, User};
use chrono::{Duration, Utc};

pub fn calculate_expiry_status(case: &Case) -> ExpiryStatus {
    let now = Utc::now();
    let deadline = case.deadline;

    if now > deadline {
        ExpiryStatus::Overdue
    } else if deadline - now <= Duration::days(2) {
        ExpiryStatus::NearingExpiry
    } else {
        ExpiryStatus::Normal
    }
}

pub fn validate_status_transition(
    case: &Case,
    to_status: CaseStatus,
    user: &User,
) -> Result<(ProcessingStage, String), AppError> {
    let from_status = case.status;

    if from_status == CaseStatus::Completed {
        return Err(AppError::Conflict("已办结案件无法修改状态".into()));
    }

    match (from_status, to_status, user.role) {
        (CaseStatus::PendingCorrection, CaseStatus::UnderReview, Role::Dispatcher) => {
            Ok((
                ProcessingStage::Registration,
                "登记员补正材料后提交审核".into(),
            ))
        }
        (CaseStatus::PendingCorrection, _, Role::Dispatcher) => {
            Err(AppError::BadRequest(
                "登记员只能将待补正案件提交为复核中".into(),
            ))
        }
        (CaseStatus::UnderReview, CaseStatus::PendingCorrection, Role::Reviewer) => Ok((
            ProcessingStage::Registration,
            "复核人退回补正".into(),
        )),
        (CaseStatus::UnderReview, CaseStatus::UnderReview, Role::PoliceOfficer) => Ok((
            ProcessingStage::Dispatch,
            "民警完成处置派警，移交复核".into(),
        )),
        (CaseStatus::UnderReview, CaseStatus::Completed, Role::Reviewer) => Ok((
            ProcessingStage::Review,
            "复核通过，予以办结".into(),
        )),
        (_, _, _) => Err(AppError::Forbidden(format!(
            "角色[{}]无权将状态从[{}]变更为[{}]",
            user.role.display_name(),
            from_status.display_name(),
            to_status.display_name()
        ))),
    }
}

pub fn validate_handler_assignment(
    case: &Case,
    user: &User,
) -> Result<(), AppError> {
    match user.role {
        Role::Dispatcher => {
            if case.current_stage != ProcessingStage::Registration {
                return Err(AppError::Forbidden(format!(
                    "登记员只能处理登记阶段的案件，当前处于[{}]阶段",
                    case.current_stage.display_name()
                )));
            }
            if case.created_by != user.id {
                return Err(AppError::Forbidden(format!(
                    "你只能操作自己创建的案件，该案件由[{}]创建",
                    case.created_by_name
                )));
            }
        }
        Role::PoliceOfficer => {
            if case.current_stage != ProcessingStage::Dispatch {
                return Err(AppError::Forbidden(format!(
                    "民警只能处理处置派警阶段的案件，当前处于[{}]阶段",
                    case.current_stage.display_name()
                )));
            }
            if let Some(handler_id) = case.current_handler_id {
                if handler_id != user.id {
                    return Err(AppError::Forbidden(format!(
                        "该案件已分配给[{}]处理，你无权操作",
                        case.current_handler_name.as_deref().unwrap_or("其他民警")
                    )));
                }
            }
        }
        Role::Reviewer => {
            if case.current_stage != ProcessingStage::Review {
                return Err(AppError::Forbidden(format!(
                    "复核人只能处理复核阶段的案件，当前处于[{}]阶段",
                    case.current_stage.display_name()
                )));
            }
        }
    }
    Ok(())
}

pub fn validate_case_evidence(
    case: &Case,
    to_status: CaseStatus,
) -> Result<(), AppError> {
    let mut errors = ValidationErrors::new();

    if to_status == CaseStatus::UnderReview || to_status == CaseStatus::Completed {
        if !case.registration_materials_complete {
            errors.add(
                "registration_materials",
                "警情登记材料不齐全，缺少报案笔录或相关附件",
            );
        }
    }

    if to_status == CaseStatus::Completed {
        if !case.dispatch_timeline_met {
            errors.add(
                "dispatch_timeline",
                "处置派警时限未达标，存在超时情况",
            );
        }
        if !case.followup_evidence_complete {
            errors.add(
                "followup_evidence",
                "回访确认证据不完整，缺少回访录音或确认记录",
            );
        }
    }

    if !errors.is_empty() {
        return Err(AppError::Validation(errors));
    }

    Ok(())
}

pub fn validate_version(case: &Case, expected_version: i64) -> Result<(), AppError> {
    if case.version != expected_version {
        return Err(AppError::Conflict(format!(
            "版本冲突：当前版本为{}，你提交的版本为{}，请刷新页面后重试",
            case.version, expected_version
        )));
    }
    Ok(())
}

pub fn validate_batch_permission(
    cases: &[Case],
    to_status: CaseStatus,
    user: &User,
) -> Result<(), AppError> {
    match (to_status, user.role) {
        (CaseStatus::PendingCorrection, Role::Reviewer) => Ok(()),
        (CaseStatus::UnderReview, Role::Dispatcher) => Ok(()),
        (CaseStatus::UnderReview, Role::PoliceOfficer) => Ok(()),
        (CaseStatus::Completed, Role::Reviewer) => Ok(()),
        _ => Err(AppError::Forbidden(format!(
            "角色[{}]无权批量将案件状态变更为[{}]",
            user.role.display_name(),
            to_status.display_name()
        ))),
    }
}

pub fn get_expiry_days(case: &Case) -> i64 {
    let now = Utc::now();
    let deadline = case.deadline;
    (deadline - now).num_days()
}

pub fn determine_next_stage(to_status: CaseStatus, current_stage: ProcessingStage) -> ProcessingStage {
    match to_status {
        CaseStatus::PendingCorrection => ProcessingStage::Registration,
        CaseStatus::UnderReview => match current_stage {
            ProcessingStage::Registration => ProcessingStage::Dispatch,
            ProcessingStage::Dispatch => ProcessingStage::Review,
            ProcessingStage::Review => ProcessingStage::Review,
        },
        CaseStatus::Completed => ProcessingStage::Review,
    }
}

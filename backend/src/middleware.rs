use poem::Result;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct AuthError {
    pub success: bool,
    pub message: String,
    pub code: String,
}

pub fn is_exception_type(exception_type: &Option<String>) -> bool {
    matches!(exception_type.as_deref(), Some("missing_materials") | Some("overdue") | Some("returned"))
}

pub fn validate_role_permission(
    action: &str,
    role: &str,
    current_status: &str,
    exception_type: &Option<String>,
) -> Result<(), AuthError> {
    let is_exception = is_exception_type(exception_type);
    let exception_label = match exception_type.as_deref() {
        Some("missing_materials") => "缺材料",
        Some("overdue") => "逾期",
        Some("returned") => "退回补正",
        _ => "异常",
    };

    if is_exception {
        match action {
            "review_pass" | "archive" => {
                return Err(AuthError {
                    success: false,
                    message: format!("{}预约单不允许{}，请先补正或退回", exception_label, if action == "archive" { "归档" } else { "复核通过" }),
                    code: "EXCEPTION_BLOCKED".to_string(),
                });
            }
            "return_to_correct" | "correction_submit" => {}
            _ => {
                return Err(AuthError {
                    success: false,
                    message: format!("{}预约单仅允许补正或退回操作", exception_label),
                    code: "EXCEPTION_BLOCKED".to_string(),
                });
            }
        }
    }

    match action {
        "submit_review" => {
            if role != "beautician" {
                return Err(AuthError {
                    success: false,
                    message: "只有护理师可以提交复核".to_string(),
                    code: "PERMISSION_DENIED".to_string(),
                });
            }
            if current_status != "draft" && current_status != "pending_review" {
                return Err(AuthError {
                    success: false,
                    message: "当前状态不允许提交复核".to_string(),
                    code: "STATUS_CONFLICT".to_string(),
                });
            }
        }
        "review_pass" | "review_reject" => {
            if role != "consultant" {
                return Err(AuthError {
                    success: false,
                    message: "只有美容顾问可以执行复核操作".to_string(),
                    code: "PERMISSION_DENIED".to_string(),
                });
            }
            if current_status != "pending_review" {
                return Err(AuthError {
                    success: false,
                    message: "只有待复核状态可以执行复核".to_string(),
                    code: "STATUS_CONFLICT".to_string(),
                });
            }
        }
        "return_to_correct" => {
            if role != "consultant" && role != "store_manager" {
                return Err(AuthError {
                    success: false,
                    message: "只有美容顾问或店长可以退回补正".to_string(),
                    code: "PERMISSION_DENIED".to_string(),
                });
            }
            if current_status != "pending_review" {
                return Err(AuthError {
                    success: false,
                    message: "只有待复核状态可以退回补正".to_string(),
                    code: "STATUS_CONFLICT".to_string(),
                });
            }
        }
        "correction_submit" => {
            if role != "beautician" {
                return Err(AuthError {
                    success: false,
                    message: "只有护理师可以提交补正".to_string(),
                    code: "PERMISSION_DENIED".to_string(),
                });
            }
            if current_status != "pending_review" {
                return Err(AuthError {
                    success: false,
                    message: "状态异常，无法提交补正".to_string(),
                    code: "STATUS_CONFLICT".to_string(),
                });
            }
        }
        "archive" => {
            if role != "store_manager" {
                return Err(AuthError {
                    success: false,
                    message: "只有门店店长可以归档".to_string(),
                    code: "PERMISSION_DENIED".to_string(),
                });
            }
            if current_status != "pending_review" {
                return Err(AuthError {
                    success: false,
                    message: "只有待复核状态可以归档".to_string(),
                    code: "STATUS_CONFLICT".to_string(),
                });
            }
        }
        "mark_overdue" => {
            if role != "store_manager" && role != "system" {
                return Err(AuthError {
                    success: false,
                    message: "只有店长或系统可以标记逾期".to_string(),
                    code: "PERMISSION_DENIED".to_string(),
                });
            }
        }
        _ => {}
    }
    Ok(())
}

pub fn validate_handler(
    username: &str,
    role: &str,
    appointment: &crate::models::Appointment,
    action: &str,
) -> Result<(), AuthError> {
    if action == "archive" {
        if username != appointment.store_manager {
            return Err(AuthError {
                success: false,
                message: format!("归档操作必须由门店店长 {} 执行，当前用户 {}", appointment.store_manager, username),
                code: "WRONG_HANDLER".to_string(),
            });
        }
        return Ok(());
    }

    if action == "review_pass" || action == "review_reject" || action == "return_to_correct" {
        if role == "consultant" && username != appointment.consultant {
            return Err(AuthError {
                success: false,
                message: format!("复核操作必须由负责顾问 {} 执行", appointment.consultant),
                code: "WRONG_HANDLER".to_string(),
            });
        }
        if role == "store_manager" && username != appointment.store_manager {
            return Err(AuthError {
                success: false,
                message: format!("退回操作必须由门店店长 {} 执行", appointment.store_manager),
                code: "WRONG_HANDLER".to_string(),
            });
        }
        return Ok(());
    }

    if action == "submit_review" || action == "correction_submit" {
        if username != appointment.beautician {
            return Err(AuthError {
                success: false,
                message: format!("该操作必须由负责护理师 {} 执行", appointment.beautician),
                code: "WRONG_HANDLER".to_string(),
            });
        }
        return Ok(());
    }

    if username != appointment.current_handler && role != "store_manager" {
        return Err(AuthError {
            success: false,
            message: format!("当前处理人为 {}，您无权操作此单", appointment.current_handler),
            code: "WRONG_HANDLER".to_string(),
        });
    }

    Ok(())
}

pub fn validate_version(
    request_version: i64,
    current_version: i64,
) -> Result<(), AuthError> {
    if request_version != current_version {
        return Err(AuthError {
            success: false,
            message: format!("版本冲突：您提交的版本 v{} 与当前版本 v{} 不一致，请刷新后重试", request_version, current_version),
            code: "VERSION_CONFLICT".to_string(),
        });
    }
    Ok(())
}

pub fn validate_reason_fields(
    action: &str,
    exception_reason: &Option<String>,
    correction_note: &Option<String>,
) -> Result<(), AuthError> {
    if action == "return_to_correct" {
        if exception_reason.as_ref().map_or(true, |r| r.trim().is_empty()) {
            return Err(AuthError {
                success: false,
                message: "退回补正必须填写退回原因".to_string(),
                code: "MISSING_RETURN_REASON".to_string(),
            });
        }
    }
    if action == "correction_submit" {
        if correction_note.as_ref().map_or(true, |r| r.trim().is_empty()) {
            return Err(AuthError {
                success: false,
                message: "补正提交必须填写补正说明".to_string(),
                code: "MISSING_CORRECTION_NOTE".to_string(),
            });
        }
    }
    Ok(())
}

pub fn validate_attachment_types(
    action: &str,
    attachments: &[crate::models::AttachmentInput],
) -> Result<(), AuthError> {
    let allowed = get_required_evidence(action, "pending_review");
    for att in attachments {
        if !allowed.contains(&att.evidence_type) {
            return Err(AuthError {
                success: false,
                message: format!("当前动作不允许上传类型为「{}」的证据", evidence_label(&att.evidence_type)),
                code: "INVALID_EVIDENCE_TYPE".to_string(),
            });
        }
    }
    Ok(())
}

pub fn validate_required_evidence(
    _action: &str,
    required: &[String],
    existing_types: &[String],
) -> Result<(), AuthError> {
    let mut missing = vec![];
    for req in required {
        if !existing_types.contains(req) {
            missing.push(req.clone());
        }
    }

    if !missing.is_empty() {
        let labels: Vec<String> = missing.iter().map(|t| evidence_label(t)).collect();
        return Err(AuthError {
            success: false,
            message: format!("缺少必要证据：{}", labels.join("、")),
            code: "MISSING_EVIDENCE".to_string(),
        });
    }

    Ok(())
}

pub fn evidence_label(t: &str) -> String {
    match t {
        "customer_appointment" => "顾客预约凭证".to_string(),
        "project_confirmation" => "项目确认单".to_string(),
        "service_followup" => "服务回访记录".to_string(),
        _ => t.to_string(),
    }
}

pub fn get_required_evidence(action: &str, current_status: &str) -> Vec<String> {
    match action {
        "submit_review" => vec!["customer_appointment".to_string(), "project_confirmation".to_string()],
        "review_pass" => vec!["service_followup".to_string()],
        "archive" => vec!["customer_appointment".to_string(), "project_confirmation".to_string(), "service_followup".to_string()],
        "correction_submit" => {
            if current_status == "pending_review" {
                vec!["customer_appointment".to_string(), "project_confirmation".to_string()]
            } else {
                vec![]
            }
        }
        _ => vec![],
    }
}

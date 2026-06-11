use crate::db::Database;
use crate::models::*;
use chrono::Utc;

pub enum UrgencyGroup {
    Normal,
    NearDeadline,
    Overdue,
}

pub fn urgency_for_order(order: &InboundOrder) -> UrgencyGroup {
    let Some(deadline) = order.deadline else {
        return UrgencyGroup::Normal;
    };
    let now = Utc::now();
    if now > deadline {
        UrgencyGroup::Overdue
    } else if (deadline - now).num_hours() <= 6 {
        UrgencyGroup::NearDeadline
    } else {
        UrgencyGroup::Normal
    }
}

pub fn urgency_display(g: &UrgencyGroup) -> (&'static str, &'static str) {
    match g {
        UrgencyGroup::Normal => ("正常", "normal"),
        UrgencyGroup::NearDeadline => ("临期", "near"),
        UrgencyGroup::Overdue => ("逾期", "overdue"),
    }
}

pub fn validate_process(
    _db: &Database,
    order: &InboundOrder,
    req: &ProcessOrderRequest,
    user: &User,
) -> Result<(), String> {
    if order.version != req.version {
        return Err("版本冲突，请刷新后重试".to_string());
    }

    if order.current_handler_role != user.role.to_str() {
        return Err(format!(
            "当前处理角色应为 {}，您是 {}，无权操作",
            Role::from_str(&order.current_handler_role).unwrap().display_name(),
            user.role.display_name()
        ));
    }

    if let Some(handler_id) = &order.current_handler_id {
        if handler_id != &user.id {
            return Err(format!(
                "当前处理人应为 {:?}，您无权操作此单据",
                order.current_handler_name
            ));
        }
    }

    if req.opinion.trim().is_empty() {
        return Err("处理意见必填".to_string());
    }

    if matches!(user.role, Role::OperationsManager) {
        if req.audit_note.as_deref().map(|s| s.trim().is_empty()).unwrap_or(true) {
            return Err("运营经理必须填写审计备注".to_string());
        }
    }

    let deadline_ok = match order.deadline {
        Some(d) => {
            if Utc::now() > d {
                req.action == "补正" || req.action == "退回补正" || req.action == "保存"
            } else {
                true
            }
        }
        None => true,
    };
    if !deadline_ok {
        return Err("该单据已逾期，仅允许补正或退回操作".to_string());
    }

    match user.role {
        Role::WarehouseKeeper => {
            validate_keeper_action(order, req, user)
        }
        Role::WarehouseSupervisor => {
            validate_supervisor_action(order, req, user)
        }
        Role::OperationsManager => {
            validate_manager_action(order, req, user)
        }
    }
}

fn validate_keeper_action(
    order: &InboundOrder,
    req: &ProcessOrderRequest,
    _user: &User,
) -> Result<(), String> {
    match req.action.as_str() {
        "提交" => {
            let mut missing = Vec::new();
            let appt_done = order.appointment_complete || req.appointment_evidence.is_some();
            let insp_done = order.inspection_complete || req.inspection_evidence.is_some();
            let reg_done = order.registration_complete || req.registration_evidence.is_some();
            if !appt_done { missing.push("入库预约"); }
            if !insp_done { missing.push("质检上架"); }
            if !reg_done { missing.push("入库单登记"); }
            if !missing.is_empty() {
                return Err(format!("提交前需完成: {}", missing.join("、")));
            }
            Ok(())
        }
        "补正" | "保存" => Ok(()),
        _ => Err(format!("库管员不支持操作: {}", req.action)),
    }
}

fn validate_supervisor_action(
    order: &InboundOrder,
    req: &ProcessOrderRequest,
    _user: &User,
) -> Result<(), String> {
    match req.action.as_str() {
        "确认通过" => {
            if order.status != OrderStatus::PendingConfirmation && order.status != OrderStatus::Exception {
                return Err("仅待确认或异常(被运营退回)状态可确认通过".to_string());
            }
            let mut missing = Vec::new();
            let appt_done = order.appointment_complete || req.appointment_evidence.is_some();
            let insp_done = order.inspection_complete || req.inspection_evidence.is_some();
            let reg_done = order.registration_complete || req.registration_evidence.is_some();
            if !appt_done { missing.push("入库预约"); }
            if !insp_done { missing.push("质检上架"); }
            if !reg_done { missing.push("入库单登记"); }
            if !missing.is_empty() {
                return Err(format!("确认前需完成模块证据: {}", missing.join("、")));
            }
            Ok(())
        }
        "退回补正" => {
            if req.exception_reason.as_deref().map(|s| s.trim().is_empty()).unwrap_or(true) {
                return Err("退回必须填写异常原因".to_string());
            }
            if req.exception_module.is_none() {
                return Err("退回必须指明异常所属模块".to_string());
            }
            Ok(())
        }
        "补正" | "保存" => Ok(()),
        _ => Err(format!("仓储主管不支持操作: {}", req.action)),
    }
}

fn validate_manager_action(
    order: &InboundOrder,
    req: &ProcessOrderRequest,
    _user: &User,
) -> Result<(), String> {
    match req.action.as_str() {
        "最终确认" => {
            if order.status != OrderStatus::PendingConfirmation {
                return Err("仅待确认状态可最终确认".to_string());
            }
            let mut missing = Vec::new();
            let appt_done = order.appointment_complete || req.appointment_evidence.is_some();
            let insp_done = order.inspection_complete || req.inspection_evidence.is_some();
            let reg_done = order.registration_complete || req.registration_evidence.is_some();
            if !appt_done { missing.push("入库预约"); }
            if !insp_done { missing.push("质检上架"); }
            if !reg_done { missing.push("入库单登记"); }
            if !missing.is_empty() {
                return Err(format!("最终确认前需完成模块证据: {}", missing.join("、")));
            }
            Ok(())
        }
        "退回补正" => {
            if req.exception_reason.as_deref().map(|s| s.trim().is_empty()).unwrap_or(true) {
                return Err("退回必须填写异常原因".to_string());
            }
            if req.exception_module.is_none() {
                return Err("退回必须指明异常所属模块".to_string());
            }
            Ok(())
        }
        _ => Err(format!("运营经理不支持操作: {}", req.action)),
    }
}

pub fn apply_process(
    db: &Database,
    order: &mut InboundOrder,
    req: &ProcessOrderRequest,
    user: &User,
) -> Result<(), String> {
    let from_status = order.status.to_str().to_string();
    let mut to_status = from_status.clone();

    if let Some(ev) = &req.appointment_evidence {
        order.appointment_evidence = Some(ev.clone());
        order.appointment_complete = true;
    }
    if let Some(ev) = &req.inspection_evidence {
        order.inspection_evidence = Some(ev.clone());
        order.inspection_complete = true;
    }
    if let Some(ev) = &req.registration_evidence {
        order.registration_evidence = Some(ev.clone());
        order.registration_complete = true;
    }

    match user.role {
        Role::WarehouseKeeper => {
            match req.action.as_str() {
                "提交" => {
                    order.status = OrderStatus::PendingConfirmation;
                    order.current_handler_role = Role::WarehouseSupervisor.to_str().to_string();
                    order.current_handler_id = Some("u3".to_string());
                    order.current_handler_name = Some("仓储主管王五".to_string());
                    to_status = OrderStatus::PendingConfirmation.to_str().to_string();
                }
                "保存" | "补正" => {
                    order.current_handler_role = Role::WarehouseKeeper.to_str().to_string();
                    order.current_handler_id = Some(user.id.clone());
                    order.current_handler_name = Some(user.name.clone());
                    to_status = order.status.to_str().to_string();
                }
                _ => {}
            }
        }
        Role::WarehouseSupervisor => {
            match req.action.as_str() {
                "确认通过" => {
                    order.status = OrderStatus::PendingConfirmation;
                    order.current_handler_role = Role::OperationsManager.to_str().to_string();
                    order.current_handler_id = Some("u4".to_string());
                    order.current_handler_name = Some("运营经理赵六".to_string());
                    to_status = OrderStatus::PendingConfirmation.to_str().to_string();
                }
                "退回补正" => {
                    order.status = OrderStatus::Exception;
                    order.current_handler_role = Role::WarehouseKeeper.to_str().to_string();
                    order.current_handler_id = Some("u1".to_string());
                    order.current_handler_name = Some("库管员张三".to_string());
                    to_status = OrderStatus::Exception.to_str().to_string();
                    let exc = ExceptionReason {
                        id: crate::db::new_id(),
                        order_id: order.id.clone(),
                        reason: req.exception_reason.clone().unwrap(),
                        module: req.exception_module.clone().unwrap_or("general".to_string()),
                        created_by: user.id.clone(),
                        created_at: Utc::now(),
                    };
                    db.add_exception(&exc);
                }
                "保存" | "补正" => {
                    order.current_handler_role = Role::WarehouseSupervisor.to_str().to_string();
                    order.current_handler_id = Some(user.id.clone());
                    order.current_handler_name = Some(user.name.clone());
                    to_status = order.status.to_str().to_string();
                }
                _ => {}
            }
        }
        Role::OperationsManager => {
            match req.action.as_str() {
                "最终确认" => {
                    order.status = OrderStatus::Rechecked;
                    order.current_handler_role = Role::OperationsManager.to_str().to_string();
                    order.current_handler_id = Some(user.id.clone());
                    order.current_handler_name = Some(user.name.clone());
                    order.deadline = None;
                    to_status = OrderStatus::Rechecked.to_str().to_string();
                }
                "退回补正" => {
                    order.status = OrderStatus::Exception;
                    order.current_handler_role = Role::WarehouseSupervisor.to_str().to_string();
                    order.current_handler_id = Some("u3".to_string());
                    order.current_handler_name = Some("仓储主管王五".to_string());
                    to_status = OrderStatus::Exception.to_str().to_string();
                    let exc = ExceptionReason {
                        id: crate::db::new_id(),
                        order_id: order.id.clone(),
                        reason: req.exception_reason.clone().unwrap(),
                        module: req.exception_module.clone().unwrap_or("general".to_string()),
                        created_by: user.id.clone(),
                        created_at: Utc::now(),
                    };
                    db.add_exception(&exc);
                }
                _ => {}
            }
        }
    }

    order.version += 1;
    order.last_opinion = Some(req.opinion.clone());
    order.last_attachment_id = req.attachment_id.clone();
    order.last_audit_note = req.audit_note.clone();

    if let Some(note) = &req.audit_note {
        if !note.trim().is_empty() {
            let an = AuditNote {
                id: crate::db::new_id(),
                order_id: order.id.clone(),
                note: note.clone(),
                created_by: user.id.clone(),
                created_at: Utc::now(),
                creator_role: user.role.to_str().to_string(),
            };
            db.add_audit_note(&an);
        }
    }

    let rec = ProcessingRecord {
        id: crate::db::new_id(),
        order_id: order.id.clone(),
        handler_id: user.id.clone(),
        handler_name: user.name.clone(),
        handler_role: user.role.to_str().to_string(),
        action: req.action.clone(),
        opinion: req.opinion.clone(),
        from_status,
        to_status,
        processed_at: Utc::now(),
        attachment_id: req.attachment_id.clone(),
    };
    db.add_record(&rec);
    db.update_order(order)?;
    Ok(())
}

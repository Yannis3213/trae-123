use crate::error::AppError;
use crate::models::{OrderStatus, UserRole, EvidenceType};
use uuid::Uuid;

pub struct AuthContext {
    pub user_id: Uuid,
    pub user_role: UserRole,
    pub user_name: String,
}

pub struct TransitionTarget {
    pub from: OrderStatus,
    pub to: OrderStatus,
    pub action_name: String,
    pub allowed_roles: Vec<UserRole>,
    pub required_evidence: Vec<EvidenceType>,
    pub next_handler_role: Option<UserRole>,
}

pub fn all_transitions() -> Vec<TransitionTarget> {
    vec![
        TransitionTarget {
            from: OrderStatus::Draft,
            to: OrderStatus::PendingAudit,
            action_name: "提交审核（线路报价已核验）".to_string(),
            allowed_roles: vec![UserRole::Registrar],
            required_evidence: vec![EvidenceType::RouteQuote],
            next_handler_role: Some(UserRole::Auditor),
        },
        TransitionTarget {
            from: OrderStatus::PendingAudit,
            to: OrderStatus::PendingCorrection,
            action_name: "退回补正".to_string(),
            allowed_roles: vec![UserRole::Auditor],
            required_evidence: vec![],
            next_handler_role: Some(UserRole::Registrar),
        },
        TransitionTarget {
            from: OrderStatus::PendingAudit,
            to: OrderStatus::PendingReview,
            action_name: "审核通过（报名确认已核验）".to_string(),
            allowed_roles: vec![UserRole::Auditor],
            required_evidence: vec![EvidenceType::RouteQuote, EvidenceType::RegistrationConfirm],
            next_handler_role: Some(UserRole::Reviewer),
        },
        TransitionTarget {
            from: OrderStatus::PendingCorrection,
            to: OrderStatus::PendingAudit,
            action_name: "补正后重新提交审核".to_string(),
            allowed_roles: vec![UserRole::Registrar],
            required_evidence: vec![EvidenceType::RouteQuote],
            next_handler_role: Some(UserRole::Auditor),
        },
        TransitionTarget {
            from: OrderStatus::PendingReview,
            to: OrderStatus::PendingCorrection,
            action_name: "复核退回补正".to_string(),
            allowed_roles: vec![UserRole::Reviewer],
            required_evidence: vec![],
            next_handler_role: Some(UserRole::Registrar),
        },
        TransitionTarget {
            from: OrderStatus::PendingReview,
            to: OrderStatus::Archived,
            action_name: "复核归档（三类证据齐全）".to_string(),
            allowed_roles: vec![UserRole::Reviewer],
            required_evidence: vec![
                EvidenceType::RouteQuote,
                EvidenceType::RegistrationConfirm,
                EvidenceType::TourAudit,
            ],
            next_handler_role: None,
        },
    ]
}

pub fn find_transition(from: &OrderStatus, to: &OrderStatus) -> Option<TransitionTarget> {
    all_transitions()
        .into_iter()
        .find(|t| t.from == *from && t.to == *to)
}

pub struct EvidenceState {
    pub route_quote: bool,
    pub registration: bool,
    pub tour_audit: bool,
}

impl EvidenceState {
    pub fn has(&self, e: EvidenceType) -> bool {
        match e {
            EvidenceType::RouteQuote => self.route_quote,
            EvidenceType::RegistrationConfirm => self.registration,
            EvidenceType::TourAudit => self.tour_audit,
        }
    }
}

pub struct CheckResult {
    pub transition: TransitionTarget,
    pub missing_evidence: Vec<EvidenceType>,
}

pub fn check_state_change(
    from: &OrderStatus,
    to: &OrderStatus,
    role: &UserRole,
    evidence: &EvidenceState,
) -> Result<CheckResult, AppError> {
    let transition = find_transition(from, to).ok_or_else(|| {
        AppError::StateConflictError(format!(
            "状态流转不合法：不允许从「{}」变更为「{}」",
            from.label(),
            to.label()
        ))
    })?;

    if !transition.allowed_roles.contains(role) {
        let allowed_names: Vec<&str> = transition.allowed_roles.iter().map(|r| r.label()).collect();
        return Err(AppError::AuthorizationError(format!(
            "角色「{}」无权执行此操作（允许角色：{}）",
            role.label(),
            allowed_names.join("、")
        )));
    }

    let mut missing = Vec::new();
    for e in &transition.required_evidence {
        if !evidence.has(*e) {
            missing.push(*e);
        }
    }

    Ok(CheckResult {
        transition,
        missing_evidence: missing,
    })
}

pub fn allowed_visible_statuses(role: &UserRole) -> Vec<OrderStatus> {
    match role {
        UserRole::Registrar => vec![
            OrderStatus::Draft,
            OrderStatus::PendingCorrection,
        ],
        UserRole::Auditor => vec![
            OrderStatus::PendingAudit,
            OrderStatus::PendingCorrection,
        ],
        UserRole::Reviewer => vec![
            OrderStatus::PendingReview,
            OrderStatus::Archived,
        ],
    }
}

pub fn can_view_order(
    role: &UserRole,
    status: &OrderStatus,
    created_by: &Uuid,
    handler_id: &Option<Uuid>,
    current_user_id: &Uuid,
) -> bool {
    let visible = allowed_visible_statuses(role);
    if !visible.contains(status) {
        return false;
    }

    match role {
        UserRole::Registrar => created_by == current_user_id,
        UserRole::Auditor => true,
        UserRole::Reviewer => true,
    }
}

pub fn available_status_filters(role: &UserRole) -> Vec<(String, String)> {
    allowed_visible_statuses(role)
        .into_iter()
        .map(|s| (s.as_str().to_string(), s.label().to_string()))
        .collect()
}

pub fn available_actions(
    role: &UserRole,
    status: &OrderStatus,
    is_overdue: bool,
) -> Vec<(OrderStatus, String, bool)> {
    all_transitions()
        .into_iter()
        .filter(|t| t.from == *status && t.allowed_roles.contains(role))
        .map(|t| {
            let disabled = is_overdue && matches!(t.to, OrderStatus::PendingAudit | OrderStatus::PendingReview);
            (t.to, t.action_name, disabled)
        })
        .collect()
}

pub fn next_handler_for(
    target_status: &OrderStatus,
    registrar_id: &Uuid,
) -> (Option<Uuid>, Option<String>, Option<UserRole>) {
    match target_status {
        OrderStatus::Draft => (Some(*registrar_id), Some("创建人".to_string()), Some(UserRole::Registrar)),
        OrderStatus::PendingCorrection => (Some(*registrar_id), Some("原登记员".to_string()), Some(UserRole::Registrar)),
        OrderStatus::PendingAudit => (None, None, Some(UserRole::Auditor)),
        OrderStatus::PendingReview => (None, None, Some(UserRole::Reviewer)),
        OrderStatus::Archived | OrderStatus::Rejected => (None, None, None),
    }
}

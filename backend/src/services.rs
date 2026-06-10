use crate::error::AppError;
use crate::models::{OrderStatus, UserRole, AuthUser};

pub struct StateTransition {
    pub from: OrderStatus,
    pub to: OrderStatus,
    pub allowed_roles: Vec<UserRole>,
    pub required_evidence: Vec<EvidenceType>,
    pub action_name: String,
}

#[derive(Clone, Copy)]
pub enum EvidenceType {
    RouteQuote,
    RegistrationConfirm,
    TourAudit,
}

impl EvidenceType {
    pub fn as_str(self) -> &'static str {
        match self {
            EvidenceType::RouteQuote => "route_quote_evidence",
            EvidenceType::RegistrationConfirm => "registration_confirm_evidence",
            EvidenceType::TourAudit => "tour_audit_evidence",
        }
    }
}

pub fn get_allowed_transitions() -> Vec<StateTransition> {
    vec![
        StateTransition {
            from: OrderStatus::Draft,
            to: OrderStatus::PendingAudit,
            allowed_roles: vec![UserRole::Registrar],
            required_evidence: vec![EvidenceType::RouteQuote],
            action_name: "提交审核".to_string(),
        },
        StateTransition {
            from: OrderStatus::PendingAudit,
            to: OrderStatus::PendingCorrection,
            allowed_roles: vec![UserRole::Auditor],
            required_evidence: vec![],
            action_name: "退回补正".to_string(),
        },
        StateTransition {
            from: OrderStatus::PendingAudit,
            to: OrderStatus::PendingReview,
            allowed_roles: vec![UserRole::Auditor],
            required_evidence: vec![EvidenceType::RouteQuote, EvidenceType::RegistrationConfirm],
            action_name: "审核通过待复核".to_string(),
        },
        StateTransition {
            from: OrderStatus::PendingCorrection,
            to: OrderStatus::PendingAudit,
            allowed_roles: vec![UserRole::Registrar],
            required_evidence: vec![EvidenceType::RouteQuote],
            action_name: "补正后提交".to_string(),
        },
        StateTransition {
            from: OrderStatus::PendingReview,
            to: OrderStatus::PendingCorrection,
            allowed_roles: vec![UserRole::Reviewer],
            required_evidence: vec![],
            action_name: "复核退回补正".to_string(),
        },
        StateTransition {
            from: OrderStatus::PendingReview,
            to: OrderStatus::Archived,
            allowed_roles: vec![UserRole::Reviewer],
            required_evidence: vec![
                EvidenceType::RouteQuote,
                EvidenceType::RegistrationConfirm,
                EvidenceType::TourAudit,
            ],
            action_name: "复核归档".to_string(),
        },
    ]
}

pub fn check_state_transition(
    from: &OrderStatus,
    to: &OrderStatus,
    user: &AuthUser,
    has_route_quote: bool,
    has_registration: bool,
    has_tour_audit: bool,
) -> Result<StateTransition, AppError> {
    let transitions = get_allowed_transitions();
    let transition = transitions
        .iter()
        .find(|t| t.from == *from && t.to == *to)
        .ok_or_else(|| {
            AppError::StateConflictError(format!(
                "不允许从状态 {:?} 变更到 {:?}",
                from, to
            ))
        })?;

    if !transition.allowed_roles.contains(&user.role) {
        return Err(AppError::AuthorizationError(format!(
            "角色 {:?} 无权执行此状态变更",
            user.role
        )));
    }

    let mut missing = Vec::new();
    for evidence in &transition.required_evidence {
        let has = match evidence {
            EvidenceType::RouteQuote => has_route_quote,
            EvidenceType::RegistrationConfirm => has_registration,
            EvidenceType::TourAudit => has_tour_audit,
        };
        if !has {
            missing.push(evidence.as_str().to_string());
        }
    }

    if !missing.is_empty() {
        return Err(AppError::MissingEvidenceError(format!(
            "缺少必要证据: {}",
            missing.join(", ")
        )));
    }

    Ok(StateTransition {
        from: transition.from.clone(),
        to: transition.to.clone(),
        allowed_roles: transition.allowed_roles.clone(),
        required_evidence: transition.required_evidence.clone(),
        action_name: transition.action_name.clone(),
    })
}

pub fn can_view_order(user: &AuthUser, status: &OrderStatus, handler_id: &Option<uuid::Uuid>, created_by: &uuid::Uuid) -> bool {
    match user.role {
        UserRole::Registrar => {
            matches!(
                status,
                OrderStatus::Draft | OrderStatus::PendingCorrection
            ) && *created_by == user.id
        }
        UserRole::Auditor => {
            matches!(
                status,
                OrderStatus::PendingAudit | OrderStatus::PendingCorrection
            )
        }
        UserRole::Reviewer => {
            matches!(
                status,
                OrderStatus::PendingReview | OrderStatus::Archived
            )
        }
    }
}

pub fn get_visible_statuses(user: &AuthUser) -> Vec<OrderStatus> {
    match user.role {
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

pub fn get_next_handler(
    status: &OrderStatus,
    registrar_id: &uuid::Uuid,
    current: &Option<uuid::Uuid>,
) -> Option<uuid::Uuid> {
    match status {
        OrderStatus::Draft => Some(*registrar_id),
        OrderStatus::PendingAudit => None,
        OrderStatus::PendingCorrection => Some(*registrar_id),
        OrderStatus::PendingReview => None,
        OrderStatus::Archived => None,
        OrderStatus::Rejected => None,
    }
}

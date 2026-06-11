from api.models import RoleChoices, OrderStatusChoices, RequirementStatusChoices, RequirementDeliveryOrder


SUBMIT_ROLES = {
    'requirement': [RoleChoices.DELIVERY_REGISTRAR],
    'schedule': [RoleChoices.DEV_LEAD],
    'delivery': [RoleChoices.PROJECT_ASSISTANT],
}

AUDIT_ROLES = {
    'requirement': [RoleChoices.AUDIT_SUPERVISOR],
    'schedule': [RoleChoices.AUDIT_SUPERVISOR],
    'delivery': [RoleChoices.AUDIT_SUPERVISOR],
}

REVIEW_ROLES = [RoleChoices.REVIEW_LEADER]
ARCHIVE_ROLES = [RoleChoices.DELIVERY_MANAGER]
ADVANCE_ROLES = [RoleChoices.DELIVERY_MANAGER, RoleChoices.AUDIT_SUPERVISOR]


def can_view_order(user, order):
    return True


def can_create_order(user):
    return user.role in [
        RoleChoices.PROJECT_ASSISTANT,
        RoleChoices.DELIVERY_REGISTRAR,
        RoleChoices.DELIVERY_MANAGER,
    ]


def can_submit_module(user, order, module_type):
    roles = SUBMIT_ROLES.get(module_type, [])
    if user.role not in roles:
        return False
    if order.status == OrderStatusChoices.VERIFY_FAILED:
        if module_type == 'requirement':
            return order.requirement_status == RequirementStatusChoices.EXCEPTION
        if module_type == 'schedule':
            return order.schedule_status == RequirementStatusChoices.EXCEPTION
        if module_type == 'delivery':
            return order.delivery_status == RequirementStatusChoices.EXCEPTION
        return False
    if module_type == 'requirement':
        return order.status in [OrderStatusChoices.PENDING_VERIFY, OrderStatusChoices.VERIFY_FAILED] or order.requirement_status == RequirementStatusChoices.NOT_STARTED
    if module_type == 'schedule':
        return order.requirement_status == RequirementStatusChoices.COMPLETED and order.schedule_status in [RequirementStatusChoices.NOT_STARTED, RequirementStatusChoices.EXCEPTION]
    if module_type == 'delivery':
        return order.schedule_status == RequirementStatusChoices.COMPLETED and order.delivery_status in [RequirementStatusChoices.NOT_STARTED, RequirementStatusChoices.EXCEPTION]
    return False


def is_correct_scenario(user, order, module_type):
    if order.status != OrderStatusChoices.VERIFY_FAILED:
        return False
    roles = SUBMIT_ROLES.get(module_type, [])
    if user.role not in roles:
        return False
    if module_type == 'requirement':
        return order.requirement_status == RequirementStatusChoices.EXCEPTION
    if module_type == 'schedule':
        return order.schedule_status == RequirementStatusChoices.EXCEPTION
    if module_type == 'delivery':
        return order.delivery_status == RequirementStatusChoices.EXCEPTION
    return False


def can_audit_module(user, order, module_type):
    roles = AUDIT_ROLES.get(module_type, [])
    if user.role not in roles:
        return False
    if module_type == 'requirement':
        return order.status == OrderStatusChoices.REQUIREMENT_SUBMITTED
    if module_type == 'schedule':
        return order.status == OrderStatusChoices.SCHEDULE_SUBMITTED
    if module_type == 'delivery':
        return order.status == OrderStatusChoices.DELIVERY_SUBMITTED
    return False


def can_review_order(user, order):
    if user.role not in REVIEW_ROLES:
        return False
    return order.status in [OrderStatusChoices.DELIVERY_AUDITED, OrderStatusChoices.REVIEW_PENDING]


def can_archive_order(user, order):
    if user.role not in ARCHIVE_ROLES:
        return False
    return order.status == OrderStatusChoices.REVIEW_COMPLETED


def can_advance_order(user, order):
    if user.role not in ADVANCE_ROLES:
        return False
    return order.status in [
        OrderStatusChoices.PENDING_VERIFY,
        OrderStatusChoices.VERIFY_FAILED,
        OrderStatusChoices.REQUIREMENT_AUDITED,
        OrderStatusChoices.SCHEDULE_AUDITED,
    ]


def can_verify_order(user):
    return user.role in ADVANCE_ROLES


def get_allowed_actions(user, order):
    actions = []
    if can_submit_module(user, order, 'requirement'):
        if is_correct_scenario(user, order, 'requirement'):
            actions.append('requirement_correct')
        else:
            actions.append('requirement_submit')
    if can_submit_module(user, order, 'schedule'):
        if is_correct_scenario(user, order, 'schedule'):
            actions.append('schedule_correct')
        else:
            actions.append('schedule_submit')
    if can_submit_module(user, order, 'delivery'):
        if is_correct_scenario(user, order, 'delivery'):
            actions.append('delivery_correct')
        else:
            actions.append('delivery_submit')
    if can_audit_module(user, order, 'requirement'):
        actions.append('requirement_audit')
    if can_audit_module(user, order, 'schedule'):
        actions.append('schedule_audit')
    if can_audit_module(user, order, 'delivery'):
        actions.append('delivery_audit')
    if can_review_order(user, order):
        actions.append('review')
    if can_archive_order(user, order):
        actions.append('archive')
    if can_advance_order(user, order):
        actions.append('advance')
    return actions

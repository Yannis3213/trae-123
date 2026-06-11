from .schemas import VALID_ROLES, VALID_STATUSES


STATUS_TRANSITIONS = {
    "submit": {"from": "pending_submit", "to": "pending_process"},
    "process": {"from": "pending_process", "to": "processing"},
    "verify": {"from": "processing", "to": "pending_review"},
    "review": {"from": "pending_review", "to": "pending_archive"},
    "archive": {"from": "pending_archive", "to": "archived"},
    "resubmit": {"from": "returned", "to": "pending_process"},
}

RETURN_BLOCKED_STATUSES = {"archived", "pending_submit"}

ROLE_ACTION_PERMISSIONS = {
    "enterprise_service": {"submit", "resubmit"},
    "engineering_supervisor": {"process", "verify", "return"},
    "park_manager": {"review", "archive", "return"},
}

EVIDENCE_REQUIRED_ACTIONS = {"verify", "review", "archive"}

UPDATE_ALLOWED_STATUSES = {"pending_submit", "returned"}

UPDATE_ALLOWED_ROLES = {"enterprise_service"}


class ValidationError(Exception):
    def __init__(self, message):
        self.message = message
        super().__init__(message)


def validate_role(role):
    if role not in VALID_ROLES:
        raise ValidationError(f"无效的角色: {role}, 有效角色: {', '.join(VALID_ROLES)}")


def validate_action_permission(role, action):
    if role not in ROLE_ACTION_PERMISSIONS:
        raise ValidationError(f"角色 {role} 没有操作权限")
    if action not in ROLE_ACTION_PERMISSIONS[role]:
        raise ValidationError(f"角色 {role} 无权执行 {action} 操作")


def validate_status_transition(action, current_status):
    if action == "return":
        if current_status in RETURN_BLOCKED_STATUSES:
            raise ValidationError(f"状态为 {current_status} 的工单不能退回")
        return "returned"
    transition = STATUS_TRANSITIONS.get(action)
    if transition is None:
        raise ValidationError(f"未知操作: {action}")
    if current_status != transition["from"]:
        raise ValidationError(
            f"操作 {action} 要求状态为 {transition['from']}, 当前状态为 {current_status}"
        )
    return transition["to"]


def validate_handler(action, order, request_handler_id):
    if action == "process":
        return True
    if action in ("verify", "review", "archive"):
        assigned = order.get("current_handler_id", "")
        if assigned and assigned != request_handler_id:
            raise ValidationError("当前用户不是该工单的处理人")
    return True


def validate_version(order_version, request_version):
    if order_version != request_version:
        raise ValidationError(
            f"版本冲突: 工单版本为 {order_version}, 请求版本为 {request_version}, 工单可能已被其他人修改"
        )


def validate_evidence(attachments):
    if not attachments or len(attachments) == 0:
        raise ValidationError("缺少佐证材料: 此操作必须上传至少一个附件")
    return True


def validate_return_reason(return_reason, return_opinion):
    if not return_reason or not return_reason.strip():
        raise ValidationError("退回原因不能为空")
    if not return_opinion or not return_opinion.strip():
        raise ValidationError("退回意见不能为空")


def validate_resubmit(order, correction_reason):
    if order["status"] != "returned":
        raise ValidationError("只有被退回的工单才能重新提交")
    if not correction_reason or not correction_reason.strip():
        raise ValidationError("整改原因不能为空")
    if not order.get("last_handler_result"):
        raise ValidationError("缺少上次处理结果，无法重新提交")


def validate_update(order, user_id, user_role):
    if order["status"] not in UPDATE_ALLOWED_STATUSES:
        raise ValidationError(f"状态为 {order['status']} 的工单不允许修改, 仅 {', '.join(UPDATE_ALLOWED_STATUSES)} 状态可改")
    if user_role not in UPDATE_ALLOWED_ROLES:
        raise ValidationError(f"角色 {user_role} 无权修改工单")
    if order["created_by"] != user_id:
        raise ValidationError("只能修改自己创建的工单")

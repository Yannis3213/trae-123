from datetime import datetime
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from .models import (
    User, UserRole, PurchaseStatus, FreshPurchaseOrder,
    ProcessingRecord, WarningLevel
)
from .schemas import StatusTransitionRequest, BatchActionRequest


STATUS_FLOW_MAP = {
    UserRole.REGISTRAR: {
        PurchaseStatus.PENDING_DISPATCH: [PurchaseStatus.PROCESSING],
    },
    UserRole.SUPERVISOR: {
        PurchaseStatus.PROCESSING: [PurchaseStatus.CLOSED, PurchaseStatus.PENDING_DISPATCH],
    },
    UserRole.REVIEWER: {
        PurchaseStatus.PROCESSING: [PurchaseStatus.CLOSED],
        PurchaseStatus.PENDING_DISPATCH: [PurchaseStatus.PROCESSING],
    }
}

STATUS_HANDLER_MAP = {
    PurchaseStatus.PENDING_DISPATCH: UserRole.REGISTRAR,
    PurchaseStatus.PROCESSING: UserRole.SUPERVISOR,
    PurchaseStatus.CLOSED: None,
}


def check_role_permission(user_role: UserRole, current_status: PurchaseStatus, target_status: PurchaseStatus) -> bool:
    allowed = STATUS_FLOW_MAP.get(user_role, {})
    allowed_transitions = allowed.get(current_status, [])
    return target_status in allowed_transitions


def can_view_order(user: User, order: FreshPurchaseOrder) -> bool:
    if user.role == UserRole.REVIEWER:
        return True
    if user.role == UserRole.REGISTRAR:
        if order.status == PurchaseStatus.PENDING_DISPATCH:
            return order.creator_id == user.id or order.current_handler_id == user.id
        return order.creator_id == user.id
    if user.role == UserRole.SUPERVISOR:
        if order.status == PurchaseStatus.PROCESSING:
            return order.current_handler_id == user.id or order.store == user.store
        return order.store == user.store
    return False


def can_edit_order(user: User, order: FreshPurchaseOrder) -> bool:
    if order.status == PurchaseStatus.CLOSED:
        return False
    if user.role == UserRole.REVIEWER:
        return True
    if user.role == UserRole.REGISTRAR:
        return order.status == PurchaseStatus.PENDING_DISPATCH and (
            order.creator_id == user.id or order.current_handler_id == user.id
        )
    if user.role == UserRole.SUPERVISOR:
        return order.status == PurchaseStatus.PROCESSING and (
            order.current_handler_id == user.id or order.store == user.store
        )
    return False


def validate_status_transition(
    db: Session,
    order: FreshPurchaseOrder,
    user: User,
    request: StatusTransitionRequest
) -> Tuple[bool, str]:
    if request.expected_version != order.version:
        return False, f"版本冲突：当前版本为 {order.version}，请刷新后重试"

    if order.status == PurchaseStatus.CLOSED:
        return False, "单据已关闭，不能再变更状态"

    if not check_role_permission(user.role, order.status, request.target_status):
        return False, f"角色权限不足：{user.role.value} 不能从 {order.status.value} 变更到 {request.target_status.value}"

    if order.status == PurchaseStatus.PENDING_DISPATCH and request.target_status == PurchaseStatus.PROCESSING:
        if not order.has_quotation_evidence:
            return False, "缺少供应商报价材料证据，不能派发处理"
        if not order.supplier_quotation or len(order.supplier_quotation.strip()) < 10:
            return False, "供应商报价内容不完整，请补正后提交"

    if order.status == PurchaseStatus.PROCESSING and request.target_status == PurchaseStatus.CLOSED:
        if not order.has_purchase_evidence:
            return False, "缺少采购下单证据，不能关闭"
        if not order.has_arrival_evidence:
            return False, "缺少到货验收证据，不能关闭"
        if not order.purchase_order_content or len(order.purchase_order_content.strip()) < 10:
            return False, "采购下单内容不完整，请补正"
        if not order.arrival_verification or len(order.arrival_verification.strip()) < 10:
            return False, "到货验收内容不完整，请补正"

    if request.target_status == PurchaseStatus.CLOSED:
        now = datetime.utcnow()
        if now > order.deadline and not order.is_overdue:
            return False, f"已超过截止时间 {order.deadline.strftime('%Y-%m-%d %H:%M')}，请先处理逾期标记"

    return True, "校验通过"


def update_warning_level(order: FreshPurchaseOrder) -> None:
    now = datetime.utcnow()
    if order.status == PurchaseStatus.CLOSED:
        order.warning_level = WarningLevel.NORMAL
        order.is_overdue = False
        return

    time_left = order.deadline - now
    total_seconds = time_left.total_seconds()

    if total_seconds < 0:
        order.warning_level = WarningLevel.OVERDUE
        order.is_overdue = True
    elif total_seconds < 24 * 60 * 60:
        order.warning_level = WarningLevel.APPROACHING
        order.is_overdue = False
    else:
        order.warning_level = WarningLevel.NORMAL
        order.is_overdue = False


def determine_next_handler_id(
    db: Session,
    target_status: PurchaseStatus,
    current_store: str
) -> Optional[int]:
    required_role = STATUS_HANDLER_MAP.get(target_status)
    if required_role is None:
        return None
    handler = db.query(User).filter(
        User.role == required_role,
        User.is_active == True
    ).first()
    if handler:
        return handler.id
    return None


def add_processing_record(
    db: Session,
    order: FreshPurchaseOrder,
    user: User,
    action: str,
    from_status: Optional[str],
    to_status: Optional[str],
    result: str,
    comment: Optional[str] = None,
    exception_reason: Optional[str] = None,
    evidence_checked: Optional[str] = None
) -> ProcessingRecord:
    record = ProcessingRecord(
        order_id=order.id,
        action=action,
        from_status=from_status,
        to_status=to_status,
        handler_id=user.id,
        handler_name=user.full_name,
        handler_role=user.role.value,
        result=result,
        comment=comment,
        exception_reason=exception_reason,
        evidence_checked=evidence_checked,
        timestamp=datetime.utcnow()
    )
    db.add(record)
    return record


def validate_batch_action(
    db: Session,
    user: User,
    request: BatchActionRequest
) -> list:
    results = []
    for order_id in request.order_ids:
        order = db.query(FreshPurchaseOrder).filter(FreshPurchaseOrder.id == order_id).first()
        if not order:
            results.append({
                "order_id": order_id,
                "order_no": "UNKNOWN",
                "success": False,
                "message": "单据不存在",
                "current_status": None
            })
            continue

        expected_version = None
        if request.expected_versions:
            expected_version = request.expected_versions.get(str(order_id))

        if order.status == PurchaseStatus.CLOSED:
            results.append({
                "order_id": order.id,
                "order_no": order.order_no,
                "success": False,
                "message": "单据已关闭，不能批量处理",
                "current_status": order.status
            })
            continue

        if not can_view_order(user, order):
            results.append({
                "order_id": order.id,
                "order_no": order.order_no,
                "success": False,
                "message": "无权访问此单据",
                "current_status": order.status
            })
            continue

        if request.target_status and request.target_status != order.status:
            if not check_role_permission(user.role, order.status, request.target_status):
                results.append({
                    "order_id": order.id,
                    "order_no": order.order_no,
                    "success": False,
                    "message": f"无权限从 {order.status.value} 变更到 {request.target_status.value}",
                    "current_status": order.status
                })
                continue

            if expected_version is not None and expected_version != order.version:
                results.append({
                    "order_id": order.id,
                    "order_no": order.order_no,
                    "success": False,
                    "message": f"版本冲突：期望版本 {expected_version}，当前版本 {order.version}",
                    "current_status": order.status
                })
                continue

            if order.status == PurchaseStatus.PENDING_DISPATCH and request.target_status == PurchaseStatus.PROCESSING:
                if not order.has_quotation_evidence:
                    results.append({
                        "order_id": order.id,
                        "order_no": order.order_no,
                        "success": False,
                        "message": "缺少供应商报价材料证据",
                        "current_status": order.status
                    })
                    continue

            if order.status == PurchaseStatus.PROCESSING and request.target_status == PurchaseStatus.CLOSED:
                if not order.has_purchase_evidence or not order.has_arrival_evidence:
                    results.append({
                        "order_id": order.id,
                        "order_no": order.order_no,
                        "success": False,
                        "message": "缺少采购下单或到货验收证据",
                        "current_status": order.status
                    })
                    continue

        results.append({
            "order_id": order.id,
            "order_no": order.order_no,
            "success": True,
            "message": "校验通过，待执行",
            "current_status": order.status
        })
    return results

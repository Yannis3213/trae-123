from datetime import datetime
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from .models import (
    User, UserRole, PurchaseStatus, FreshPurchaseOrder,
    ProcessingRecord, WarningLevel, AuditNote
)
from .schemas import StatusTransitionRequest, BatchActionRequest, EXCEPTION_TYPE_TO_AUDIT_NOTE_TYPE


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

EXCEPTION_TYPES = {
    "version_conflict": "版本冲突",
    "already_closed": "单据已关闭",
    "role_denied": "角色权限不足",
    "handler_mismatch": "当前处理人不匹配",
    "missing_quotation_evidence": "缺少供应商报价材料证据",
    "missing_quotation_content": "供应商报价内容不完整",
    "missing_purchase_evidence": "缺少采购下单证据",
    "missing_arrival_evidence": "缺少到货验收证据",
    "missing_purchase_content": "采购下单内容不完整",
    "missing_arrival_content": "到货验收内容不完整",
    "deadline_overdue": "已超过截止时间",
    "state_conflict": "状态冲突",
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


def check_current_handler(user: User, order: FreshPurchaseOrder) -> Tuple[bool, str]:
    if user.role == UserRole.REVIEWER:
        return True, ""

    required_role = STATUS_HANDLER_MAP.get(order.status)
    if required_role is None:
        return True, ""

    if user.role != required_role:
        return False, f"当前状态「{order.status.value}」需要「{required_role.value}」角色处理，当前角色为「{user.role.value}」"

    if order.current_handler_id and order.current_handler_id != user.id:
        if user.role == UserRole.SUPERVISOR and order.store == user.store:
            return True, ""
        if user.role == UserRole.REGISTRAR and order.creator_id == user.id:
            return True, ""
        return False, f"当前处理人为「{order.current_handler_id}」，您无权操作此单据"

    return True, ""


def validate_status_transition(
    db: Session,
    order: FreshPurchaseOrder,
    user: User,
    request: StatusTransitionRequest
) -> Tuple[bool, str, str]:
    exception_type = "state_conflict"

    if request.expected_version != order.version:
        return False, f"版本冲突：当前版本为 {order.version}，请刷新后重试", "version_conflict"

    if order.status == PurchaseStatus.CLOSED:
        return False, "单据已关闭，不能再变更状态", "already_closed"

    if not check_role_permission(user.role, order.status, request.target_status):
        return False, f"角色权限不足：{user.role.value} 不能从 {order.status.value} 变更到 {request.target_status.value}", "role_denied"

    handler_ok, handler_msg = check_current_handler(user, order)
    if not handler_ok:
        return False, handler_msg, "handler_mismatch"

    if order.status == PurchaseStatus.PENDING_DISPATCH and request.target_status == PurchaseStatus.PROCESSING:
        if not order.has_quotation_evidence:
            return False, "缺少供应商报价材料证据，不能派发处理", "missing_quotation_evidence"
        if not order.supplier_quotation or len(order.supplier_quotation.strip()) < 10:
            return False, "供应商报价内容不完整，请补正后提交", "missing_quotation_content"

    if order.status == PurchaseStatus.PROCESSING and request.target_status == PurchaseStatus.CLOSED:
        if not order.has_purchase_evidence:
            return False, "缺少采购下单证据，不能关闭", "missing_purchase_evidence"
        if not order.has_arrival_evidence:
            return False, "缺少到货验收证据，不能关闭", "missing_arrival_evidence"
        if not order.purchase_order_content or len(order.purchase_order_content.strip()) < 10:
            return False, "采购下单内容不完整，请补正", "missing_purchase_content"
        if not order.arrival_verification or len(order.arrival_verification.strip()) < 10:
            return False, "到货验收内容不完整，请补正", "missing_arrival_content"

    if request.target_status == PurchaseStatus.CLOSED:
        now = datetime.utcnow()
        if now > order.deadline and not order.is_overdue:
            return False, f"已超过截止时间 {order.deadline.strftime('%Y-%m-%d %H:%M')}，请先处理逾期标记", "deadline_overdue"

    return True, "校验通过", ""


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
        User.is_active == True,
        (User.store == current_store) | (User.store == None)
    ).first()
    if handler:
        return handler.id
    fallback = db.query(User).filter(
        User.role == required_role,
        User.is_active == True
    ).first()
    return fallback.id if fallback else None


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
    evidence_checked: Optional[str] = None,
    exception_type: Optional[str] = None,
) -> ProcessingRecord:
    if exception_type and exception_type in EXCEPTION_TYPES:
        exception_label = EXCEPTION_TYPES[exception_type]
    else:
        exception_label = exception_type
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
        exception_reason=exception_reason or exception_label,
        evidence_checked=evidence_checked,
        timestamp=datetime.utcnow()
    )
    db.add(record)
    return record


def add_audit_note_for_exception(
    db: Session,
    order: FreshPurchaseOrder,
    user: User,
    exception_type: str,
    note: str,
) -> AuditNote:
    note_type = EXCEPTION_TYPE_TO_AUDIT_NOTE_TYPE.get(exception_type, "异常标记")
    audit = AuditNote(
        order_id=order.id,
        note=note,
        note_type=note_type,
        author_id=user.id,
        author_name=user.full_name,
        author_role=user.role.value,
    )
    db.add(audit)
    return audit


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
                "current_status": None,
                "exception_type": "state_conflict",
            })
            continue

        expected_version = None
        if request.expected_versions:
            expected_version = request.expected_versions.get(str(order_id))

        if order.status == PurchaseStatus.CLOSED:
            add_processing_record(
                db=db, order=order, user=user,
                action=f"批量-{request.action}",
                from_status=order.status.value,
                to_status=request.target_status.value if request.target_status else None,
                result="failed",
                comment="单据已关闭，不能批量处理",
                exception_reason="单据已关闭，不能批量处理",
                exception_type="already_closed",
            )
            results.append({
                "order_id": order.id,
                "order_no": order.order_no,
                "success": False,
                "message": "单据已关闭，不能批量处理",
                "current_status": order.status,
                "exception_type": "already_closed",
            })
            continue

        if not can_view_order(user, order):
            add_processing_record(
                db=db, order=order, user=user,
                action=f"批量-{request.action}",
                from_status=order.status.value,
                to_status=request.target_status.value if request.target_status else None,
                result="failed",
                comment="无权访问此单据",
                exception_reason="无权访问此单据",
                exception_type="role_denied",
            )
            results.append({
                "order_id": order.id,
                "order_no": order.order_no,
                "success": False,
                "message": "无权访问此单据",
                "current_status": order.status,
                "exception_type": "role_denied",
            })
            continue

        if request.target_status and request.target_status != order.status:
            if not check_role_permission(user.role, order.status, request.target_status):
                msg = f"无权限从 {order.status.value} 变更到 {request.target_status.value}"
                add_processing_record(
                    db=db, order=order, user=user,
                    action=f"批量-{request.action}",
                    from_status=order.status.value,
                    to_status=request.target_status.value,
                    result="failed",
                    comment=msg,
                    exception_reason=msg,
                    exception_type="role_denied",
                )
                results.append({
                    "order_id": order.id,
                    "order_no": order.order_no,
                    "success": False,
                    "message": msg,
                    "current_status": order.status,
                    "exception_type": "role_denied",
                })
                continue

            if expected_version is not None and expected_version != order.version:
                msg = f"版本冲突：期望版本 {expected_version}，当前版本 {order.version}"
                add_processing_record(
                    db=db, order=order, user=user,
                    action=f"批量-{request.action}",
                    from_status=order.status.value,
                    to_status=request.target_status.value,
                    result="failed",
                    comment=msg,
                    exception_reason=msg,
                    exception_type="version_conflict",
                )
                add_audit_note_for_exception(
                    db=db, order=order, user=user,
                    exception_type="version_conflict",
                    note=msg,
                )
                results.append({
                    "order_id": order.id,
                    "order_no": order.order_no,
                    "success": False,
                    "message": msg,
                    "current_status": order.status,
                    "exception_type": "version_conflict",
                })
                continue

            handler_ok, handler_msg = check_current_handler(user, order)
            if not handler_ok:
                add_processing_record(
                    db=db, order=order, user=user,
                    action=f"批量-{request.action}",
                    from_status=order.status.value,
                    to_status=request.target_status.value,
                    result="failed",
                    comment=handler_msg,
                    exception_reason=handler_msg,
                    exception_type="handler_mismatch",
                )
                results.append({
                    "order_id": order.id,
                    "order_no": order.order_no,
                    "success": False,
                    "message": handler_msg,
                    "current_status": order.status,
                    "exception_type": "handler_mismatch",
                })
                continue

            if order.status == PurchaseStatus.PENDING_DISPATCH and request.target_status == PurchaseStatus.PROCESSING:
                if not order.has_quotation_evidence:
                    msg = "缺少供应商报价材料证据"
                    add_processing_record(
                        db=db, order=order, user=user,
                        action=f"批量-{request.action}",
                        from_status=order.status.value,
                        to_status=request.target_status.value,
                        result="failed",
                        comment=msg,
                        exception_reason=msg,
                        exception_type="missing_quotation_evidence",
                    )
                    add_audit_note_for_exception(
                        db=db, order=order, user=user,
                        exception_type="missing_quotation_evidence",
                        note=msg,
                    )
                    results.append({
                        "order_id": order.id,
                        "order_no": order.order_no,
                        "success": False,
                        "message": msg,
                        "current_status": order.status,
                        "exception_type": "missing_quotation_evidence",
                    })
                    continue

            if order.status == PurchaseStatus.PROCESSING and request.target_status == PurchaseStatus.CLOSED:
                if not order.has_purchase_evidence or not order.has_arrival_evidence:
                    missing = []
                    if not order.has_purchase_evidence:
                        missing.append("采购下单证据")
                    if not order.has_arrival_evidence:
                        missing.append("到货验收证据")
                    msg = f"缺少：{'、'.join(missing)}"
                    add_processing_record(
                        db=db, order=order, user=user,
                        action=f"批量-{request.action}",
                        from_status=order.status.value,
                        to_status=request.target_status.value,
                        result="failed",
                        comment=msg,
                        exception_reason=msg,
                        exception_type="missing_purchase_evidence" if not order.has_purchase_evidence else "missing_arrival_evidence",
                    )
                    add_audit_note_for_exception(
                        db=db, order=order, user=user,
                        exception_type="missing_purchase_evidence" if not order.has_purchase_evidence else "missing_arrival_evidence",
                        note=msg,
                    )
                    results.append({
                        "order_id": order.id,
                        "order_no": order.order_no,
                        "success": False,
                        "message": msg,
                        "current_status": order.status,
                        "exception_type": "missing_purchase_evidence" if not order.has_purchase_evidence else "missing_arrival_evidence",
                    })
                    continue

            if request.target_status == PurchaseStatus.CLOSED:
                now = datetime.utcnow()
                if now > order.deadline and not order.is_overdue:
                    msg = f"已超过截止时间 {order.deadline.strftime('%Y-%m-%d %H:%M')}"
                    add_processing_record(
                        db=db, order=order, user=user,
                        action=f"批量-{request.action}",
                        from_status=order.status.value,
                        to_status=request.target_status.value,
                        result="failed",
                        comment=msg,
                        exception_reason=msg,
                        exception_type="deadline_overdue",
                    )
                    add_audit_note_for_exception(
                        db=db, order=order, user=user,
                        exception_type="deadline_overdue",
                        note=msg,
                    )
                    results.append({
                        "order_id": order.id,
                        "order_no": order.order_no,
                        "success": False,
                        "message": msg,
                        "current_status": order.status,
                        "exception_type": "deadline_overdue",
                    })
                    continue

        results.append({
            "order_id": order.id,
            "order_no": order.order_no,
            "success": True,
            "message": "校验通过，待执行",
            "current_status": order.status,
            "exception_type": "",
        })
    return results

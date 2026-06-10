from datetime import datetime
from typing import Optional
from litestar import Router, get, post, put, delete
from litestar.connection import ASGIConnection
from litestar.exceptions import NotAuthorizedException, NotFoundException, ValidationException
from litestar.params import Parameter
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    User, UserRole, FreshPurchaseOrder, PurchaseStatus,
    PriorityLevel, WarningLevel, ProcessingRecord, AuditNote,
    Attachment
)
from ..schemas import (
    FreshPurchaseOrderCreate, FreshPurchaseOrderUpdate, FreshPurchaseOrderOut,
    FreshPurchaseOrderListResponse, StatusTransitionRequest, BatchActionRequest,
    BatchActionResult, PurchaseOrderStats, ProcessingRecordOut, AuditNoteCreate,
    AuditNoteOut
)
from ..permissions import (
    can_view_order, can_edit_order, validate_status_transition,
    update_warning_level, determine_next_handler_id, add_processing_record,
    validate_batch_action, check_role_permission, add_audit_note_for_exception,
    check_current_handler,
)


def build_visible_query(db: Session, user: User):
    query = db.query(FreshPurchaseOrder)
    if user.role == UserRole.REGISTRAR:
        query = query.filter(
            or_(
                FreshPurchaseOrder.creator_id == user.id,
                FreshPurchaseOrder.current_handler_id == user.id,
                and_(
                    FreshPurchaseOrder.store == user.store,
                    FreshPurchaseOrder.status == PurchaseStatus.PENDING_DISPATCH
                )
            )
        )
    elif user.role == UserRole.SUPERVISOR:
        query = query.filter(FreshPurchaseOrder.store == user.store)
    return query


def refresh_warning_for_visible(db: Session, user: User) -> None:
    query = build_visible_query(db, user)
    visible_orders = query.filter(
        FreshPurchaseOrder.status != PurchaseStatus.CLOSED
    ).all()
    for o in visible_orders:
        update_warning_level(o)
    if visible_orders:
        db.commit()


def generate_order_no(db: Session) -> str:
    now = datetime.utcnow()
    prefix = f"FPO-{now.year}-"
    last_order = db.query(FreshPurchaseOrder).filter(
        FreshPurchaseOrder.order_no.like(f"{prefix}%")
    ).order_by(FreshPurchaseOrder.id.desc()).first()
    if last_order:
        last_num = int(last_order.order_no.split("-")[-1])
        new_num = str(last_num + 1).zfill(4)
    else:
        new_num = "0001"
    return f"{prefix}{new_num}"


@get("/")
async def list_orders(
    connection: ASGIConnection,
    status: Optional[PurchaseStatus] = Parameter(default=None),
    priority: Optional[PriorityLevel] = Parameter(default=None),
    warning_level: Optional[WarningLevel] = Parameter(default=None),
    has_exception: Optional[bool] = Parameter(default=None),
    store: Optional[str] = Parameter(default=None),
    keyword: Optional[str] = Parameter(default=None),
    only_mine: Optional[bool] = Parameter(default=False),
    page: int = Parameter(default=1, ge=1),
    page_size: int = Parameter(default=20, ge=1, le=100)
) -> FreshPurchaseOrderListResponse:
    user: User = connection.user
    db: Session = next(get_db())
    try:
        refresh_warning_for_visible(db, user)
        db.expire_all()

        query = build_visible_query(db, user)

        if user.role == UserRole.REGISTRAR and only_mine:
            query = query.filter(
                or_(
                    FreshPurchaseOrder.creator_id == user.id,
                    FreshPurchaseOrder.current_handler_id == user.id
                )
            )
        elif user.role == UserRole.SUPERVISOR and only_mine:
            query = query.filter(
                or_(
                    FreshPurchaseOrder.current_handler_id == user.id,
                    and_(
                        FreshPurchaseOrder.store == user.store,
                        FreshPurchaseOrder.status == PurchaseStatus.PROCESSING
                    )
                )
            )

        if status:
            query = query.filter(FreshPurchaseOrder.status == status)
        if priority:
            query = query.filter(FreshPurchaseOrder.priority == priority)
        if warning_level:
            query = query.filter(FreshPurchaseOrder.warning_level == warning_level)
        if has_exception is not None:
            query = query.filter(FreshPurchaseOrder.has_exception == has_exception)
        if store:
            query = query.filter(FreshPurchaseOrder.store == store)
        if keyword:
            like_pattern = f"%{keyword}%"
            query = query.filter(
                or_(
                    FreshPurchaseOrder.order_no.like(like_pattern),
                    FreshPurchaseOrder.title.like(like_pattern),
                    FreshPurchaseOrder.supplier_name.like(like_pattern)
                )
            )

        total = query.count()

        query = query.order_by(
            FreshPurchaseOrder.is_overdue.desc(),
            FreshPurchaseOrder.priority.desc(),
            FreshPurchaseOrder.updated_at.desc()
        )
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)

        orders = query.all()

        warning_query = build_visible_query(db, user)
        warning_counts = {
            WarningLevel.NORMAL.value: warning_query.filter(FreshPurchaseOrder.warning_level == WarningLevel.NORMAL).count(),
            WarningLevel.APPROACHING.value: warning_query.filter(FreshPurchaseOrder.warning_level == WarningLevel.APPROACHING).count(),
            WarningLevel.OVERDUE.value: warning_query.filter(FreshPurchaseOrder.warning_level == WarningLevel.OVERDUE).count(),
        }

        return FreshPurchaseOrderListResponse(
            total=total,
            items=[FreshPurchaseOrderOut.model_validate(o) for o in orders],
            warning_counts=warning_counts
        )
    finally:
        db.close()


@get("/stats")
async def get_stats(connection: ASGIConnection) -> PurchaseOrderStats:
    user: User = connection.user
    db: Session = next(get_db())
    try:
        refresh_warning_for_visible(db, user)
        db.expire_all()
        query = build_visible_query(db, user)

        return PurchaseOrderStats(
            total=query.count(),
            pending_dispatch=query.filter(FreshPurchaseOrder.status == PurchaseStatus.PENDING_DISPATCH).count(),
            processing=query.filter(FreshPurchaseOrder.status == PurchaseStatus.PROCESSING).count(),
            closed=query.filter(FreshPurchaseOrder.status == PurchaseStatus.CLOSED).count(),
            overdue=query.filter(FreshPurchaseOrder.is_overdue == True).count(),
            exception=query.filter(FreshPurchaseOrder.has_exception == True).count(),
            approaching_deadline=query.filter(FreshPurchaseOrder.warning_level == WarningLevel.APPROACHING).count()
        )
    finally:
        db.close()


@get("/{order_id:int}")
async def get_order(connection: ASGIConnection, order_id: int) -> FreshPurchaseOrderOut:
    user: User = connection.user
    db: Session = next(get_db())
    try:
        refresh_warning_for_visible(db, user)
        db.expire_all()

        order = db.query(FreshPurchaseOrder).filter(FreshPurchaseOrder.id == order_id).first()
        if not order:
            raise NotFoundException("生鲜采购单不存在")
        if not can_view_order(user, order):
            raise NotAuthorizedException("无权查看此单据")

        db.refresh(order)
        return FreshPurchaseOrderOut.model_validate(order)
    finally:
        db.close()


@post("/")
async def create_order(connection: ASGIConnection, data: FreshPurchaseOrderCreate) -> FreshPurchaseOrderOut:
    user: User = connection.user
    db: Session = next(get_db())
    try:
        if user.role not in [UserRole.REGISTRAR, UserRole.REVIEWER]:
            raise NotAuthorizedException("只有生鲜采购登记员或复核负责人才可以建单")

        order_no = generate_order_no(db)
        order = FreshPurchaseOrder(
            order_no=order_no,
            **data.model_dump(),
            creator_id=user.id,
            current_handler_id=user.id,
            version=1
        )
        update_warning_level(order)
        db.add(order)
        db.flush()

        add_processing_record(
            db=db,
            order=order,
            user=user,
            action="建单",
            from_status=None,
            to_status=PurchaseStatus.PENDING_DISPATCH.value,
            result="success",
            comment=f"{user.full_name} 创建了生鲜采购单"
        )

        audit = AuditNote(
            order_id=order.id,
            note=f"采购单由 {user.full_name} 创建，初始状态：待派发",
            note_type="系统记录",
            author_id=user.id,
            author_name=user.full_name,
            author_role=user.role.value
        )
        db.add(audit)
        db.commit()
        db.refresh(order)

        return FreshPurchaseOrderOut.model_validate(order)
    finally:
        db.close()


@put("/{order_id:int}")
async def update_order(
    connection: ASGIConnection,
    order_id: int,
    data: FreshPurchaseOrderUpdate
) -> FreshPurchaseOrderOut:
    user: User = connection.user
    db: Session = next(get_db())
    try:
        order = db.query(FreshPurchaseOrder).filter(FreshPurchaseOrder.id == order_id).first()
        if not order:
            raise NotFoundException("生鲜采购单不存在")
        if not can_edit_order(user, order):
            raise NotAuthorizedException("无权编辑此单据或单据已关闭")

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(order, key, value)

        order.version += 1
        update_warning_level(order)

        add_processing_record(
            db=db,
            order=order,
            user=user,
            action="编辑补正",
            from_status=order.status.value,
            to_status=order.status.value,
            result="success",
            comment=f"更新了字段: {', '.join(update_data.keys())}"
        )

        db.commit()
        db.refresh(order)
        return FreshPurchaseOrderOut.model_validate(order)
    finally:
        db.close()


@post("/{order_id:int}/transition")
async def transition_status(
    connection: ASGIConnection,
    order_id: int,
    data: StatusTransitionRequest
) -> FreshPurchaseOrderOut:
    user: User = connection.user
    db: Session = next(get_db())
    try:
        order = db.query(FreshPurchaseOrder).filter(FreshPurchaseOrder.id == order_id).first()
        if not order:
            raise NotFoundException("生鲜采购单不存在")
        if not can_view_order(user, order):
            raise NotAuthorizedException("无权操作此单据")

        is_valid, message, exception_type = validate_status_transition(db, order, user, data)
        if not is_valid:
            add_processing_record(
                db=db,
                order=order,
                user=user,
                action=data.action,
                from_status=order.status.value,
                to_status=data.target_status.value,
                result="failed",
                comment=message,
                exception_reason=message,
                exception_type=exception_type,
            )
            add_audit_note_for_exception(
                db=db,
                order=order,
                user=user,
                exception_type=exception_type,
                note=message,
            )
            db.commit()
            raise ValidationException(message)

        old_status = order.status.value
        order.status = data.target_status
        order.version += 1

        evidence_list = []
        if order.has_quotation_evidence:
            evidence_list.append("供应商报价单")
        if order.has_purchase_evidence:
            evidence_list.append("采购下单凭证")
        if order.has_arrival_evidence:
            evidence_list.append("到货验收单")

        if data.target_status == PurchaseStatus.CLOSED:
            order.closed_at = datetime.utcnow()
            order.current_handler_id = None
            order.has_exception = False
            order.exception_reason = None
            order.warning_level = WarningLevel.NORMAL
            order.is_overdue = False
        elif data.target_status == PurchaseStatus.PROCESSING:
            next_handler = determine_next_handler_id(db, data.target_status, order.store)
            order.current_handler_id = next_handler
        elif data.target_status == PurchaseStatus.PENDING_DISPATCH:
            order.current_handler_id = order.creator_id
            if data.comment:
                order.has_exception = True
                order.exception_reason = data.comment

        update_warning_level(order)

        add_processing_record(
            db=db,
            order=order,
            user=user,
            action=data.action,
            from_status=old_status,
            to_status=data.target_status.value,
            result="success",
            comment=data.comment,
            evidence_checked="、".join(evidence_list) if evidence_list else None
        )

        if data.audit_note:
            audit = AuditNote(
                order_id=order.id,
                note=data.audit_note,
                note_type="人工备注",
                author_id=user.id,
                author_name=user.full_name,
                author_role=user.role.value
            )
            db.add(audit)

        db.commit()
        db.refresh(order)
        return FreshPurchaseOrderOut.model_validate(order)
    finally:
        db.close()


@post("/batch")
async def batch_action(
    connection: ASGIConnection,
    data: BatchActionRequest
) -> list[BatchActionResult]:
    user: User = connection.user
    db: Session = next(get_db())
    try:
        validations = validate_batch_action(db, user, data)
        results: list[BatchActionResult] = []

        for validation in validations:
            if not validation["success"]:
                results.append(BatchActionResult(**validation))
                continue

            order = db.query(FreshPurchaseOrder).filter(
                FreshPurchaseOrder.id == validation["order_id"]
            ).first()
            if not order:
                results.append(BatchActionResult(
                    order_id=validation["order_id"],
                    order_no=validation["order_no"],
                    success=False,
                    message="单据不存在",
                    exception_type=validation.get("exception_type") or "state_conflict",
                ))
                continue

            try:
                if data.target_status and data.target_status != order.status:
                    old_status = order.status.value
                    order.status = data.target_status
                    order.version += 1

                    if data.target_status == PurchaseStatus.CLOSED:
                        order.closed_at = datetime.utcnow()
                        order.current_handler_id = None
                        order.has_exception = False
                        order.warning_level = WarningLevel.NORMAL
                        order.is_overdue = False
                    elif data.target_status == PurchaseStatus.PROCESSING:
                        next_handler = determine_next_handler_id(db, data.target_status, order.store)
                        order.current_handler_id = next_handler
                    elif data.target_status == PurchaseStatus.PENDING_DISPATCH:
                        order.current_handler_id = order.creator_id

                    update_warning_level(order)

                    add_processing_record(
                        db=db,
                        order=order,
                        user=user,
                        action=f"批量-{data.action}",
                        from_status=old_status,
                        to_status=data.target_status.value,
                        result="success",
                        comment=data.comment
                    )

                    audit = AuditNote(
                        order_id=order.id,
                        note=data.comment or f"批量操作：{data.action}，状态由 {old_status} 变更为 {data.target_status.value}",
                        note_type="批量处理",
                        author_id=user.id,
                        author_name=user.full_name,
                        author_role=user.role.value,
                    )
                    db.add(audit)

                results.append(BatchActionResult(
                    order_id=order.id,
                    order_no=order.order_no,
                    success=True,
                    message="批量操作成功",
                    current_status=order.status,
                    exception_type=validation.get("exception_type") or None,
                ))
            except Exception as e:
                results.append(BatchActionResult(
                    order_id=order.id,
                    order_no=order.order_no,
                    success=False,
                    message=f"处理失败: {str(e)}",
                    current_status=order.status,
                    exception_type="state_conflict",
                ))

        db.commit()
        return results
    finally:
        db.close()


@get("/{order_id:int}/records")
async def list_processing_records(
    connection: ASGIConnection,
    order_id: int
) -> list[ProcessingRecordOut]:
    user: User = connection.user
    db: Session = next(get_db())
    try:
        order = db.query(FreshPurchaseOrder).filter(FreshPurchaseOrder.id == order_id).first()
        if not order:
            raise NotFoundException("生鲜采购单不存在")
        if not can_view_order(user, order):
            raise NotAuthorizedException("无权查看此单据")

        records = db.query(ProcessingRecord).filter(
            ProcessingRecord.order_id == order_id
        ).order_by(ProcessingRecord.timestamp.desc()).all()

        return [ProcessingRecordOut.model_validate(r) for r in records]
    finally:
        db.close()


@post("/{order_id:int}/audit-notes")
async def add_audit_note(
    connection: ASGIConnection,
    order_id: int,
    data: AuditNoteCreate
) -> AuditNoteOut:
    user: User = connection.user
    db: Session = next(get_db())
    try:
        order = db.query(FreshPurchaseOrder).filter(FreshPurchaseOrder.id == order_id).first()
        if not order:
            raise NotFoundException("生鲜采购单不存在")
        if not can_view_order(user, order):
            raise NotAuthorizedException("无权操作此单据")

        audit = AuditNote(
            order_id=order.id,
            note=data.note,
            note_type=data.note_type or "人工备注",
            author_id=user.id,
            author_name=user.full_name,
            author_role=user.role.value
        )
        db.add(audit)
        db.commit()
        db.refresh(audit)

        return AuditNoteOut.model_validate(audit)
    finally:
        db.close()


orders_router = Router(
    path="/orders",
    route_handlers=[
        list_orders,
        get_stats,
        get_order,
        create_order,
        update_order,
        transition_status,
        batch_action,
        list_processing_records,
        add_audit_note
    ]
)

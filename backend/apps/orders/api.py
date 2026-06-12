import os
import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from pathlib import Path
from urllib.parse import unquote

from django.http import HttpRequest
from django.db import transaction, models
from django.utils import timezone
from django.conf import settings

from ninja import NinjaAPI, File, UploadedFile as NinjaUploadedFile, Query
from ninja.errors import HttpError

from .models import (
    ForeignTradeOrder, OrderAttachment, ProcessingRecord, AuditNote, ExceptionReason,
    Role, OrderStatus, OrderStage, Priority, WarningLevel, ProcessingAction
)
from .schemas import (
    OrderCreate, OrderUpdate, ProcessAction,
    BatchProcessRequest, BatchProcessResponse, BatchProcessResult,
    OrderDetail, OrderListItem, OrderListResponse,
    AttachmentInfo, ProcessingRecordInfo, AuditNoteInfo, ExceptionReasonInfo,
    AuditNoteCreate, ExceptionReasonCreate
)


api = NinjaAPI(title='外贸订单系统 API', version='1.0.0')


def _get_role(request: HttpRequest) -> str:
    role = request.headers.get('X-User-Role', '')
    if role not in [Role.CLERK, Role.SUPERVISOR, Role.REVIEWER]:
        raise HttpError(401, '无效的角色，请先选择角色')
    return role


def _get_username(request: HttpRequest) -> str:
    name = request.headers.get('X-User-Name', '未知用户')
    try:
        return unquote(name)
    except Exception:
        return name


def _get_role_display(role: str) -> str:
    mapping = {
        Role.CLERK: '外贸登记员',
        Role.SUPERVISOR: '外贸审核主管',
        Role.REVIEWER: '外贸公司复核负责人',
    }
    return mapping.get(role, role)


def _role_to_queue_stage(role: str) -> str:
    mapping = {
        Role.CLERK: OrderStage.INQUIRY,
        Role.SUPERVISOR: OrderStage.QUOTE_CONFIRMATION,
        Role.REVIEWER: OrderStage.ORDER_SIGNING,
    }
    return mapping.get(role, OrderStage.INQUIRY)


def _stage_to_role(stage: str) -> str:
    mapping = {
        OrderStage.INQUIRY: Role.CLERK,
        OrderStage.QUOTE_CONFIRMATION: Role.SUPERVISOR,
        OrderStage.ORDER_SIGNING: Role.REVIEWER,
    }
    return mapping.get(stage, Role.CLERK)


def _generate_order_no() -> str:
    date_str = timezone.now().strftime('%Y%m%d')
    seq = ForeignTradeOrder.objects.filter(order_no__startswith=f'FT{date_str}').count() + 1
    return f'FT{date_str}{seq:04d}'


def _order_to_detail(order: ForeignTradeOrder, role: str) -> OrderDetail:
    warning_level = order.get_warning_level()
    can_process = order.can_process(role)

    attachments = [
        AttachmentInfo(
            id=a.id, file_name=a.file_name, file_path=a.file_path,
            file_type=a.file_type, file_size=a.file_size,
            uploaded_by=a.uploaded_by, uploaded_by_role=a.uploaded_by_role,
            upload_time=a.upload_time, description=a.description, stage=a.stage,
        ) for a in order.attachments.all()
    ]
    processing_records = [
        ProcessingRecordInfo(
            id=r.id, action=r.action, action_display=r.get_action_display(),
            operator=r.operator, operator_role=r.operator_role,
            operate_time=r.operate_time,
            from_status=r.from_status, to_status=r.to_status,
            from_stage=r.from_stage, to_stage=r.to_stage,
            comment=r.comment,
            evidence_required=r.evidence_required,
            evidence_provided=r.evidence_provided,
            version_before=r.version_before, version_after=r.version_after,
        ) for r in order.processing_records.all()
    ]
    audit_notes = [
        AuditNoteInfo(
            id=n.id, note=n.note, noted_by=n.noted_by,
            noted_by_role=n.noted_by_role, note_time=n.note_time,
        ) for n in order.audit_notes.all()
    ]
    exception_reasons = [
        ExceptionReasonInfo(
            id=e.id, reason_type=e.reason_type, reason_detail=e.reason_detail,
            corrective_action=e.corrective_action, recorded_by=e.recorded_by,
            recorded_by_role=e.recorded_by_role, record_time=e.record_time,
            resolved=e.resolved, resolve_time=e.resolve_time,
        ) for e in order.exception_reasons.all()
    ]

    return OrderDetail(
        id=order.id, order_no=order.order_no,
        customer_name=order.customer_name, product_name=order.product_name,
        quantity=float(order.quantity), amount=float(order.amount),
        country=order.country,
        inquiry_content=order.inquiry_content,
        quote_content=order.quote_content,
        order_content=order.order_content,
        quote_confirmed=order.quote_confirmed,
        order_signed=order.order_signed,
        status=order.status, status_display=order.get_status_display(),
        stage=order.stage, stage_display=order.get_stage_display(),
        priority=order.priority, priority_display=order.get_priority_display(),
        responsible_person=order.responsible_person,
        current_handler=order.current_handler,
        current_handler_role=order.current_handler_role,
        create_time=order.create_time, update_time=order.update_time,
        due_time=order.due_time, version=order.version,
        is_exception=order.is_exception,
        exception_tags=list(order.exception_tags or []),
        result=order.result, return_reason=order.return_reason,
        warning_level=warning_level,
        warning_level_display={
            WarningLevel.NORMAL: '正常',
            WarningLevel.APPROACHING: '临期',
            WarningLevel.OVERDUE: '逾期',
        }.get(warning_level, '正常'),
        can_process=can_process,
        attachments=attachments,
        processing_records=processing_records,
        audit_notes=audit_notes,
        exception_reasons=exception_reasons,
    )


def _order_to_list_item(order: ForeignTradeOrder, role: str | None = None) -> OrderListItem:
    warning_level = order.get_warning_level()
    can_process = order.can_process(role) if role else False
    return OrderListItem(
        id=order.id, order_no=order.order_no,
        customer_name=order.customer_name, product_name=order.product_name,
        amount=float(order.amount),
        status=order.status, status_display=order.get_status_display(),
        stage=order.stage, stage_display=order.get_stage_display(),
        priority=order.priority, priority_display=order.get_priority_display(),
        responsible_person=order.responsible_person,
        current_handler=order.current_handler,
        current_handler_role=order.current_handler_role,
        create_time=order.create_time,
        update_time=order.update_time,
        due_time=order.due_time,
        is_exception=order.is_exception,
        exception_tags=list(order.exception_tags or []),
        warning_level=warning_level,
        warning_level_display={
            WarningLevel.NORMAL: '正常',
            WarningLevel.APPROACHING: '临期',
            WarningLevel.OVERDUE: '逾期',
        }.get(warning_level, '正常'),
        can_process=can_process,
    )


def _validate_quote_and_order_complete(order: ForeignTradeOrder) -> tuple[bool, list]:
    missing = []
    if not order.quote_confirmed or not order.quote_content.strip():
        missing.append('报价确认信息不完整')
    if not order.order_signed or not order.order_content.strip():
        missing.append('订单签订信息不完整')
    return len(missing) == 0, missing


def _check_overdue(order: ForeignTradeOrder) -> bool:
    return order.get_warning_level() == WarningLevel.OVERDUE


def _validate_role_access_order(role: str, order: ForeignTradeOrder) -> bool:
    if role == Role.CLERK:
        return order.stage in [OrderStage.INQUIRY, OrderStage.QUOTE_CONFIRMATION]
    elif role == Role.SUPERVISOR:
        return order.stage in [OrderStage.INQUIRY, OrderStage.QUOTE_CONFIRMATION, OrderStage.ORDER_SIGNING]
    elif role == Role.REVIEWER:
        return order.stage in [OrderStage.QUOTE_CONFIRMATION, OrderStage.ORDER_SIGNING, OrderStage.ARCHIVED]
    return False


def _validate_can_update(role: str, order: ForeignTradeOrder) -> tuple[bool, str]:
    if order.status == OrderStatus.CLOSED:
        return False, '已关闭订单不能修改'
    if role != order.current_handler_role and order.status == OrderStatus.PROCESSING:
        return False, f'当前节点需由{_get_role_display(order.current_handler_role)}修改'
    return True, ''


def _validate_can_process(role: str, order: ForeignTradeOrder, action: str, evidence_provided: bool) -> tuple[bool, str, bool]:
    evidence_required = False

    if order.status == OrderStatus.CLOSED:
        return False, '已关闭订单不能操作', evidence_required

    if order.version is None:
        pass

    if _check_overdue(order) and action in [ProcessingAction.PROCESS, ProcessingAction.REVIEW, ProcessingAction.CLOSE]:
        return False, '订单已逾期，请先处理逾期异常或补正后再推进', evidence_required

    if action == ProcessingAction.SUBMIT:
        if role != Role.CLERK:
            return False, '只有外贸登记员才能提交', evidence_required
        if order.stage != OrderStage.INQUIRY:
            return False, f'当前阶段为{order.get_stage_display()}，不能提交', evidence_required
        if not order.inquiry_content.strip():
            return False, '客户询盘内容不能为空', evidence_required

    elif action == ProcessingAction.DISPATCH:
        if role not in [Role.CLERK, Role.SUPERVISOR]:
            return False, '无派发权限', evidence_required

    elif action == ProcessingAction.PROCESS:
        if role != order.current_handler_role:
            return False, f'当前节点需由{_get_role_display(order.current_handler_role)}办理', evidence_required
        evidence_required = True
        if not evidence_provided:
            return False, '办理必须上传证据附件', evidence_required
        if order.stage == OrderStage.QUOTE_CONFIRMATION:
            if not order.quote_confirmed or not order.quote_content.strip():
                return False, '报价确认信息不完整，订单停留在原队列', evidence_required
        elif order.stage == OrderStage.ORDER_SIGNING:
            complete, missing = _validate_quote_and_order_complete(order)
            if not complete:
                return False, '报价确认、订单签订信息不齐，订单停留在原队列：' + '；'.join(missing), evidence_required

    elif action == ProcessingAction.REVIEW:
        if role != Role.REVIEWER:
            return False, '只有复核负责人才能复核', evidence_required
        evidence_required = True
        if not evidence_provided:
            return False, '复核必须上传证据', evidence_required
        complete, missing = _validate_quote_and_order_complete(order)
        if not complete:
            return False, '报价确认、订单签订信息不齐：' + '；'.join(missing), evidence_required

    elif action == ProcessingAction.RETURN:
        if role not in [Role.SUPERVISOR, Role.REVIEWER]:
            return False, '只有审核主管或复核负责人才能退回', evidence_required
        if order.stage == OrderStage.INQUIRY:
            return False, '客户询盘阶段不能退回', evidence_required

    elif action == ProcessingAction.CORRECT:
        if role != order.current_handler_role:
            return False, '只有当前处理人才能补正', evidence_required

    elif action == ProcessingAction.CLOSE:
        if role != Role.REVIEWER:
            return False, '只有复核负责人才能关闭归档', evidence_required
        evidence_required = True
        if not evidence_provided:
            return False, '关闭归档必须上传证据', evidence_required
        complete, missing = _validate_quote_and_order_complete(order)
        if not complete:
            return False, '报价确认、订单签订信息不齐：' + '；'.join(missing), evidence_required

    return True, '', evidence_required


def _record_exception(order: ForeignTradeOrder, reason_type: str, reason_detail: str,
                      username: str, role: str, corrective_action: str = ''):
    exc = ExceptionReason.objects.create(
        order=order,
        reason_type=reason_type,
        reason_detail=reason_detail,
        corrective_action=corrective_action,
        recorded_by=username,
        recorded_by_role=role,
    )
    order.is_exception = True
    tags = list(order.exception_tags or [])
    if reason_type not in tags:
        tags.append(reason_type)
    order.exception_tags = tags
    return exc


def _resolve_all_exceptions(order: ForeignTradeOrder, username: str, role: str, comment: str = ''):
    now = timezone.now()
    updated = ExceptionReason.objects.filter(
        order=order, resolved=False
    ).update(
        resolved=True,
        resolve_time=now,
    )
    order.is_exception = False
    order.exception_tags = []
    return updated


def _validate_handler_match(username: str, order: ForeignTradeOrder) -> tuple[bool, str]:
    if order.status == OrderStatus.CLOSED:
        return True, ''
    if order.status == OrderStatus.PENDING_DISPATCH:
        return True, ''
    if order.current_handler and order.current_handler.strip():
        if username != order.current_handler:
            return False, f'当前订单由值班人「{order.current_handler}」办理，请联系该人员或重新派发'
    return True, ''


def _validate_dispatch_role(dispatch_to_role: str, from_role: str, order: ForeignTradeOrder) -> tuple[bool, str]:
    if not dispatch_to_role:
        return False, '请指定派发目标角色'
    valid_roles = {Role.CLERK, Role.SUPERVISOR, Role.REVIEWER}
    if dispatch_to_role not in valid_roles:
        return False, f'派发目标角色不合法，只能是 {valid_roles} 之一'
    allowed_map = {
        (Role.CLERK, OrderStage.INQUIRY): {Role.CLERK, Role.SUPERVISOR},
        (Role.CLERK, OrderStage.QUOTE_CONFIRMATION): {Role.SUPERVISOR},
        (Role.SUPERVISOR, OrderStage.QUOTE_CONFIRMATION): {Role.SUPERVISOR, Role.REVIEWER, Role.CLERK},
        (Role.SUPERVISOR, OrderStage.ORDER_SIGNING): {Role.REVIEWER, Role.SUPERVISOR, Role.CLERK},
        (Role.REVIEWER, OrderStage.ORDER_SIGNING): {Role.REVIEWER, Role.SUPERVISOR},
        (Role.REVIEWER, OrderStage.ARCHIVED): {Role.REVIEWER, Role.SUPERVISOR},
    }
    allowed = allowed_map.get((from_role, order.stage))
    if allowed and dispatch_to_role not in allowed:
        return False, f'{_get_role_display(from_role)}不能从{order.get_stage_display()}派发到{_get_role_display(dispatch_to_role)}'
    return True, ''


def _record_audit_note(order: ForeignTradeOrder, note: str, username: str, role: str):
    return AuditNote.objects.create(
        order=order, note=note, noted_by=username, noted_by_role=role,
    )


@api.get('/roles')
def list_roles(request):
    return [
        {'code': Role.CLERK, 'name': '外贸登记员'},
        {'code': Role.SUPERVISOR, 'name': '外贸审核主管'},
        {'code': Role.REVIEWER, 'name': '外贸公司复核负责人'},
    ]


@api.get('/statuses')
def list_statuses(request):
    return [
        {'code': s[0], 'name': s[1]} for s in OrderStatus.choices
    ]


@api.get('/stages')
def list_stages(request):
    return [
        {'code': s[0], 'name': s[1]} for s in OrderStage.choices
    ]


@api.get('/priorities')
def list_priorities(request):
    return [
        {'code': p[0], 'name': p[1]} for p in Priority.choices
    ]


@api.get('/warning-levels')
def list_warning_levels(request):
    return [
        {'code': WarningLevel.NORMAL, 'name': '正常'},
        {'code': WarningLevel.APPROACHING, 'name': '临期'},
        {'code': WarningLevel.OVERDUE, 'name': '逾期'},
    ]


@api.get('/orders', response=OrderListResponse)
def list_orders(
    request,
    status: str | None = Query(None),
    stage: str | None = Query(None),
    priority: str | None = Query(None),
    warning_level: str | None = Query(None),
    keyword: str | None = Query(None),
    is_exception: bool | None = Query(None),
    my_queue_only: bool | None = Query(True),
):
    role = _get_role(request)
    username = _get_username(request)

    qs = ForeignTradeOrder.objects.all()

    if my_queue_only:
        if role == Role.CLERK:
            qs = qs.filter(
                models.Q(stage=OrderStage.INQUIRY)
                | models.Q(stage=OrderStage.QUOTE_CONFIRMATION, current_handler_role=Role.CLERK)
                | models.Q(status=OrderStatus.PENDING_DISPATCH)
            )
        elif role == Role.SUPERVISOR:
            qs = qs.filter(
                models.Q(stage=OrderStage.QUOTE_CONFIRMATION)
                | models.Q(stage=OrderStage.ORDER_SIGNING, current_handler_role=Role.SUPERVISOR)
                | models.Q(status=OrderStatus.PENDING_DISPATCH)
            )
        elif role == Role.REVIEWER:
            qs = qs.filter(
                models.Q(stage=OrderStage.ORDER_SIGNING)
                | models.Q(stage=OrderStage.ARCHIVED)
            )

    if status:
        qs = qs.filter(status=status)
    if stage:
        qs = qs.filter(stage=stage)
    if priority:
        qs = qs.filter(priority=priority)
    if is_exception is not None:
        qs = qs.filter(is_exception=is_exception)
    if keyword:
        kw = keyword.strip()
        qs = qs.filter(
            models.Q(order_no__icontains=kw) | models.Q(customer_name__icontains=kw) | models.Q(product_name__icontains=kw))
    if warning_level:
        now = timezone.now()
        if warning_level == WarningLevel.OVERDUE:
            qs = qs.filter(due_time__lt=now)
        elif warning_level == WarningLevel.APPROACHING:
            two_days_later = now + timedelta(days=2)
            qs = qs.filter(due_time__gte=now, due_time__lte=two_days_later)
        elif warning_level == WarningLevel.NORMAL:
            two_days_later = now + timedelta(days=2)
            qs = qs.filter(models.Q(due_time__isnull=True) | models.Q(due_time__gt=two_days_later))

    total = qs.count()
    items = [_order_to_list_item(o, role) for o in qs.order_by('-create_time')]

    my_qs = ForeignTradeOrder.objects.all()
    if role == Role.CLERK:
        my_qs = my_qs.filter(
            models.Q(stage=OrderStage.INQUIRY)
            | models.Q(stage=OrderStage.QUOTE_CONFIRMATION, current_handler_role=Role.CLERK)
            | models.Q(status=OrderStatus.PENDING_DISPATCH)
        )
    elif role == Role.SUPERVISOR:
        my_qs = my_qs.filter(
            models.Q(stage=OrderStage.QUOTE_CONFIRMATION)
            | models.Q(stage=OrderStage.ORDER_SIGNING, current_handler_role=Role.SUPERVISOR)
            | models.Q(status=OrderStatus.PENDING_DISPATCH)
        )
    elif role == Role.REVIEWER:
        my_qs = my_qs.filter(
            models.Q(stage=OrderStage.ORDER_SIGNING)
            | models.Q(stage=OrderStage.ARCHIVED)
        )

    all_qs = ForeignTradeOrder.objects.all()
    stats = {
        'total': all_qs.count(),
        'pending_dispatch': all_qs.filter(status=OrderStatus.PENDING_DISPATCH).count(),
        'processing': all_qs.filter(status=OrderStatus.PROCESSING).count(),
        'closed': all_qs.filter(status=OrderStatus.CLOSED).count(),
        'exception': all_qs.filter(is_exception=True).count(),
        'overdue': all_qs.filter(due_time__lt=timezone.now(), status__in=[OrderStatus.PENDING_DISPATCH, OrderStatus.PROCESSING]).count(),
        'my_queue': my_qs.count(),
        'my_pending': my_qs.filter(status__in=[OrderStatus.PENDING_DISPATCH, OrderStatus.PROCESSING]).count(),
    }

    return OrderListResponse(total=total, items=items, stats=stats)


@api.get('/orders/{order_id}', response=OrderDetail)
def get_order(request, order_id: int):
    role = _get_role(request)
    username = _get_username(request)
    try:
        order = ForeignTradeOrder.objects.get(id=order_id)
    except ForeignTradeOrder.DoesNotExist:
        raise HttpError(404, '订单不存在')

    if not _validate_role_access_order(role, order):
        raise HttpError(403, f'当前角色无权访问此订单（阶段：{order.get_stage_display()}）')

    handler_ok, handler_msg = _validate_handler_match(username, order)
    if not handler_ok:
        raise HttpError(403, handler_msg)

    return _order_to_detail(order, role)


@api.post('/orders', response=OrderDetail)
def create_order(request, data: OrderCreate):
    role = _get_role(request)
    username = _get_username(request)

    if role != Role.CLERK:
        raise HttpError(403, '只有外贸登记员才能创建订单')

    with transaction.atomic():
        order = ForeignTradeOrder.objects.create(
            order_no=_generate_order_no(),
            customer_name=data.customer_name,
            product_name=data.product_name,
            quantity=data.quantity,
            amount=data.amount,
            country=data.country,
            inquiry_content=data.inquiry_content,
            priority=data.priority,
            responsible_person=data.responsible_person or username,
            current_handler=username,
            current_handler_role=role,
            due_time=data.due_time,
            stage=OrderStage.INQUIRY,
            status=OrderStatus.PENDING_DISPATCH,
        )

        ProcessingRecord.objects.create(
            order=order,
            action=ProcessingAction.CREATE,
            operator=username,
            operator_role=role,
            from_status='',
            to_status=OrderStatus.PENDING_DISPATCH,
            from_stage='',
            to_stage=OrderStage.INQUIRY,
            comment='创建外贸订单',
            version_before=0,
            version_after=1,
        )

    return _order_to_detail(order, role)


@api.put('/orders/{order_id}', response=OrderDetail)
def update_order(request, order_id: int, data: OrderUpdate):
    role = _get_role(request)
    username = _get_username(request)

    with transaction.atomic():
        try:
            order = ForeignTradeOrder.objects.select_for_update().get(id=order_id)
        except ForeignTradeOrder.DoesNotExist:
            raise HttpError(404, '订单不存在')

        if not _validate_role_access_order(role, order):
            raise HttpError(403, f'当前角色无权修改此订单（阶段：{order.get_stage_display()}）')

        handler_ok, handler_msg = _validate_handler_match(username, order)
        if not handler_ok:
            raise HttpError(403, handler_msg)

        if order.version != data.version:
            raise HttpError(409, f'版本冲突，当前版本为 {order.version}，请刷新后重试')

        can_upd, err_msg = _validate_can_update(role, order)
        if not can_upd:
            is_permission_err = '需由' in err_msg or '无权' in err_msg
            raise HttpError(403 if is_permission_err else 400, err_msg)

        fields = data.model_dump(exclude_unset=True, exclude={'version'})
        for k, v in fields.items():
            setattr(order, k, v)

        auto_claimed = False
        if order.status == OrderStatus.PROCESSING and not order.current_handler and order.current_handler_role == role:
            order.current_handler = username
            auto_claimed = True

        order.version += 1
        order.save()

        if auto_claimed:
            _record_audit_note(order, f'[自动认领] 由「{username}」({_get_role_display(role)}) 接单并修改信息', username, role)
        else:
            _record_audit_note(order, f'[信息修改] 由「{username}」更新订单字段', username, role)

        ProcessingRecord.objects.create(
            order=order,
            action=ProcessingAction.CORRECT,
            operator=username,
            operator_role=role,
            from_status=order.status,
            to_status=order.status,
            from_stage=order.stage,
            to_stage=order.stage,
            comment=f'修改订单信息{"（自动认领）" if auto_claimed else ""}',
            version_before=data.version,
            version_after=order.version,
        )

    return _order_to_detail(order, role)


@api.post('/orders/{order_id}/process', response=OrderDetail)
def process_order(request, order_id: int, data: ProcessAction):
    role = _get_role(request)
    username = _get_username(request)

    with transaction.atomic():
        try:
            order = ForeignTradeOrder.objects.select_for_update().get(id=order_id)
        except ForeignTradeOrder.DoesNotExist:
            raise HttpError(404, '订单不存在')

        if not _validate_role_access_order(role, order):
            raise HttpError(403, f'当前角色无权操作此订单（阶段：{order.get_stage_display()}）')

        handler_ok, handler_msg = _validate_handler_match(username, order)
        if not handler_ok:
            raise HttpError(403, handler_msg)

        if order.version != data.version:
            raise HttpError(409, f'版本冲突，当前版本为 {order.version}，请刷新后重试')

        if data.action == ProcessingAction.DISPATCH:
            dispatch_ok, dispatch_msg = _validate_dispatch_role(
                data.dispatch_to_role, role, order
            )
            if not dispatch_ok:
                raise HttpError(400, dispatch_msg)

        ok, err_msg, evidence_required = _validate_can_process(
            role, order, data.action, data.evidence_provided
        )
        if not ok:
            is_permission_err = '无权' in err_msg or '只有' in err_msg or '需由' in err_msg
            if '报价确认信息不完整' in err_msg or '信息不齐' in err_msg:
                _record_exception(order, '缺资料', err_msg, username, role, '补全缺失的资料信息')
                _record_audit_note(order, f'[拦截] {err_msg}', username, role)
                order.save()
            elif '已逾期' in err_msg:
                _record_exception(order, '逾期', err_msg, username, role, '处理逾期异常并补正资料')
                _record_audit_note(order, f'[拦截] {err_msg}', username, role)
                order.save()
            raise HttpError(403 if is_permission_err else 400, err_msg)

        old_version = order.version
        old_status = order.status
        old_stage = order.stage
        action = data.action

        auto_claimed = False
        if order.status == OrderStatus.PROCESSING and not order.current_handler and order.current_handler_role == role:
            order.current_handler = username
            auto_claimed = True

        if action == ProcessingAction.SUBMIT:
            order.status = OrderStatus.PROCESSING
            order.stage = OrderStage.QUOTE_CONFIRMATION
            order.current_handler_role = Role.SUPERVISOR
            order.current_handler = ''
            _record_audit_note(order, f'[提交] 提交到报价确认环节，等待审核主管接单', username, role)

        elif action == ProcessingAction.DISPATCH:
            order.status = OrderStatus.PROCESSING
            order.stage = _role_to_queue_stage(data.dispatch_to_role)
            order.current_handler_role = data.dispatch_to_role
            order.current_handler = ''
            _record_audit_note(
                order,
                f'[派发] 从{_get_role_display(role)}派发到{_get_role_display(data.dispatch_to_role)}，等待接单',
                username, role
            )

        elif action == ProcessingAction.PROCESS:
            if order.stage == OrderStage.QUOTE_CONFIRMATION:
                order.stage = OrderStage.ORDER_SIGNING
                order.current_handler_role = Role.REVIEWER
                order.current_handler = ''
                _record_audit_note(order, '[办理] 报价确认通过，进入订单签订环节', username, role)
            elif order.stage == OrderStage.ORDER_SIGNING:
                _record_audit_note(order, '[办理] 订单签订办理确认', username, role)

        elif action == ProcessingAction.REVIEW:
            order.status = OrderStatus.CLOSED
            order.stage = OrderStage.ARCHIVED
            _record_audit_note(order, '[复核] 复核通过，归档关闭', username, role)

        elif action == ProcessingAction.RETURN:
            if data.comment:
                order.return_reason = data.comment
            if order.stage == OrderStage.QUOTE_CONFIRMATION:
                order.stage = OrderStage.INQUIRY
                order.current_handler_role = Role.CLERK
            elif order.stage in [OrderStage.ORDER_SIGNING, OrderStage.ARCHIVED]:
                order.stage = OrderStage.QUOTE_CONFIRMATION
                order.current_handler_role = Role.SUPERVISOR
            order.status = OrderStatus.PROCESSING
            order.current_handler = ''
            _record_exception(
                order, '退回补正',
                data.comment or '审核未通过，退回补正',
                username, role,
                data.corrective_action or '按退回意见补正资料'
            )
            _record_audit_note(
                order,
                f'[退回] 原因：{data.comment or "审核未通过"}，补正要求：{data.corrective_action or "按退回意见补正资料"}',
                username, role
            )

        elif action == ProcessingAction.CORRECT:
            _resolve_all_exceptions(order, username, role, data.comment or '补正资料')
            _record_audit_note(
                order,
                f'[补正] {data.corrective_action or data.comment or "完成资料补正"}，所有未解决异常已标记为解决',
                username, role
            )

        elif action == ProcessingAction.CLOSE:
            order.status = OrderStatus.CLOSED
            order.stage = OrderStage.ARCHIVED
            _record_audit_note(order, '[关闭] 手动归档关闭', username, role)

        order.version += 1
        order.result = data.comment or order.result
        order.save()

        if auto_claimed:
            _record_audit_note(
                order,
                f'[自动认领] 由「{username}」({_get_role_display(role)}) 接单并执行{action}操作',
                username, role
            )

        ProcessingRecord.objects.create(
            order=order,
            action=action,
            operator=username,
            operator_role=role,
            from_status=old_status,
            to_status=order.status,
            from_stage=old_stage,
            to_stage=order.stage,
            comment=(data.comment or '') + ('（自动认领）' if auto_claimed else ''),
            evidence_required=evidence_required,
            evidence_provided=data.evidence_provided,
            version_before=old_version,
            version_after=order.version,
        )

    return _order_to_detail(order, role)


@api.post('/batch/orders/process', response=BatchProcessResponse)
def batch_process_orders(request, data: BatchProcessRequest):
    role = _get_role(request)
    username = _get_username(request)

    results: List[BatchProcessResult] = []
    success_count = 0

    for item in data.items:
        result = BatchProcessResult(order_id=item.order_id, order_no='', success=False)

        try:
            with transaction.atomic():
                try:
                    order = ForeignTradeOrder.objects.select_for_update().get(id=item.order_id)
                except ForeignTradeOrder.DoesNotExist:
                    result.error_code = 'NOT_FOUND'
                    result.error_message = '订单不存在'
                    results.append(result)
                    continue

                result.order_no = order.order_no

                if not _validate_role_access_order(role, order):
                    result.error_code = 'FORBIDDEN'
                    result.error_message = f'当前角色无权访问此订单（阶段：{order.get_stage_display()}）'
                    results.append(result)
                    continue

                handler_ok, handler_msg = _validate_handler_match(username, order)
                if not handler_ok:
                    result.error_code = 'HANDLER_MISMATCH'
                    result.error_message = handler_msg
                    results.append(result)
                    continue

                if order.version != item.version:
                    result.error_code = 'VERSION_CONFLICT'
                    result.error_message = f'版本冲突，当前版本为 {order.version}'
                    results.append(result)
                    continue

                if item.action == ProcessingAction.DISPATCH:
                    dispatch_ok, dispatch_msg = _validate_dispatch_role(
                        item.dispatch_to_role, role, order
                    )
                    if not dispatch_ok:
                        result.error_code = 'BAD_REQUEST'
                        result.error_message = dispatch_msg
                        results.append(result)
                        continue

                ok, err_msg, evidence_required = _validate_can_process(
                    role, order, item.action, item.evidence_provided
                )
                if not ok:
                    if '报价确认信息不完整' in err_msg or '信息不齐' in err_msg:
                        _record_exception(order, '缺资料', err_msg, username, role, '补全缺失的资料信息')
                        _record_audit_note(order, f'[批量拦截] {err_msg}', username, role)
                        order.save()
                        result.error_code = 'INCOMPLETE'
                    elif '已逾期' in err_msg:
                        _record_exception(order, '逾期', err_msg, username, role, '处理逾期异常并补正资料')
                        _record_audit_note(order, f'[批量拦截] {err_msg}', username, role)
                        order.save()
                        result.error_code = 'OVERDUE'
                    elif '必须上传证据' in err_msg:
                        result.error_code = 'NO_EVIDENCE'
                    elif '无权' in err_msg or '只有' in err_msg or '需由' in err_msg:
                        result.error_code = 'FORBIDDEN'
                    else:
                        result.error_code = 'BAD_REQUEST'
                    result.error_message = err_msg
                    results.append(result)
                    continue

                old_version = order.version
                old_status = order.status
                old_stage = order.stage
                action = item.action

                auto_claimed = False
                if order.status == OrderStatus.PROCESSING and not order.current_handler and order.current_handler_role == role:
                    order.current_handler = username
                    auto_claimed = True

                if action == ProcessingAction.DISPATCH:
                    order.status = OrderStatus.PROCESSING
                    order.stage = _role_to_queue_stage(item.dispatch_to_role)
                    order.current_handler_role = item.dispatch_to_role
                    order.current_handler = ''
                    _record_audit_note(
                        order,
                        f'[批量派发] 派发到{_get_role_display(item.dispatch_to_role)}，等待接单',
                        username, role
                    )

                elif action == ProcessingAction.PROCESS:
                    if order.stage == OrderStage.QUOTE_CONFIRMATION:
                        order.stage = OrderStage.ORDER_SIGNING
                        order.current_handler_role = Role.REVIEWER
                        order.current_handler = ''
                        _record_audit_note(order, '[批量办理] 报价确认通过，进入订单签订环节', username, role)
                    elif order.stage == OrderStage.ORDER_SIGNING:
                        _record_audit_note(order, '[批量办理] 订单签订办理确认', username, role)

                elif action == ProcessingAction.REVIEW:
                    order.status = OrderStatus.CLOSED
                    order.stage = OrderStage.ARCHIVED
                    _record_audit_note(order, '[批量复核] 复核通过，归档关闭', username, role)

                elif action == ProcessingAction.RETURN:
                    if item.comment:
                        order.return_reason = item.comment
                    if order.stage == OrderStage.QUOTE_CONFIRMATION:
                        order.stage = OrderStage.INQUIRY
                        order.current_handler_role = Role.CLERK
                    elif order.stage in [OrderStage.ORDER_SIGNING, OrderStage.ARCHIVED]:
                        order.stage = OrderStage.QUOTE_CONFIRMATION
                        order.current_handler_role = Role.SUPERVISOR
                    order.status = OrderStatus.PROCESSING
                    order.current_handler = ''
                    _record_exception(
                        order, '退回补正',
                        item.comment or '审核未通过，退回补正',
                        username, role,
                        item.corrective_action or '按退回意见补正资料'
                    )
                    _record_audit_note(
                        order,
                        f'[批量退回] 原因：{item.comment or "审核未通过"}',
                        username, role
                    )

                elif action == ProcessingAction.CORRECT:
                    _resolve_all_exceptions(order, username, role, item.comment or '补正资料')
                    _record_audit_note(order, '[批量补正] 资料补正，异常标记为解决', username, role)

                elif action == ProcessingAction.CLOSE:
                    order.status = OrderStatus.CLOSED
                    order.stage = OrderStage.ARCHIVED
                    _record_audit_note(order, '[批量关闭] 归档关闭', username, role)

                order.version += 1
                order.result = item.comment or order.result
                order.save()

                if auto_claimed:
                    _record_audit_note(
                        order,
                        f'[自动认领] 由「{username}」({_get_role_display(role)}) 接单并批量执行{action}操作',
                        username, role
                    )

                ProcessingRecord.objects.create(
                    order=order,
                    action=action,
                    operator=username,
                    operator_role=role,
                    from_status=old_status,
                    to_status=order.status,
                    from_stage=old_stage,
                    to_stage=order.stage,
                    comment=(item.comment or '') + ('（自动认领）' if auto_claimed else ''),
                    evidence_required=evidence_required,
                    evidence_provided=item.evidence_provided,
                    version_before=old_version,
                    version_after=order.version,
                )

                result.success = True
                result.new_status = order.status
                result.new_stage = order.stage
                result.new_version = order.version
                success_count += 1

        except HttpError as e:
            result.error_code = 'ERROR'
            result.error_message = str(e)

        results.append(result)

    return BatchProcessResponse(
        total=len(results),
        success_count=success_count,
        failed_count=len(results) - success_count,
        results=results,
    )


@api.post('/orders/{order_id}/attachments', response=AttachmentInfo)
def upload_attachment(request, order_id: int, file: NinjaUploadedFile = File(...), description: str = '', stage: str = ''):
    role = _get_role(request)
    username = _get_username(request)

    with transaction.atomic():
        try:
            order = ForeignTradeOrder.objects.select_for_update().get(id=order_id)
        except ForeignTradeOrder.DoesNotExist:
            raise HttpError(404, '订单不存在')

        if not _validate_role_access_order(role, order):
            raise HttpError(403, f'当前角色无权上传附件（阶段：{order.get_stage_display()}）')

        handler_ok, handler_msg = _validate_handler_match(username, order)
        if not handler_ok:
            raise HttpError(403, handler_msg)

        if order.status == OrderStatus.CLOSED:
            raise HttpError(400, '已关闭订单不能上传附件')

        upload_dir = Path(settings.MEDIA_ROOT) / str(order.id)
        upload_dir.mkdir(parents=True, exist_ok=True)

        ext = Path(file.name).suffix or '.bin'
        safe_name = f"{uuid.uuid4().hex}{ext}"
        file_path = upload_dir / safe_name

        with open(file_path, 'wb') as f:
            for chunk in file.chunks():
                f.write(chunk)

        rel_path = f"/uploads/{order.id}/{safe_name}"

        attachment = OrderAttachment.objects.create(
            order=order,
            file_name=file.name,
            file_path=rel_path,
            file_type=file.content_type or '',
            file_size=file.size,
            uploaded_by=username,
            uploaded_by_role=role,
            description=description,
            stage=stage or order.stage,
        )

        auto_claimed = False
        if order.status == OrderStatus.PROCESSING and not order.current_handler and order.current_handler_role == role:
            order.current_handler = username
            auto_claimed = True
            order.save()

        if auto_claimed:
            _record_audit_note(
                order,
                f'[自动认领] 由「{username}」({_get_role_display(role)}) 接单并上传附件',
                username, role
            )

        _record_audit_note(
            order,
            f'[附件上传] {file.name}（{file.size}字节）{description and "- " + description}（阶段：{attachment.stage}）',
            username, role
        )

    return AttachmentInfo(
        id=attachment.id,
        file_name=attachment.file_name,
        file_path=attachment.file_path,
        file_type=attachment.file_type,
        file_size=attachment.file_size,
        uploaded_by=attachment.uploaded_by,
        uploaded_by_role=attachment.uploaded_by_role,
        upload_time=attachment.upload_time,
        description=attachment.description,
        stage=attachment.stage,
    )


@api.post('/orders/{order_id}/audit-notes', response=AuditNoteInfo)
def add_audit_note(request, order_id: int, data: AuditNoteCreate):
    role = _get_role(request)
    username = _get_username(request)

    with transaction.atomic():
        try:
            order = ForeignTradeOrder.objects.select_for_update().get(id=order_id)
        except ForeignTradeOrder.DoesNotExist:
            raise HttpError(404, '订单不存在')

        if not _validate_role_access_order(role, order):
            raise HttpError(403, f'当前角色无权添加审计备注（阶段：{order.get_stage_display()}）')

        handler_ok, handler_msg = _validate_handler_match(username, order)
        if not handler_ok:
            raise HttpError(403, handler_msg)

        if order.status == OrderStatus.CLOSED:
            raise HttpError(400, '已关闭订单不能添加审计备注')

        note = _record_audit_note(order, data.note, username, role)

    return AuditNoteInfo(
        id=note.id,
        note=note.note,
        noted_by=note.noted_by,
        noted_by_role=note.noted_by_role,
        note_time=note.note_time,
    )


@api.post('/orders/{order_id}/exception-reasons', response=ExceptionReasonInfo)
def add_exception_reason(request, order_id: int, data: ExceptionReasonCreate):
    role = _get_role(request)
    username = _get_username(request)

    with transaction.atomic():
        try:
            order = ForeignTradeOrder.objects.select_for_update().get(id=order_id)
        except ForeignTradeOrder.DoesNotExist:
            raise HttpError(404, '订单不存在')

        if not _validate_role_access_order(role, order):
            raise HttpError(403, f'当前角色无权添加异常原因（阶段：{order.get_stage_display()}）')

        handler_ok, handler_msg = _validate_handler_match(username, order)
        if not handler_ok:
            raise HttpError(403, handler_msg)

        if order.status == OrderStatus.CLOSED:
            raise HttpError(400, '已关闭订单不能添加异常原因')

        exc = _record_exception(
            order,
            data.reason_type,
            data.reason_detail,
            username,
            role,
            data.corrective_action
        )
        _record_audit_note(
            order,
            f'[异常登记] 类型：{data.reason_type}，原因：{data.reason_detail}'
            f'{data.corrective_action and f"，补正：{data.corrective_action}"}',
            username, role
        )
        order.save()

    return ExceptionReasonInfo(
        id=exc.id,
        reason_type=exc.reason_type,
        reason_detail=exc.reason_detail,
        corrective_action=exc.corrective_action,
        recorded_by=exc.recorded_by,
        recorded_by_role=exc.recorded_by_role,
        record_time=exc.record_time,
        resolved=exc.resolved,
        resolve_time=exc.resolve_time,
    )


@api.get('/stats/summary')
def get_stats(request):
    role = _get_role(request)
    username = _get_username(request)
    now = timezone.now()

    qs = ForeignTradeOrder.objects.all()

    return {
        'total': qs.count(),
        'pending_dispatch': qs.filter(status=OrderStatus.PENDING_DISPATCH).count(),
        'processing': qs.filter(status=OrderStatus.PROCESSING).count(),
        'closed': qs.filter(status=OrderStatus.CLOSED).count(),
        'exception': qs.filter(is_exception=True).count(),
        'overdue': qs.filter(due_time__lt=now, status__in=[OrderStatus.PENDING_DISPATCH, OrderStatus.PROCESSING]).count(),
        'approaching': qs.filter(
            due_time__gte=now,
            due_time__lte=now + timedelta(days=2),
            status__in=[OrderStatus.PENDING_DISPATCH, OrderStatus.PROCESSING]
        ).count(),
        'by_stage': {
            OrderStage.INQUIRY: qs.filter(stage=OrderStage.INQUIRY).count(),
            OrderStage.QUOTE_CONFIRMATION: qs.filter(stage=OrderStage.QUOTE_CONFIRMATION).count(),
            OrderStage.ORDER_SIGNING: qs.filter(stage=OrderStage.ORDER_SIGNING).count(),
            OrderStage.ARCHIVED: qs.filter(stage=OrderStage.ARCHIVED).count(),
        },
        'by_priority': {
            Priority.LOW: qs.filter(priority=Priority.LOW).count(),
            Priority.MEDIUM: qs.filter(priority=Priority.MEDIUM).count(),
            Priority.HIGH: qs.filter(priority=Priority.HIGH).count(),
            Priority.URGENT: qs.filter(priority=Priority.URGENT).count(),
        },
    }

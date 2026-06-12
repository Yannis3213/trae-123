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


def _order_to_list_item(order: ForeignTradeOrder) -> OrderListItem:
    warning_level = order.get_warning_level()
    return OrderListItem(
        id=order.id, order_no=order.order_no,
        customer_name=order.customer_name, product_name=order.product_name,
        amount=float(order.amount),
        status=order.status, status_display=order.get_status_display(),
        stage=order.stage, stage_display=order.get_stage_display(),
        priority=order.priority, priority_display=order.get_priority_display(),
        responsible_person=order.responsible_person,
        current_handler=order.current_handler,
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
):
    role = _get_role(request)
    username = _get_username(request)

    qs = ForeignTradeOrder.objects.all()

    if role == Role.CLERK:
        pass
    elif role == Role.SUPERVISOR:
        qs = qs.filter(stage__in=[OrderStage.INQUIRY, OrderStage.QUOTE_CONFIRMATION])
    elif role == Role.REVIEWER:
        qs = qs.filter(stage__in=[OrderStage.QUOTE_CONFIRMATION, OrderStage.ORDER_SIGNING, OrderStage.ARCHIVED])

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
    items = [_order_to_list_item(o) for o in qs.order_by('-create_time')]

    all_qs = ForeignTradeOrder.objects.all()
    stats = {
        'total': all_qs.count(),
        'pending_dispatch': all_qs.filter(status=OrderStatus.PENDING_DISPATCH).count(),
        'processing': all_qs.filter(status=OrderStatus.PROCESSING).count(),
        'closed': all_qs.filter(status=OrderStatus.CLOSED).count(),
        'exception': all_qs.filter(is_exception=True).count(),
        'overdue': all_qs.filter(due_time__lt=timezone.now(), status__in=[OrderStatus.PENDING_DISPATCH, OrderStatus.PROCESSING]).count(),
        'my_queue': qs.count(),
    }

    return OrderListResponse(total=total, items=items, stats=stats)


@api.get('/orders/{order_id}', response=OrderDetail)
def get_order(request, order_id: int):
    role = _get_role(request)
    try:
        order = ForeignTradeOrder.objects.get(id=order_id)
    except ForeignTradeOrder.DoesNotExist:
        raise HttpError(404, '订单不存在')
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

        if order.version != data.version:
            raise HttpError(409, f'版本冲突，当前版本为 {order.version}，请刷新后重试')

        if order.status == OrderStatus.CLOSED:
            raise HttpError(400, '已关闭订单不能修改')

        fields = data.model_dump(exclude_unset=True, exclude={'version'})
        for k, v in fields.items():
            setattr(order, k, v)

        order.version += 1
        order.save()

        ProcessingRecord.objects.create(
            order=order,
            action=ProcessingAction.CORRECT,
            operator=username,
            operator_role=role,
            from_status=order.status,
            to_status=order.status,
            from_stage=order.stage,
            to_stage=order.stage,
            comment=f'修改订单信息',
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

        if order.version != data.version:
            raise HttpError(409, f'版本冲突，当前版本为 {order.version}，请刷新后重试')

        old_version = order.version
        old_status = order.status
        old_stage = order.stage

        action = data.action

        if order.status == OrderStatus.CLOSED:
            raise HttpError(400, '已关闭订单不能操作')

        evidence_required = False

        if action == ProcessingAction.SUBMIT:
            if role != Role.CLERK:
                raise HttpError(403, '只有外贸登记员才能提交')
            if not order.inquiry_content.strip():
                raise HttpError(400, '客户询盘内容不能为空')
            order.status = OrderStatus.PROCESSING
            order.stage = OrderStage.QUOTE_CONFIRMATION
            order.current_handler_role = Role.SUPERVISOR
            order.current_handler = ''

        elif action == ProcessingAction.DISPATCH:
            if role not in [Role.CLERK, Role.SUPERVISOR]:
                raise HttpError(403, '无派发权限')
            if not data.dispatch_to_role:
                raise HttpError(400, '请指定派发目标角色')
            order.status = OrderStatus.PROCESSING
            order.stage = _role_to_queue_stage(data.dispatch_to_role)
            order.current_handler_role = data.dispatch_to_role
            order.current_handler = ''

        elif action == ProcessingAction.PROCESS:
            if role != order.current_handler_role:
                raise HttpError(403, f'当前节点需由{_get_role_display(order.current_handler_role)}办理')
            evidence_required = True
            if not data.evidence_provided:
                raise HttpError(400, '办理必须上传证据附件')

            if order.stage == OrderStage.QUOTE_CONFIRMATION:
                if not order.quote_confirmed or not order.quote_content.strip():
                    raise HttpError(400, '报价确认信息不完整，订单停留在原队列')
                order.stage = OrderStage.ORDER_SIGNING
                order.current_handler_role = Role.REVIEWER
                order.current_handler = ''

            elif order.stage == OrderStage.ORDER_SIGNING:
                complete, missing = _validate_quote_and_order_complete(order)
                if not complete:
                    raise HttpError(400, '报价确认、订单签订信息不齐，订单停留在原队列：' + '；'.join(missing))
                order.stage = OrderStage.ORDER_SIGNING

        elif action == ProcessingAction.REVIEW:
            if role != Role.REVIEWER:
                raise HttpError(403, '只有复核负责人才能复核')
            evidence_required = True
            if not data.evidence_provided:
                raise HttpError(400, '复核必须上传证据')
            complete, missing = _validate_quote_and_order_complete(order)
            if not complete:
                raise HttpError(400, '报价确认、订单签订信息不齐：' + '；'.join(missing))
            order.status = OrderStatus.CLOSED
            order.stage = OrderStage.ARCHIVED

        elif action == ProcessingAction.RETURN:
            if role not in [Role.SUPERVISOR, Role.REVIEWER]:
                raise HttpError(403, '只有审核主管或复核负责人才能退回')
            if not data.comment:
                order.return_reason = data.comment
            if order.stage == OrderStage.QUOTE_CONFIRMATION:
                order.stage = OrderStage.INQUIRY
                order.current_handler_role = Role.CLERK
            elif order.stage in [OrderStage.ORDER_SIGNING, OrderStage.ARCHIVED]:
                order.stage = OrderStage.QUOTE_CONFIRMATION
                order.current_handler_role = Role.SUPERVISOR
            order.status = OrderStatus.PROCESSING
            order.current_handler = ''
            order.is_exception = True
            tags = list(order.exception_tags or [])
            if '退回补正' not in tags:
                tags.append('退回补正')
            order.exception_tags = tags

        elif action == ProcessingAction.CORRECT:
            if role != order.current_handler_role:
                raise HttpError(403, '只有当前处理人才能补正')
            if data.corrective_action:
                ExceptionReason.objects.create(
                    order=order,
                    reason_type='补正',
                    reason_detail=data.comment or '补正资料',
                    corrective_action=data.corrective_action,
                    recorded_by=username,
                    recorded_by_role=role,
                )
            order.is_exception = False

        elif action == ProcessingAction.CLOSE:
            if role != Role.REVIEWER:
                raise HttpError(403, '只有复核负责人才能关闭归档')
            evidence_required = True
            if not data.evidence_provided:
                raise HttpError(400, '关闭归档必须上传证据')
            order.status = OrderStatus.CLOSED
            order.stage = OrderStage.ARCHIVED

        else:
            raise HttpError(400, f'不支持的操作: {action}')

        order.version += 1
        order.result = data.comment or order.result
        order.save()

        ProcessingRecord.objects.create(
            order=order,
            action=action,
            operator=username,
            operator_role=role,
            from_status=old_status,
            to_status=order.status,
            from_stage=old_stage,
            to_stage=order.stage,
            comment=data.comment or '',
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

                if order.version != item.version:
                    result.error_code = 'VERSION_CONFLICT'
                    result.error_message = f'版本冲突，当前版本为 {order.version}'
                    results.append(result)
                    continue

                if order.status == OrderStatus.CLOSED:
                    result.error_code = 'CLOSED'
                    result.error_message = '订单已关闭，不能操作'
                    results.append(result)
                    continue

                old_version = order.version
                old_status = order.status
                old_stage = order.stage
                action = item.action

                evidence_required = False

                if action == ProcessingAction.DISPATCH:
                    if role not in [Role.CLERK, Role.SUPERVISOR]:
                        result.error_code = 'FORBIDDEN'
                        result.error_message = '无派发权限'
                        results.append(result)
                        continue
                    if not item.dispatch_to_role:
                        result.error_code = 'BAD_REQUEST'
                        result.error_message = '请指定派发目标角色'
                        results.append(result)
                        continue
                    order.status = OrderStatus.PROCESSING
                    order.stage = _role_to_queue_stage(item.dispatch_to_role)
                    order.current_handler_role = item.dispatch_to_role
                    order.current_handler = ''

                elif action == ProcessingAction.PROCESS:
                    if role != order.current_handler_role:
                        result.error_code = 'FORBIDDEN'
                        result.error_message = f'当前节点需由{_get_role_display(order.current_handler_role)}办理'
                        results.append(result)
                        continue
                    evidence_required = True
                    if not item.evidence_provided:
                        result.error_code = 'NO_EVIDENCE'
                        result.error_message = '办理必须上传证据附件'
                        results.append(result)
                        continue

                    complete, missing = _validate_quote_and_order_complete(order)
                    if order.stage == OrderStage.QUOTE_CONFIRMATION:
                        if not order.quote_confirmed or not order.quote_content.strip():
                            result.error_code = 'INCOMPLETE'
                            result.error_message = '报价确认信息不完整，订单停留在原队列'
                            results.append(result)
                            continue
                        order.stage = OrderStage.ORDER_SIGNING
                        order.current_handler_role = Role.REVIEWER
                        order.current_handler = ''

                    elif order.stage == OrderStage.ORDER_SIGNING:
                        if not complete:
                            result.error_code = 'INCOMPLETE'
                            result.error_message = '报价确认、订单签订信息不齐：' + '；'.join(missing)
                            results.append(result)
                            continue

                elif action == ProcessingAction.REVIEW:
                    if role != Role.REVIEWER:
                        result.error_code = 'FORBIDDEN'
                        result.error_message = '只有复核负责人才能复核'
                        results.append(result)
                        continue
                    evidence_required = True
                    if not item.evidence_provided:
                        result.error_code = 'NO_EVIDENCE'
                        result.error_message = '复核必须上传证据'
                        results.append(result)
                        continue
                    complete, missing = _validate_quote_and_order_complete(order)
                    if not complete:
                        result.error_code = 'INCOMPLETE'
                        result.error_message = '报价确认、订单签订信息不齐：' + '；'.join(missing)
                        results.append(result)
                        continue
                    order.status = OrderStatus.CLOSED
                    order.stage = OrderStage.ARCHIVED

                elif action == ProcessingAction.CLOSE:
                    if role != Role.REVIEWER:
                        result.error_code = 'FORBIDDEN'
                        result.error_message = '只有复核负责人才能关闭归档'
                        results.append(result)
                        continue
                    evidence_required = True
                    if not item.evidence_provided:
                        result.error_code = 'NO_EVIDENCE'
                        result.error_message = '关闭归档必须上传证据'
                        results.append(result)
                        continue
                    order.status = OrderStatus.CLOSED
                    order.stage = OrderStage.ARCHIVED

                else:
                    result.error_code = 'BAD_REQUEST'
                    result.error_message = f'不支持的操作: {action}'
                    results.append(result)
                    continue

                order.version += 1
                order.save()

                ProcessingRecord.objects.create(
                    order=order,
                    action=action,
                    operator=username,
                    operator_role=role,
                    from_status=old_status,
                    to_status=order.status,
                    from_stage=old_stage,
                    to_stage=order.stage,
                    comment=item.comment or '',
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

    try:
        order = ForeignTradeOrder.objects.get(id=order_id)
    except ForeignTradeOrder.DoesNotExist:
        raise HttpError(404, '订单不存在')

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

    try:
        order = ForeignTradeOrder.objects.get(id=order_id)
    except ForeignTradeOrder.DoesNotExist:
        raise HttpError(404, '订单不存在')

    note = AuditNote.objects.create(
        order=order,
        note=data.note,
        noted_by=username,
        noted_by_role=role,
    )

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

    try:
        order = ForeignTradeOrder.objects.get(id=order_id)
    except ForeignTradeOrder.DoesNotExist:
        raise HttpError(404, '订单不存在')

    exc = ExceptionReason.objects.create(
        order=order,
        reason_type=data.reason_type,
        reason_detail=data.reason_detail,
        corrective_action=data.corrective_action,
        recorded_by=username,
        recorded_by_role=role,
    )

    order.is_exception = True
    tags = list(order.exception_tags or [])
    if data.reason_type not in tags:
        tags.append(data.reason_type)
    order.exception_tags = tags
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

import uuid
from datetime import datetime, timedelta
from typing import Optional, List
from django.http import HttpRequest
from django.utils import timezone
from ninja import NinjaAPI, Schema, Query
from ninja.errors import HttpError

from .models import (
    User, Role, LabAppointment, OrderStatus, Priority,
    Attachment, ProcessingRecord, AuditNote, ExceptionReason, ExceptionType
)
from .schemas import (
    UserOut, LoginIn,
    AppointmentIn, AppointmentOut, AppointmentDetailOut, AppointmentUpdateIn,
    AttachmentOut, AttachmentIn,
    ProcessingRecordOut, AuditNoteOut, ExceptionReasonOut, ExceptionReasonIn,
    ActionIn, BatchActionIn
)


api = NinjaAPI(title='高校实验室-月底集中处理实验预约单系统', version='1.0.0')

ACTION_SUBMIT = '提交复核'
ACTION_PROCESS = '办理中核验'
ACTION_REVIEW = '复核归档'
ACTION_RETURN = '退回补正'
ACTION_UPDATE = '信息更新/补正'
ACTION_CREATE = '创建'
ACTION_BATCH_ARCHIVE = '批量归档'
ACTION_BATCH_RETURN = '批量退回'
ACTION_BATCH_BLOCK = '批量拦截留痕'


class WriteActionRule:
    def __init__(self, action_name, allowed_roles, allowed_statuses,
                 require_owner=False, require_handler=True,
                 require_opinion=True, require_audit_note=True,
                 require_evidence_types=None, block_if_overdue=False):
        self.action_name = action_name
        self.allowed_roles = allowed_roles
        self.allowed_statuses = allowed_statuses
        self.require_owner = require_owner
        self.require_handler = require_handler
        self.require_opinion = require_opinion
        self.require_audit_note = require_audit_note
        self.require_evidence_types = require_evidence_types or []
        self.block_if_overdue = block_if_overdue


RULES = {
    'submit': WriteActionRule(
        ACTION_SUBMIT, allowed_roles=[Role.TA],
        allowed_statuses=[OrderStatus.DRAFT, OrderStatus.RETURNED],
        require_owner=True, require_handler=False,
        require_opinion=True, require_audit_note=False,
        require_evidence_types=['safety'], block_if_overdue=False,
    ),
    'process': WriteActionRule(
        ACTION_PROCESS, allowed_roles=[Role.ADMIN],
        allowed_statuses=[OrderStatus.PENDING],
        require_owner=False, require_handler=True,
        require_opinion=True, require_audit_note=True,
        require_evidence_types=[], block_if_overdue=False,
    ),
    'review': WriteActionRule(
        ACTION_REVIEW, allowed_roles=[Role.DEAN],
        allowed_statuses=[OrderStatus.PENDING],
        require_owner=False, require_handler=True,
        require_opinion=True, require_audit_note=True,
        require_evidence_types=[], block_if_overdue=True,
    ),
    'return': WriteActionRule(
        ACTION_RETURN, allowed_roles=[Role.ADMIN, Role.DEAN],
        allowed_statuses=[OrderStatus.PENDING],
        require_owner=False, require_handler=True,
        require_opinion=False, require_audit_note=False,
        require_evidence_types=[], block_if_overdue=False,
    ),
    'update': WriteActionRule(
        ACTION_UPDATE, allowed_roles=[Role.TA],
        allowed_statuses=[OrderStatus.DRAFT, OrderStatus.RETURNED],
        require_owner=True, require_handler=False,
        require_opinion=False, require_audit_note=False,
        require_evidence_types=[], block_if_overdue=False,
    ),
    'batch_archive': WriteActionRule(
        ACTION_BATCH_ARCHIVE, allowed_roles=[Role.DEAN],
        allowed_statuses=[OrderStatus.PENDING],
        require_owner=False, require_handler=True,
        require_opinion=True, require_audit_note=True,
        require_evidence_types=[], block_if_overdue=True,
    ),
    'batch_return': WriteActionRule(
        ACTION_BATCH_RETURN, allowed_roles=[Role.DEAN],
        allowed_statuses=[OrderStatus.PENDING],
        require_owner=False, require_handler=True,
        require_opinion=False, require_audit_note=False,
        require_evidence_types=[], block_if_overdue=False,
    ),
}


def get_current_user(request: HttpRequest) -> User:
    user_id = request.headers.get('X-User-Id')
    if not user_id:
        raise HttpError(401, '未登录，请先选择角色登录')
    try:
        return User.objects.get(id=int(user_id))
    except (ValueError, User.DoesNotExist):
        raise HttpError(401, '登录已失效，请重新登录')


def compute_warning(order: LabAppointment) -> tuple:
    now = timezone.now()
    if not order.deadline:
        return 'normal', False
    if order.status == OrderStatus.ARCHIVED:
        return 'normal', False
    delta = order.deadline - now
    if delta.total_seconds() < 0:
        return 'overdue', True
    if delta.total_seconds() < 24 * 3600:
        return 'warning', False
    return 'normal', False


def enrich_order(order: LabAppointment) -> dict:
    data = {
        'id': order.id,
        'order_no': order.order_no,
        'title': order.title,
        'experiment_name': order.experiment_name,
        'experiment_room': order.experiment_room,
        'experiment_date': order.experiment_date,
        'student_count': order.student_count,
        'course_name': order.course_name,
        'teacher_name': order.teacher_name,
        'materials_requested': order.materials_requested,
        'safety_confirmed': order.safety_confirmed,
        'safety_note': order.safety_note,
        'priority': order.priority,
        'status': order.status,
        'version': order.version,
        'deadline': order.deadline,
        'owner_id': order.owner_id,
        'owner_name': order.owner.name if order.owner else '',
        'current_handler_id': order.current_handler_id,
        'current_handler_name': order.current_handler.name if order.current_handler else '',
        'created_at': order.created_at,
        'updated_at': order.updated_at,
    }
    wl, overdue = compute_warning(order)
    data['warning_level'] = wl
    data['is_overdue'] = overdue
    return data


def validate_write_action(user: User, order: LabAppointment, payload, rule: WriteActionRule) -> list:
    errors = []
    if user.role not in rule.allowed_roles:
        errors.append({
            'type': ExceptionType.PERMISSION,
            'msg': f'权限问题：{user.name}({user.get_role_display()}) 无权执行【{rule.action_name}】'
        })
    if rule.require_owner and order.owner_id and order.owner_id != user.id:
        errors.append({
            'type': ExceptionType.PERMISSION,
            'msg': f'权限问题：该单据归属 {order.owner.name}，仅本人可执行【{rule.action_name}】'
        })
    if rule.require_handler and order.current_handler_id and order.current_handler_id != user.id:
        errors.append({
            'type': ExceptionType.PERMISSION,
            'msg': f'权限问题：当前处理人是 {order.current_handler.name}，请先转办再执行【{rule.action_name}】'
        })
    if order.status not in rule.allowed_statuses:
        errors.append({
            'type': ExceptionType.STATUS,
            'msg': f'状态问题：当前状态【{order.get_status_display()}】不允许执行【{rule.action_name}】'
        })
    client_version = getattr(payload, 'version', None)
    if client_version is None or client_version == 0 or client_version is False:
        errors.append({
            'type': ExceptionType.STATUS,
            'msg': f'版本缺失：请传递当前单据版本号(当前v{order.version})，防止重复提交'
        })
    elif client_version != order.version:
        errors.append({
            'type': ExceptionType.STATUS,
            'msg': f'状态冲突/旧版本提交：当前v{order.version}，提交v{client_version}，请刷新后重试'
        })
    if rule.block_if_overdue and order.deadline and order.deadline < timezone.now():
        errors.append({
            'type': ExceptionType.TIMELIMIT,
            'msg': f'时限问题：已超过截止时间 {order.deadline.strftime("%Y-%m-%d %H:%M")}，需先补正后再办理'
        })
    if rule.require_opinion and not (getattr(payload, 'opinion', '') or '').strip():
        errors.append({
            'type': ExceptionType.MATERIAL,
            'msg': '材料问题：【处理意见】不能为空'
        })
    if rule.require_audit_note and not (getattr(payload, 'audit_note', '') or '').strip():
        errors.append({
            'type': ExceptionType.MATERIAL,
            'msg': '材料问题：【审计备注】不能为空，用于事后追溯'
        })
    for etype in rule.require_evidence_types:
        has_evidence = False
        if etype == 'safety':
            if order.safety_confirmed:
                has_evidence = True
            else:
                if any(a.evidence_type == 'safety' for a in order.attachments.all()):
                    has_evidence = True
                payload_atts = getattr(payload, 'attachments', []) or []
                if any(getattr(a, 'evidence_type', '') == 'safety' for a in payload_atts):
                    has_evidence = True
        if not has_evidence:
            errors.append({
                'type': ExceptionType.MATERIAL,
                'msg': f'材料问题：缺少必填证据【{etype}】'
            })
    if rule.action_name in (ACTION_RETURN, ACTION_BATCH_RETURN):
        if not (getattr(payload, 'comment', '') or '').strip() \
                and not (getattr(payload, 'exception_desc', '') or '').strip():
            errors.append({
                'type': ExceptionType.MATERIAL,
                'msg': '材料问题：退回必须说明退回原因(comment 或 exception_desc)'
            })
    return errors


def persist_evidence_and_notes(order, user, payload):
    evidence_count = 0
    for att in getattr(payload, 'attachments', []) or []:
        Attachment.objects.create(
            order=order, file_name=att.file_name,
            file_type=getattr(att, 'file_type', 'text/plain'),
            evidence_type=getattr(att, 'evidence_type', ''),
            description=getattr(att, 'description', ''),
            uploaded_by=user
        )
        evidence_count += 1
    audit_note_text = (getattr(payload, 'audit_note', '') or '').strip()
    if audit_note_text:
        AuditNote.objects.create(order=order, author=user, content=audit_note_text)
    exc_type = (getattr(payload, 'exception_type', '') or '').strip()
    exc_desc = (getattr(payload, 'exception_desc', '') or '').strip()
    if exc_type and exc_desc:
        ExceptionReason.objects.create(
            order=order, exception_type=exc_type,
            description=exc_desc, reporter=user
        )
    return evidence_count, audit_note_text, exc_type, exc_desc


def add_record_full(order, user, action, from_status, to_status,
                    comment='', opinion='', audit_note='',
                    exception_type='', exception_desc='',
                    evidence_count=0, batch_id=''):
    ProcessingRecord.objects.create(
        order=order, actor=user, action=action,
        from_status=from_status, to_status=to_status,
        comment=comment, opinion=opinion, audit_note=audit_note,
        exception_type=exception_type, exception_desc=exception_desc,
        evidence_count=evidence_count, batch_id=batch_id
    )


def add_block_record(order, user, action, errors, batch_id=''):
    combined_msg = '；'.join([e['msg'] for e in errors])
    first_type = errors[0]['type'] if errors else ExceptionType.STATUS
    ProcessingRecord.objects.create(
        order=order, actor=user, action=action,
        from_status=order.status, to_status=order.status,
        comment=combined_msg, opinion='', audit_note=combined_msg,
        exception_type=first_type, exception_desc=combined_msg,
        evidence_count=0, batch_id=batch_id
    )
    ExceptionReason.objects.create(
        order=order, exception_type=first_type,
        description=combined_msg, reporter=user,
        resolved=False
    )
    AuditNote.objects.create(
        order=order, author=user,
        content=f'[{action}] 校验拦截：{combined_msg}'
    )


@api.get('/users', response=List[UserOut])
def list_users(request):
    return list(User.objects.all())


@api.post('/login', response=UserOut)
def login(request, payload: LoginIn):
    user = User.objects.filter(username=payload.username).first()
    if not user:
        raise HttpError(404, '用户不存在')
    return user


@api.get('/appointments', response=List[AppointmentOut])
def list_appointments(
    request,
    status: Optional[str] = Query(None),
    owner_id: Optional[int] = Query(None),
    current_handler_id: Optional[int] = Query(None),
    priority: Optional[str] = Query(None),
    warning: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
):
    user = get_current_user(request)
    qs = LabAppointment.objects.select_related('owner', 'current_handler').all()
    if status:
        qs = qs.filter(status=status)
    if owner_id:
        qs = qs.filter(owner_id=owner_id)
    if current_handler_id:
        qs = qs.filter(current_handler_id=current_handler_id)
    if priority:
        qs = qs.filter(priority=priority)
    if keyword:
        qs = qs.filter(title__icontains=keyword) | qs.filter(order_no__icontains=keyword)
    orders = list(qs)
    result = []
    for o in orders:
        data = enrich_order(o)
        if warning and data['warning_level'] != warning:
            continue
        result.append(data)
    return result


@api.get('/appointments/stats')
def appointment_stats(request):
    user = get_current_user(request)
    total = LabAppointment.objects.count()
    by_status = {}
    for s in OrderStatus.values:
        by_status[s] = LabAppointment.objects.filter(status=s).count()
    by_warning = {'normal': 0, 'warning': 0, 'overdue': 0}
    now = timezone.now()
    for o in LabAppointment.objects.exclude(status=OrderStatus.ARCHIVED):
        if not o.deadline:
            by_warning['normal'] += 1
            continue
        delta = o.deadline - now
        if delta.total_seconds() < 0:
            by_warning['overdue'] += 1
        elif delta.total_seconds() < 24 * 3600:
            by_warning['warning'] += 1
        else:
            by_warning['normal'] += 1
    return {
        'total': total,
        'by_status': by_status,
        'by_warning': by_warning,
        'current_user': {'id': user.id, 'name': user.name, 'role': user.role},
    }


@api.get('/appointments/{order_id}', response=AppointmentDetailOut)
def get_appointment(request, order_id: int):
    user = get_current_user(request)
    try:
        order = LabAppointment.objects.select_related('owner', 'current_handler').get(id=order_id)
    except LabAppointment.DoesNotExist:
        raise HttpError(404, '预约单不存在')
    data = enrich_order(order)
    attachments = []
    for a in order.attachments.select_related('uploaded_by').all():
        attachments.append({
            'id': a.id, 'file_name': a.file_name, 'file_type': a.file_type,
            'evidence_type': a.evidence_type, 'description': a.description,
            'uploaded_by_id': a.uploaded_by_id,
            'uploaded_by_name': a.uploaded_by.name,
            'uploaded_at': a.uploaded_at,
        })
    records = []
    for r in order.records.select_related('actor').all():
        records.append({
            'id': r.id, 'actor_id': r.actor_id, 'actor_name': r.actor.name,
            'action': r.action, 'from_status': r.from_status, 'to_status': r.to_status,
            'comment': r.comment, 'opinion': r.opinion, 'created_at': r.created_at,
            'audit_note': r.audit_note, 'exception_type': r.exception_type,
            'exception_desc': r.exception_desc, 'evidence_count': r.evidence_count,
            'batch_id': r.batch_id,
        })
    notes = []
    for n in order.audit_notes.select_related('author').all():
        notes.append({
            'id': n.id, 'author_id': n.author_id, 'author_name': n.author.name,
            'content': n.content, 'created_at': n.created_at,
        })
    excs = []
    for e in order.exceptions.select_related('reporter').all():
        excs.append({
            'id': e.id, 'exception_type': e.exception_type, 'description': e.description,
            'reporter_id': e.reporter_id, 'reporter_name': e.reporter.name,
            'created_at': e.created_at, 'resolved': e.resolved,
        })
    data['attachments'] = attachments
    data['records'] = records
    data['audit_notes'] = notes
    data['exceptions'] = excs
    return data


@api.post('/appointments')
def create_appointment(request, payload: AppointmentIn):
    user = get_current_user(request)
    errors = []
    if user.role not in (Role.TA, Role.ADMIN):
        errors.append({
            'type': ExceptionType.PERMISSION,
            'msg': f'权限问题：{user.name}({user.get_role_display()}) 无权创建预约单'
        })
    client_version = getattr(payload, 'version', None)
    if client_version is None or client_version == 0 or client_version is False:
        errors.append({
            'type': ExceptionType.STATUS,
            'msg': '版本缺失：创建预约单需传递 version=1（新建版本）'
        })
    elif client_version != 1:
        errors.append({
            'type': ExceptionType.STATUS,
            'msg': f'状态冲突：创建预约单 version 必须为 1，提交 v{client_version}'
        })
    if not (payload.title or '').strip() or not (payload.experiment_name or '').strip():
        errors.append({
            'type': ExceptionType.MATERIAL,
            'msg': '材料问题：标题和实验名称均不能为空'
        })
    if errors:
        combined_msg = '；'.join([e['msg'] for e in errors])
        first_type = errors[0]['type'] if errors else ExceptionType.STATUS
        try:
            ProcessingRecord.objects.create(
                order=None, actor=user, action=ACTION_CREATE + '校验拦截',
                from_status='', to_status='',
                comment=combined_msg, opinion='', audit_note=combined_msg,
                exception_type=first_type, exception_desc=combined_msg,
                evidence_count=0, batch_id=''
            )
        except Exception:
            pass
        return {'ok': False, 'errors': errors}
    import random
    order_no = f'LAB-{timezone.now().strftime("%Y%m%d")}-{random.randint(1000,9999)}'
    while LabAppointment.objects.filter(order_no=order_no).exists():
        order_no = f'LAB-{timezone.now().strftime("%Y%m%d")}-{random.randint(1000,9999)}'
    order = LabAppointment.objects.create(
        order_no=order_no,
        title=payload.title,
        experiment_name=payload.experiment_name,
        experiment_room=payload.experiment_room,
        experiment_date=payload.experiment_date,
        student_count=payload.student_count,
        course_name=payload.course_name,
        teacher_name=payload.teacher_name,
        materials_requested=payload.materials_requested,
        safety_confirmed=payload.safety_confirmed,
        safety_note=payload.safety_note,
        priority=payload.priority,
        status=OrderStatus.DRAFT,
        deadline=payload.deadline,
        owner=user,
        current_handler=user,
        version=1,
    )
    evidence_count, audit_note_text, exc_type, exc_desc = persist_evidence_and_notes(order, user, payload)
    add_record_full(order, user, ACTION_CREATE, OrderStatus.DRAFT, OrderStatus.DRAFT,
                    comment=payload.comment or '创建预约单草稿',
                    opinion=payload.opinion,
                    audit_note=audit_note_text,
                    exception_type=exc_type,
                    exception_desc=exc_desc,
                    evidence_count=evidence_count)
    return {'ok': True, 'order': enrich_order(order)}


@api.put('/appointments/{order_id}')
def update_appointment(request, order_id: int, payload: AppointmentUpdateIn):
    user = get_current_user(request)
    try:
        order = LabAppointment.objects.select_for_update().get(id=order_id)
    except LabAppointment.DoesNotExist:
        raise HttpError(404, '预约单不存在')
    rule = RULES['update']
    errors = validate_write_action(user, order, payload, rule)
    if errors:
        add_block_record(order, user, ACTION_UPDATE + '校验拦截', errors)
        return {'ok': False, 'errors': errors}
    update_fields = payload.dict(exclude_unset=True)
    for skip_key in ('audit_comment', 'status', 'version'):
        update_fields.pop(skip_key, None)
    for k, v in update_fields.items():
        if hasattr(order, k) and v is not None:
            setattr(order, k, v)
    order.version += 1
    order.save()
    evidence_count, audit_note_text, exc_type, exc_desc = persist_evidence_and_notes(order, user, payload)
    add_record_full(order, user, ACTION_UPDATE, order.status, order.status,
                    comment=payload.audit_comment or '补正/更新预约单信息',
                    audit_note=audit_note_text, exception_type=exc_type,
                    exception_desc=exc_desc, evidence_count=evidence_count)
    return {'ok': True, 'order': enrich_order(order)}


@api.post('/appointments/{order_id}/submit')
def submit_appointment(request, order_id: int, payload: ActionIn):
    user = get_current_user(request)
    try:
        order = LabAppointment.objects.select_for_update().get(id=order_id)
    except LabAppointment.DoesNotExist:
        raise HttpError(404, '预约单不存在')
    rule = RULES['submit']
    errors = validate_write_action(user, order, payload, rule)
    if errors:
        add_block_record(order, user, ACTION_SUBMIT + '校验拦截', errors)
        return {'ok': False, 'errors': errors}
    evidence_count, audit_note_text, exc_type, exc_desc = persist_evidence_and_notes(order, user, payload)
    admins = User.objects.filter(role=Role.ADMIN)
    next_handler = admins.first() if admins.exists() else None
    if not next_handler:
        raise HttpError(500, '系统中没有实验室管理员账号')
    old = order.status
    order.status = OrderStatus.PENDING
    order.current_handler = next_handler
    order.version += 1
    order.save()
    add_record_full(order, user, ACTION_SUBMIT, old, OrderStatus.PENDING,
                    comment=payload.comment, opinion=payload.opinion,
                    audit_note=audit_note_text, exception_type=exc_type,
                    exception_desc=exc_desc, evidence_count=evidence_count)
    return {'ok': True, 'order': enrich_order(order)}


@api.post('/appointments/{order_id}/process')
def process_appointment(request, order_id: int, payload: ActionIn):
    user = get_current_user(request)
    try:
        order = LabAppointment.objects.select_for_update().get(id=order_id)
    except LabAppointment.DoesNotExist:
        raise HttpError(404, '预约单不存在')
    rule = RULES['process']
    errors = validate_write_action(user, order, payload, rule)
    if errors:
        add_block_record(order, user, ACTION_PROCESS + '校验拦截', errors)
        return {'ok': False, 'errors': errors}
    evidence_count, audit_note_text, exc_type, exc_desc = persist_evidence_and_notes(order, user, payload)
    deans = User.objects.filter(role=Role.DEAN)
    next_handler = deans.first() if deans.exists() else None
    if not next_handler:
        raise HttpError(500, '系统中没有学院负责人账号')
    old = order.status
    order.current_handler = next_handler
    order.version += 1
    order.save()
    add_record_full(order, user, ACTION_PROCESS, old, order.status,
                    comment=payload.comment, opinion=payload.opinion,
                    audit_note=audit_note_text, exception_type=exc_type,
                    exception_desc=exc_desc, evidence_count=evidence_count)
    return {'ok': True, 'order': enrich_order(order)}


@api.post('/appointments/{order_id}/review')
def review_appointment(request, order_id: int, payload: ActionIn):
    user = get_current_user(request)
    try:
        order = LabAppointment.objects.select_for_update().get(id=order_id)
    except LabAppointment.DoesNotExist:
        raise HttpError(404, '预约单不存在')
    rule = RULES['review']
    errors = validate_write_action(user, order, payload, rule)
    if errors:
        add_block_record(order, user, ACTION_REVIEW + '校验拦截', errors)
        return {'ok': False, 'errors': errors}
    evidence_count, audit_note_text, exc_type, exc_desc = persist_evidence_and_notes(order, user, payload)
    old = order.status
    order.status = OrderStatus.ARCHIVED
    order.current_handler = None
    order.version += 1
    order.save()
    add_record_full(order, user, ACTION_REVIEW, old, OrderStatus.ARCHIVED,
                    comment=payload.comment, opinion=payload.opinion,
                    audit_note=audit_note_text, exception_type=exc_type,
                    exception_desc=exc_desc, evidence_count=evidence_count)
    return {'ok': True, 'order': enrich_order(order)}


@api.post('/appointments/{order_id}/return')
def return_appointment(request, order_id: int, payload: ActionIn):
    user = get_current_user(request)
    try:
        order = LabAppointment.objects.select_for_update().get(id=order_id)
    except LabAppointment.DoesNotExist:
        raise HttpError(404, '预约单不存在')
    rule = RULES['return']
    errors = validate_write_action(user, order, payload, rule)
    if errors:
        add_block_record(order, user, ACTION_RETURN + '校验拦截', errors)
        return {'ok': False, 'errors': errors}
    evidence_count, audit_note_text, exc_type, exc_desc = persist_evidence_and_notes(order, user, payload)
    final_exc_type = exc_type or ExceptionType.STATUS
    final_exc_desc = exc_desc or payload.comment or '退回补正'
    if not exc_type and not exc_desc:
        ExceptionReason.objects.create(
            order=order, exception_type=final_exc_type,
            description=final_exc_desc, reporter=user
        )
    old = order.status
    order.status = OrderStatus.RETURNED
    order.current_handler = order.owner
    order.version += 1
    order.save()
    add_record_full(order, user, ACTION_RETURN, old, OrderStatus.RETURNED,
                    comment=payload.comment, opinion=payload.opinion,
                    audit_note=audit_note_text, exception_type=final_exc_type,
                    exception_desc=final_exc_desc, evidence_count=evidence_count)
    return {'ok': True, 'order': enrich_order(order)}


@api.post('/appointments/{order_id}/exception')
def add_exception(request, order_id: int, payload: ExceptionReasonIn):
    user = get_current_user(request)
    try:
        order = LabAppointment.objects.get(id=order_id)
    except LabAppointment.DoesNotExist:
        raise HttpError(404, '预约单不存在')
    exc = ExceptionReason.objects.create(
        order=order, exception_type=payload.exception_type,
        description=payload.description, reporter=user
    )
    add_record_full(order, user, '异常登记', order.status, order.status,
                    exception_type=payload.exception_type, exception_desc=payload.description)
    return {'ok': True, 'id': exc.id}


@api.post('/appointments/batch')
def batch_action(request, payload: BatchActionIn):
    user = get_current_user(request)
    rule_key = None
    if payload.action == 'archive_dean':
        rule_key = 'batch_archive'
    elif payload.action == 'return_dean':
        rule_key = 'batch_return'
    if rule_key not in RULES:
        return {'ok': False, 'success_count': 0, 'total': 0, 'items': [
            {'id': 0, 'ok': False, 'reason': f'权限问题：未知批量动作 {payload.action}', 'type': ExceptionType.PERMISSION}
        ]}
    rule = RULES[rule_key]
    batch_id = 'B' + uuid.uuid4().hex[:12].upper()
    results = []

    for oid in payload.ids:
        try:
            order = LabAppointment.objects.select_for_update().get(id=oid)
        except LabAppointment.DoesNotExist:
            results.append({'id': oid, 'ok': False, 'reason': '预约单不存在', 'type': ExceptionType.STATUS})
            continue
        item_opinion = payload.opinion_map.get(str(oid)) if payload.opinion_map else None
        item_audit = payload.audit_note_map.get(str(oid)) if payload.audit_note_map else None
        item_exc_type = payload.exception_type_map.get(str(oid)) if payload.exception_type_map else None
        item_exc_desc = payload.exception_desc_map.get(str(oid)) if payload.exception_desc_map else None

        class _ItemPayload:
            def __init__(self):
                self.version = None
                self.opinion = ''
                self.audit_note = ''
                self.attachments = []
                self.comment = ''
                self.exception_type = ''
                self.exception_desc = ''
        ip = _ItemPayload()
        cv = payload.version_map.get(str(oid)) if payload.version_map else None
        ip.version = int(cv) if cv is not None and cv != '' else None
        ip.opinion = item_opinion if item_opinion is not None else payload.opinion
        ip.audit_note = item_audit if item_audit is not None else payload.audit_note
        ip.exception_type = item_exc_type if item_exc_type else getattr(payload, 'exception_type', '') or ''
        ip.exception_desc = item_exc_desc if item_exc_desc else getattr(payload, 'exception_desc', '') or ''
        ip.comment = payload.comment or ''

        errors = validate_write_action(user, order, ip, rule)
        if errors:
            add_block_record(order, user, ACTION_BATCH_BLOCK, errors, batch_id=batch_id)
            reason = '；'.join(e['msg'] for e in errors)
            results.append({'id': oid, 'ok': False, 'reason': reason, 'type': errors[0]['type']})
            continue

        if rule_key == 'batch_archive':
            AuditNote.objects.create(order=order, author=user, content=ip.audit_note or f'批量归档审计备注[{batch_id}]')
            if ip.exception_type and ip.exception_desc:
                ExceptionReason.objects.create(
                    order=order, exception_type=ip.exception_type,
                    description=ip.exception_desc, reporter=user
                )
            old = order.status
            order.status = OrderStatus.ARCHIVED
            order.current_handler = None
            order.version += 1
            order.save()
            add_record_full(order, user, ACTION_BATCH_ARCHIVE, old, OrderStatus.ARCHIVED,
                            comment=ip.comment, opinion=ip.opinion,
                            audit_note=ip.audit_note, exception_type=ip.exception_type,
                            exception_desc=ip.exception_desc, evidence_count=0, batch_id=batch_id)
            results.append({'id': oid, 'ok': True, 'reason': '已归档', 'type': ''})
        elif rule_key == 'batch_return':
            final_exc_type = ip.exception_type or ExceptionType.STATUS
            final_exc_desc = ip.exception_desc or ip.comment or f'批量退回补正[{batch_id}]'
            ExceptionReason.objects.create(
                order=order, exception_type=final_exc_type,
                description=final_exc_desc, reporter=user
            )
            if ip.audit_note:
                AuditNote.objects.create(order=order, author=user, content=ip.audit_note)
            old = order.status
            order.status = OrderStatus.RETURNED
            order.current_handler = order.owner
            order.version += 1
            order.save()
            add_record_full(order, user, ACTION_BATCH_RETURN, old, OrderStatus.RETURNED,
                            comment=ip.comment, opinion=ip.opinion,
                            audit_note=ip.audit_note, exception_type=final_exc_type,
                            exception_desc=final_exc_desc, evidence_count=0, batch_id=batch_id)
            results.append({'id': oid, 'ok': True, 'reason': '已退回补正', 'type': ''})

    success_count = sum(1 for r in results if r['ok'])
    return {
        'ok': True, 'success_count': success_count, 'total': len(results),
        'batch_id': batch_id, 'items': results
    }

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


def validate_review(user: User, order: LabAppointment, payload: ActionIn):
    errors = []
    if order.current_handler_id and order.current_handler_id != user.id:
        errors.append({
            'type': 'PERMISSION',
            'msg': f'权限问题：当前处理人是 {order.current_handler.name}，你无权操作'
        })
    if order.deadline and order.deadline < timezone.now() and order.status != OrderStatus.ARCHIVED:
        errors.append({
            'type': 'TIMELIMIT',
            'msg': '时限问题：该单据已超过截止时间，需先补正后再提交'
        })
    if not payload.opinion.strip():
        errors.append({
            'type': 'MATERIAL',
            'msg': '材料问题：处理意见不能为空'
        })
    if not payload.audit_note.strip():
        errors.append({
            'type': 'MATERIAL',
            'msg': '材料问题：审计备注不能为空'
        })
    required_evidence = {
        OrderStatus.DRAFT: ['safety_confirm'],
        OrderStatus.PENDING: ['audit_note', 'opinion'],
    }
    need = required_evidence.get(order.status, [])
    if 'safety_confirm' in need and not order.safety_confirmed and not any(
        a.evidence_type == 'safety' for a in order.attachments.all()
    ) and not any(
        a.evidence_type == 'safety' for a in payload.attachments
    ):
        errors.append({
            'type': 'MATERIAL',
            'msg': '材料问题：缺少安全确认证据（安全确认书或勾选）'
        })
    if 'audit_note' in need and not payload.audit_note.strip():
        errors.append({
            'type': 'MATERIAL',
            'msg': '材料问题：复核阶段必须填写审计备注'
        })
    return errors


def add_record(order, user, action, from_status, to_status, comment='', opinion=''):
    ProcessingRecord.objects.create(
        order=order, actor=user, action=action,
        from_status=from_status, to_status=to_status,
        comment=comment, opinion=opinion
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


@api.post('/appointments', response=AppointmentOut)
def create_appointment(request, payload: AppointmentIn):
    user = get_current_user(request)
    if user.role not in (Role.TA, Role.ADMIN):
        raise HttpError(403, '只有实验助教或实验室管理员可以创建预约单')
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
    )
    add_record(order, user, '创建', OrderStatus.DRAFT, OrderStatus.DRAFT, '创建预约单')
    return enrich_order(order)


@api.put('/appointments/{order_id}', response=AppointmentOut)
def update_appointment(request, order_id: int, payload: AppointmentUpdateIn):
    user = get_current_user(request)
    try:
        order = LabAppointment.objects.select_for_update().get(id=order_id)
    except LabAppointment.DoesNotExist:
        raise HttpError(404, '预约单不存在')
    if user.role != Role.TA and order.owner_id != user.id:
        raise HttpError(403, '只有建单人可以编辑基础信息')
    if order.status not in (OrderStatus.DRAFT, OrderStatus.RETURNED):
        raise HttpError(400, '状态问题：只有草稿或退回补正状态才能编辑')
    update_fields = payload.dict(exclude_unset=True)
    if 'audit_comment' in update_fields:
        del update_fields['audit_comment']
    for k, v in update_fields.items():
        if hasattr(order, k) and v is not None:
            setattr(order, k, v)
    order.version += 1
    order.save()
    add_record(order, user, '更新', order.status, order.status, payload.audit_comment or '更新预约单信息')
    return enrich_order(order)


@api.post('/appointments/{order_id}/submit')
def submit_appointment(request, order_id: int, payload: ActionIn):
    user = get_current_user(request)
    try:
        order = LabAppointment.objects.select_for_update().get(id=order_id)
    except LabAppointment.DoesNotExist:
        raise HttpError(404, '预约单不存在')
    if order.version != payload.version:
        raise HttpError(409, f'状态冲突：当前版本 v{order.version}，你提交的是 v{payload.version}，请刷新重试')
    if user.role != Role.TA:
        raise HttpError(403, '权限问题：只有实验助教可以提交复核')
    if order.owner_id != user.id:
        raise HttpError(403, '权限问题：只能提交自己创建的预约单')
    if order.status not in (OrderStatus.DRAFT, OrderStatus.RETURNED):
        raise HttpError(400, '状态问题：当前状态不能提交复核')
    admins = User.objects.filter(role=Role.ADMIN)
    next_handler = admins.first() if admins.exists() else None
    if not next_handler:
        raise HttpError(500, '系统中没有实验室管理员账号')
    if not order.safety_confirmed and not any(
        a.evidence_type == 'safety' for a in order.attachments.all()
    ):
        raise HttpError(400, '材料问题：缺少安全确认，请勾选或上传安全确认书')
    if not order.experiment_name.strip() or not order.title.strip():
        raise HttpError(400, '材料问题：标题和实验名称不能为空')
    for att in payload.attachments:
        Attachment.objects.create(
            order=order, file_name=att.file_name, file_type=att.file_type,
            evidence_type=att.evidence_type, description=att.description,
            uploaded_by=user
        )
    if payload.audit_note.strip():
        AuditNote.objects.create(order=order, author=user, content=payload.audit_note)
    old = order.status
    order.status = OrderStatus.PENDING
    order.current_handler = next_handler
    order.version += 1
    order.save()
    add_record(order, user, '提交复核', old, OrderStatus.PENDING, payload.comment, payload.opinion)
    return {'ok': True, 'order': enrich_order(order)}


@api.post('/appointments/{order_id}/process')
def process_appointment(request, order_id: int, payload: ActionIn):
    user = get_current_user(request)
    try:
        order = LabAppointment.objects.select_for_update().get(id=order_id)
    except LabAppointment.DoesNotExist:
        raise HttpError(404, '预约单不存在')
    if order.version != payload.version:
        raise HttpError(409, f'状态冲突：当前版本 v{order.version}，你提交的是 v{payload.version}，请刷新重试')
    if user.role != Role.ADMIN:
        raise HttpError(403, '权限问题：只有实验室管理员可以办理预约单')
    if order.current_handler_id and order.current_handler_id != user.id:
        raise HttpError(403, f'权限问题：当前处理人是 {order.current_handler.name}')
    if order.status != OrderStatus.PENDING:
        raise HttpError(400, '状态问题：只有待复核状态可以办理')
    errors = validate_review(user, order, payload)
    if errors:
        return {'ok': False, 'errors': errors}
    for att in payload.attachments:
        Attachment.objects.create(
            order=order, file_name=att.file_name, file_type=att.file_type,
            evidence_type=att.evidence_type, description=att.description,
            uploaded_by=user
        )
    if payload.audit_note.strip():
        AuditNote.objects.create(order=order, author=user, content=payload.audit_note)
    if payload.exception_type.strip() and payload.exception_desc.strip():
        ExceptionReason.objects.create(
            order=order, exception_type=payload.exception_type,
            description=payload.exception_desc, reporter=user
        )
    deans = User.objects.filter(role=Role.DEAN)
    next_handler = deans.first() if deans.exists() else None
    if not next_handler:
        raise HttpError(500, '系统中没有学院负责人账号')
    old = order.status
    order.current_handler = next_handler
    order.version += 1
    order.save()
    add_record(order, user, '办理中核验', old, order.status, payload.comment, payload.opinion)
    return {'ok': True, 'order': enrich_order(order)}


@api.post('/appointments/{order_id}/review')
def review_appointment(request, order_id: int, payload: ActionIn):
    user = get_current_user(request)
    try:
        order = LabAppointment.objects.select_for_update().get(id=order_id)
    except LabAppointment.DoesNotExist:
        raise HttpError(404, '预约单不存在')
    if order.version != payload.version:
        raise HttpError(409, f'状态冲突：当前版本 v{order.version}，你提交的是 v{payload.version}，请刷新重试')
    if user.role != Role.DEAN:
        raise HttpError(403, '权限问题：只有学院负责人可以进行最终复核')
    if order.current_handler_id and order.current_handler_id != user.id:
        raise HttpError(403, f'权限问题：当前处理人是 {order.current_handler.name}')
    if order.status != OrderStatus.PENDING:
        raise HttpError(400, '状态问题：只有待复核状态可以复核')
    errors = validate_review(user, order, payload)
    if errors:
        return {'ok': False, 'errors': errors}
    for att in payload.attachments:
        Attachment.objects.create(
            order=order, file_name=att.file_name, file_type=att.file_type,
            evidence_type=att.evidence_type, description=att.description,
            uploaded_by=user
        )
    if payload.audit_note.strip():
        AuditNote.objects.create(order=order, author=user, content=payload.audit_note)
    if payload.exception_type.strip() and payload.exception_desc.strip():
        ExceptionReason.objects.create(
            order=order, exception_type=payload.exception_type,
            description=payload.exception_desc, reporter=user
        )
    old = order.status
    order.status = OrderStatus.ARCHIVED
    order.current_handler = None
    order.version += 1
    order.save()
    add_record(order, user, '复核归档', old, OrderStatus.ARCHIVED, payload.comment, payload.opinion)
    return {'ok': True, 'order': enrich_order(order)}


@api.post('/appointments/{order_id}/return')
def return_appointment(request, order_id: int, payload: ActionIn):
    user = get_current_user(request)
    try:
        order = LabAppointment.objects.select_for_update().get(id=order_id)
    except LabAppointment.DoesNotExist:
        raise HttpError(404, '预约单不存在')
    if order.version != payload.version:
        raise HttpError(409, f'状态冲突：当前版本 v{order.version}，你提交的是 v{payload.version}，请刷新重试')
    if user.role not in (Role.ADMIN, Role.DEAN):
        raise HttpError(403, '权限问题：只有管理员或负责人可以退回')
    if order.status != OrderStatus.PENDING:
        raise HttpError(400, '状态问题：只有待复核状态可以退回')
    if not payload.comment.strip():
        raise HttpError(400, '材料问题：退回必须填写退回原因')
    if payload.exception_type.strip() and payload.exception_desc.strip():
        ExceptionReason.objects.create(
            order=order, exception_type=payload.exception_type,
            description=payload.exception_desc, reporter=user
        )
    elif payload.comment.strip():
        ExceptionReason.objects.create(
            order=order, exception_type=payload.exception_type or ExceptionType.STATUS,
            description=payload.comment, reporter=user
        )
    if payload.audit_note.strip():
        AuditNote.objects.create(order=order, author=user, content=payload.audit_note)
    old = order.status
    order.status = OrderStatus.RETURNED
    order.current_handler = order.owner
    order.version += 1
    order.save()
    add_record(order, user, '退回补正', old, OrderStatus.RETURNED, payload.comment, payload.opinion)
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
    return {'ok': True, 'id': exc.id}


@api.post('/appointments/batch')
def batch_action(request, payload: BatchActionIn):
    user = get_current_user(request)
    results = []
    for oid in payload.ids:
        try:
            order = LabAppointment.objects.select_for_update().get(id=oid)
        except LabAppointment.DoesNotExist:
            results.append({'id': oid, 'ok': False, 'reason': '预约单不存在'})
            continue
        client_version = payload.version_map.get(str(oid)) if payload.version_map else None
        if client_version is not None and int(client_version) != order.version:
            results.append({
                'id': oid, 'ok': False,
                'reason': f'状态冲突/旧版本：当前v{order.version}，提交v{client_version}'
            })
            continue
        if payload.action == 'archive_dean' and user.role == Role.DEAN:
            if order.status != OrderStatus.PENDING:
                results.append({'id': oid, 'ok': False, 'reason': f'状态问题：{order.get_status_display()}不能归档'})
                continue
            if order.current_handler_id and order.current_handler_id != user.id:
                results.append({'id': oid, 'ok': False, 'reason': f'权限问题：当前处理人是{order.current_handler.name}'})
                continue
            if order.deadline and order.deadline < timezone.now():
                results.append({'id': oid, 'ok': False, 'reason': '时限问题：已逾期，需先补正'})
                continue
            old = order.status
            order.status = OrderStatus.ARCHIVED
            order.current_handler = None
            order.version += 1
            order.save()
            add_record(order, user, '批量归档', old, OrderStatus.ARCHIVED, payload.comment, payload.opinion)
            results.append({'id': oid, 'ok': True, 'reason': '已归档'})
        elif payload.action == 'return_dean' and user.role == Role.DEAN:
            if order.status != OrderStatus.PENDING:
                results.append({'id': oid, 'ok': False, 'reason': f'状态问题：{order.get_status_display()}不能退回'})
                continue
            old = order.status
            order.status = OrderStatus.RETURNED
            order.current_handler = order.owner
            order.version += 1
            order.save()
            add_record(order, user, '批量退回', old, OrderStatus.RETURNED, payload.comment or '批量退回', payload.opinion)
            ExceptionReason.objects.create(
                order=order, exception_type=ExceptionType.STATUS,
                description=payload.comment or '批量退回补正', reporter=user
            )
            results.append({'id': oid, 'ok': True, 'reason': '已退回补正'})
        else:
            results.append({'id': oid, 'ok': False, 'reason': f'权限问题：当前角色不支持该操作'})
    success = sum(1 for r in results if r['ok'])
    return {'ok': True, 'success_count': success, 'total': len(results), 'items': results}

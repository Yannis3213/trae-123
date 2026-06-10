from ninja import Router, Schema, Field, Query
from django.http import HttpRequest, JsonResponse
from django.utils import timezone
from typing import List, Optional
from datetime import datetime

from .models import (
    MaterialChangeOrder, ProcessingRecord, Attachment,
    AuditRemark, ExceptionRecord, BOMChangeRecord,
    MaterialSubstituteRecord, PilotVerifyRecord, UserProfile,
    STATUS_CHOICES, CHANGE_TYPE_CHOICES, URGENCY_CHOICES, WARN_STATUS_CHOICES
)
from .services import OrderService, STATUS_FLOW

router = Router(tags=['物料变更单'])


class OrderListSchema(Schema):
    id: int
    order_no: str
    title: str
    status: str
    status_display: str
    change_type: str
    change_type_display: str
    urgency: str
    urgency_display: str
    warn_status: str
    warn_status_display: str
    old_material_code: str
    old_material_name: str
    new_material_code: str
    new_material_name: str
    created_at: datetime
    deadline: Optional[datetime]
    current_handler: Optional[str]
    created_by: Optional[str]
    version: int


class OrderDetailSchema(Schema):
    id: int
    order_no: str
    title: str
    status: str
    status_display: str
    change_type: str
    change_type_display: str
    urgency: str
    urgency_display: str
    warn_status: str
    warn_status_display: str

    old_material_code: str
    old_material_name: str
    old_material_spec: str
    new_material_code: str
    new_material_name: str
    new_material_spec: str

    bom_reference: str
    product_model: str
    change_reason: str
    change_description: str

    bom_evidence_ready: bool
    substitute_evidence_ready: bool
    pilot_evidence_ready: bool

    return_reason: str
    correction_reason: str

    submit_time: Optional[datetime]
    deadline: Optional[datetime]
    last_approve_time: Optional[datetime]

    version: int
    created_at: datetime
    updated_at: datetime

    current_handler: Optional[dict]
    created_by: Optional[dict]

    available_actions: List[dict]
    can_edit: bool
    can_return: bool


class ProcessingRecordSchema(Schema):
    id: int
    action: str
    action_display: str
    from_status: str
    from_status_display: str
    to_status: str
    to_status_display: str
    comment: str
    version: int
    created_at: datetime
    operator: Optional[str]


class ExceptionRecordSchema(Schema):
    id: int
    exception_type: str
    exception_code: str
    description: str
    responsible_role: str
    responsible_user: Optional[str]
    resolved: bool
    created_at: datetime


class AttachmentSchema(Schema):
    id: int
    file_name: str
    file_url: str
    file_type: str
    category: str
    created_at: datetime


class BOMRecordSchema(Schema):
    id: int
    bom_no: str
    bom_version: str
    change_items: str
    evidence_url: str
    remark: str
    confirmed_by: Optional[str]
    confirmed_at: Optional[datetime]
    created_at: datetime


class SubstituteRecordSchema(Schema):
    id: int
    substitute_plan: str
    substitute_result: str
    evidence_url: str
    remark: str
    checked_by: Optional[str]
    checked_at: Optional[datetime]
    created_at: datetime


class PilotRecordSchema(Schema):
    id: int
    pilot_plan: str
    pilot_result: str
    pilot_quantity: int
    pass_rate: float
    evidence_url: str
    remark: str
    verified_by: Optional[str]
    verified_at: Optional[datetime]
    created_at: datetime


class OrderFilterSchema(Schema):
    status: Optional[str] = None
    warn_status: Optional[str] = None
    change_type: Optional[str] = None
    urgency: Optional[str] = None
    keyword: Optional[str] = None
    mine: Optional[bool] = False
    page: int = 1
    page_size: int = 20


class CreateOrderSchema(Schema):
    title: str
    change_type: str = 'bom_change'
    urgency: str = 'normal'
    old_material_code: str = ''
    old_material_name: str = ''
    old_material_spec: str = ''
    new_material_code: str = ''
    new_material_name: str = ''
    new_material_spec: str = ''
    bom_reference: str = ''
    product_model: str = ''
    change_reason: str = ''
    change_description: str = ''
    deadline: Optional[datetime] = None


class UpdateOrderSchema(Schema):
    title: Optional[str] = None
    change_type: Optional[str] = None
    urgency: Optional[str] = None
    old_material_code: Optional[str] = None
    old_material_name: Optional[str] = None
    old_material_spec: Optional[str] = None
    new_material_code: Optional[str] = None
    new_material_name: Optional[str] = None
    new_material_spec: Optional[str] = None
    bom_reference: Optional[str] = None
    product_model: Optional[str] = None
    change_reason: Optional[str] = None
    change_description: Optional[str] = None
    deadline: Optional[datetime] = None
    bom_evidence_ready: Optional[bool] = None
    substitute_evidence_ready: Optional[bool] = None
    pilot_evidence_ready: Optional[bool] = None


class ActionSchema(Schema):
    action: str
    comment: str = ''
    return_reason: str = ''
    correction_reason: str = ''
    expected_version: Optional[int] = None


class BatchActionSchema(Schema):
    order_ids: List[int]
    action: str
    comment: str = ''
    return_reason: str = ''
    expected_versions: Optional[dict] = None


class BatchResultSchema(Schema):
    order_id: int
    success: bool
    message: str
    code: str = ''


class EvidenceSchema(Schema):
    bom_no: str = ''
    bom_version: str = ''
    change_items: str = ''
    substitute_plan: str = ''
    substitute_result: str = ''
    pilot_plan: str = ''
    pilot_result: str = ''
    pilot_quantity: int = 0
    pass_rate: float = 0.0
    evidence_url: str = ''
    remark: str = ''


def _status_display(status):
    for s, d in STATUS_CHOICES:
        if s == status:
            return d
    return status


def _change_type_display(ct):
    for c, d in CHANGE_TYPE_CHOICES:
        if c == ct:
            return d
    return ct


def _urgency_display(u):
    for c, d in URGENCY_CHOICES:
        if c == u:
            return d
    return u


def _warn_display(w):
    for c, d in WARN_STATUS_CHOICES:
        if c == w:
            return d
    return w


def _role_display(r):
    from .models import ROLE_CHOICES
    for c, d in ROLE_CHOICES:
        if c == r:
            return d
    return r


def _serialize_order_list(order):
    return {
        'id': order.id,
        'order_no': order.order_no,
        'title': order.title,
        'status': order.status,
        'status_display': _status_display(order.status),
        'change_type': order.change_type,
        'change_type_display': _change_type_display(order.change_type),
        'urgency': order.urgency,
        'urgency_display': _urgency_display(order.urgency),
        'warn_status': order.warn_status,
        'warn_status_display': _warn_display(order.warn_status),
        'old_material_code': order.old_material_code,
        'old_material_name': order.old_material_name,
        'new_material_code': order.new_material_code,
        'new_material_name': order.new_material_name,
        'created_at': order.created_at,
        'deadline': order.deadline,
        'current_handler': order.current_handler.real_name if order.current_handler else None,
        'current_handler_id': order.current_handler.id if order.current_handler else None,
        'created_by': order.created_by.real_name if order.created_by else None,
        'version': order.version,
    }


def _get_available_actions(profile, order):
    actions = []
    if not profile:
        return actions

    status = order.status
    flow = STATUS_FLOW.get(status)
    if flow and profile.role in flow.get('required_roles', []):
        can_do = True
        if order.current_handler_id and order.current_handler_id != profile.id:
            can_do = False
        if can_do:
            actions.append({
                'action': flow['action'],
                'label': flow['action_display'],
                'type': 'primary',
            })

    from .services import RETURNABLE_STATUSES, RETURN_ROLES
    if status in RETURNABLE_STATUSES:
        roles = RETURN_ROLES.get(status, [])
        if profile.role in roles:
            actions.append({
                'action': 'return',
                'label': '退回',
                'type': 'danger',
            })

    if status in ['draft', 'returned'] and profile.role == 'registrar':
        if order.created_by_id == profile.id or status == 'returned':
            actions.append({
                'action': 'correct',
                'label': '补正修改',
                'type': 'warning',
            })

    return actions


def _can_edit(profile, order):
    if not profile:
        return False
    if profile.role == 'registrar' and order.status in ['draft', 'returned']:
        return True
    return False


def _can_return(profile, order):
    from .services import RETURNABLE_STATUSES, RETURN_ROLES
    if order.status not in RETURNABLE_STATUSES:
        return False
    roles = RETURN_ROLES.get(order.status, [])
    return profile.role in roles if profile else False


@router.get('/orders', response=List[OrderListSchema])
def list_orders(request: HttpRequest, filters: Query[OrderFilterSchema]):
    profile = OrderService.get_user_profile(request.user)
    if not profile:
        return []

    filter_dict = filters.dict()
    page = filter_dict.pop('page', 1)
    page_size = filter_dict.pop('page_size', 20)

    qs = OrderService.list_orders(profile, filter_dict)
    qs = qs.order_by('-created_at')

    start = (page - 1) * page_size
    end = start + page_size
    orders = qs[start:end]

    return [_serialize_order_list(o) for o in orders]


@router.get('/orders/count')
def count_orders(request: HttpRequest, filters: Query[OrderFilterSchema]):
    profile = OrderService.get_user_profile(request.user)
    if not profile:
        return {'count': 0}

    filter_dict = filters.dict()
    filter_dict.pop('page', None)
    filter_dict.pop('page_size', None)

    qs = OrderService.list_orders(profile, filter_dict)
    return {'count': qs.count()}


@router.get('/orders/statistics')
def get_statistics(request: HttpRequest):
    profile = OrderService.get_user_profile(request.user)
    if not profile:
        return {'total': 0, 'by_status': {}, 'warn_normal': 0, 'warn_near_deadline': 0, 'warn_overdue': 0}
    stats = OrderService.get_statistics(profile)

    status_display_stats = {}
    for k, v in stats['by_status'].items():
        status_display_stats[_status_display(k)] = v
    stats['by_status_display'] = status_display_stats

    return stats


@router.get('/orders/{order_id}', response=OrderDetailSchema)
def get_order_detail(request: HttpRequest, order_id: int):
    profile = OrderService.get_user_profile(request.user)
    try:
        order = MaterialChangeOrder.objects.get(id=order_id)
    except MaterialChangeOrder.DoesNotExist:
        return JsonResponse({'error': '不存在'}, status=404)

    if not OrderService.can_view_order(profile, order):
        return JsonResponse({'error': '无权限查看'}, status=403)

    return {
        'id': order.id,
        'order_no': order.order_no,
        'title': order.title,
        'status': order.status,
        'status_display': _status_display(order.status),
        'change_type': order.change_type,
        'change_type_display': _change_type_display(order.change_type),
        'urgency': order.urgency,
        'urgency_display': _urgency_display(order.urgency),
        'warn_status': order.warn_status,
        'warn_status_display': _warn_display(order.warn_status),
        'old_material_code': order.old_material_code,
        'old_material_name': order.old_material_name,
        'old_material_spec': order.old_material_spec,
        'new_material_code': order.new_material_code,
        'new_material_name': order.new_material_name,
        'new_material_spec': order.new_material_spec,
        'bom_reference': order.bom_reference,
        'product_model': order.product_model,
        'change_reason': order.change_reason,
        'change_description': order.change_description,
        'bom_evidence_ready': order.bom_evidence_ready,
        'substitute_evidence_ready': order.substitute_evidence_ready,
        'pilot_evidence_ready': order.pilot_evidence_ready,
        'return_reason': order.return_reason,
        'correction_reason': order.correction_reason,
        'submit_time': order.submit_time,
        'deadline': order.deadline,
        'last_approve_time': order.last_approve_time,
        'version': order.version,
        'created_at': order.created_at,
        'updated_at': order.updated_at,
        'current_handler': {
            'id': order.current_handler.id,
            'name': order.current_handler.real_name,
            'role': order.current_handler.role,
            'role_display': _role_display(order.current_handler.role),
        } if order.current_handler else None,
        'created_by': {
            'id': order.created_by.id,
            'name': order.created_by.real_name,
            'role': order.created_by.role,
            'role_display': _role_display(order.created_by.role),
        } if order.created_by else None,
        'available_actions': _get_available_actions(profile, order),
        'can_edit': _can_edit(profile, order),
        'can_return': _can_return(profile, order),
    }


@router.get('/orders/{order_id}/records')
def get_processing_records(request: HttpRequest, order_id: int):
    profile = OrderService.get_user_profile(request.user)
    try:
        order = MaterialChangeOrder.objects.get(id=order_id)
    except MaterialChangeOrder.DoesNotExist:
        return []

    if not OrderService.can_view_order(profile, order):
        return []

    records = ProcessingRecord.objects.filter(order=order).order_by('-created_at')
    result = []
    for r in records:
        result.append({
            'id': r.id,
            'action': r.action,
            'action_display': r.action_display,
            'from_status': r.from_status,
            'from_status_display': _status_display(r.from_status),
            'to_status': r.to_status,
            'to_status_display': _status_display(r.to_status),
            'comment': r.comment,
            'version': r.version,
            'created_at': r.created_at,
            'operator': r.operator.real_name if r.operator else None,
        })
    return result


@router.get('/orders/{order_id}/exceptions')
def get_exception_records(request: HttpRequest, order_id: int):
    profile = OrderService.get_user_profile(request.user)
    try:
        order = MaterialChangeOrder.objects.get(id=order_id)
    except MaterialChangeOrder.DoesNotExist:
        return []
    if not OrderService.can_view_order(profile, order):
        return []
    records = ExceptionRecord.objects.filter(order=order).order_by('-created_at')
    result = []
    for r in records:
        result.append({
            'id': r.id,
            'exception_type': r.exception_type,
            'exception_code': r.exception_code,
            'description': r.description,
            'responsible_role': r.responsible_role,
            'responsible_user': r.responsible_user.real_name if r.responsible_user else None,
            'resolved': r.resolved,
            'created_at': r.created_at,
        })
    return result


@router.get('/orders/{order_id}/attachments')
def get_attachments(request: HttpRequest, order_id: int):
    profile = OrderService.get_user_profile(request.user)
    try:
        order = MaterialChangeOrder.objects.get(id=order_id)
    except MaterialChangeOrder.DoesNotExist:
        return []
    if not OrderService.can_view_order(profile, order):
        return []
    records = Attachment.objects.filter(order=order).order_by('-created_at')
    return [
        {
            'id': r.id,
            'file_name': r.file_name,
            'file_url': r.file_url,
            'file_type': r.file_type,
            'category': r.category,
            'created_at': r.created_at,
        }
        for r in records
    ]


@router.get('/orders/{order_id}/bom-records')
def get_bom_records(request: HttpRequest, order_id: int):
    profile = OrderService.get_user_profile(request.user)
    try:
        order = MaterialChangeOrder.objects.get(id=order_id)
    except MaterialChangeOrder.DoesNotExist:
        return []
    if not OrderService.can_view_order(profile, order):
        return []
    records = BOMChangeRecord.objects.filter(order=order).order_by('-created_at')
    return [
        {
            'id': r.id,
            'bom_no': r.bom_no,
            'bom_version': r.bom_version,
            'change_items': r.change_items,
            'evidence_url': r.evidence_url,
            'remark': r.remark,
            'confirmed_by': r.confirmed_by.real_name if r.confirmed_by else None,
            'confirmed_at': r.confirmed_at,
            'created_at': r.created_at,
        }
        for r in records
    ]


@router.get('/orders/{order_id}/substitute-records')
def get_substitute_records(request: HttpRequest, order_id: int):
    profile = OrderService.get_user_profile(request.user)
    try:
        order = MaterialChangeOrder.objects.get(id=order_id)
    except MaterialChangeOrder.DoesNotExist:
        return []
    if not OrderService.can_view_order(profile, order):
        return []
    records = MaterialSubstituteRecord.objects.filter(order=order).order_by('-created_at')
    return [
        {
            'id': r.id,
            'substitute_plan': r.substitute_plan,
            'substitute_result': r.substitute_result,
            'evidence_url': r.evidence_url,
            'remark': r.remark,
            'checked_by': r.checked_by.real_name if r.checked_by else None,
            'checked_at': r.checked_at,
            'created_at': r.created_at,
        }
        for r in records
    ]


@router.get('/orders/{order_id}/pilot-records')
def get_pilot_records(request: HttpRequest, order_id: int):
    profile = OrderService.get_user_profile(request.user)
    try:
        order = MaterialChangeOrder.objects.get(id=order_id)
    except MaterialChangeOrder.DoesNotExist:
        return []
    if not OrderService.can_view_order(profile, order):
        return []
    records = PilotVerifyRecord.objects.filter(order=order).order_by('-created_at')
    return [
        {
            'id': r.id,
            'pilot_plan': r.pilot_plan,
            'pilot_result': r.pilot_result,
            'pilot_quantity': r.pilot_quantity,
            'pass_rate': r.pass_rate,
            'evidence_url': r.evidence_url,
            'remark': r.remark,
            'verified_by': r.verified_by.real_name if r.verified_by else None,
            'verified_at': r.verified_at,
            'created_at': r.created_at,
        }
        for r in records
    ]


@router.post('/orders')
def create_order(request: HttpRequest, payload: CreateOrderSchema):
    profile = OrderService.get_user_profile(request.user)
    result = OrderService.create_order(profile, payload.dict())
    status_code = 200 if result.get('success') else 400
    return JsonResponse( result, status=status_code)


@router.put('/orders/{order_id}')
def update_order(request: HttpRequest, order_id: int, payload: UpdateOrderSchema):
    profile = OrderService.get_user_profile(request.user)
    if not profile:
        return JsonResponse( {'success': False, 'message': '未登录'}, status=401)
    try:
        order = MaterialChangeOrder.objects.get(id=order_id)
    except MaterialChangeOrder.DoesNotExist:
        return JsonResponse( {'success': False, 'message': '不存在'}, status=404)
    if not _can_edit(profile, order):
        return JsonResponse( {'success': False, 'message': '无权限编辑'}, status=403)

    data = payload.dict(exclude_unset=True)
    for k, v in data.items():
        if hasattr(order, k):
            setattr(order, k, v)
    order.version += 1
    order.save()
    order.update_warn_status()
    order.save(update_fields=['warn_status'])

    ProcessingRecord.objects.create(
        order=order,
        operator=profile,
        action='update',
        action_display='编辑',
        from_status=order.status,
        to_status=order.status,
        comment='编辑物料变更单',
        version=order.version,
    )

    return {'success': True, 'message': '保存成功'}


@router.post('/orders/{order_id}/action')
def order_action(request: HttpRequest, order_id: int, payload: ActionSchema):
    profile = OrderService.get_user_profile(request.user)
    if not profile:
        return JsonResponse( {'success': False, 'message': '未登录'}, status=401)

    result = OrderService.process_action(
        order_id, profile, payload.action,
        {
            'comment': payload.comment,
            'return_reason': payload.return_reason,
            'correction_reason': payload.correction_reason,
        },
        payload.expected_version
    )

    status_code = 200 if result.get('success') else 400
    return JsonResponse( result, status=status_code)


@router.post('/orders/batch-action', response=List[BatchResultSchema])
def batch_action(request: HttpRequest, payload: BatchActionSchema):
    profile = OrderService.get_user_profile(request.user)
    if not profile:
        return JsonResponse( [], status=401)

    results = OrderService.batch_process(
        payload.order_ids, profile, payload.action,
        {
            'comment': payload.comment,
            'return_reason': payload.return_reason,
        },
        payload.expected_versions
    )
    return results


@router.post('/orders/{order_id}/evidence/{evidence_type}')
def save_evidence(request: HttpRequest, order_id: int, evidence_type: str, payload: EvidenceSchema):
    profile = OrderService.get_user_profile(request.user)
    if not profile:
        return JsonResponse( {'success': False, 'message': '未登录'}, status=401)

    result = OrderService.save_evidence(order_id, profile, evidence_type, payload.dict())
    status_code = 200 if result.get('success') else 400
    return JsonResponse( result, status=status_code)


@router.post('/orders/refresh-warnings')
def refresh_warnings(request: HttpRequest):
    profile = OrderService.get_user_profile(request.user)
    if not profile:
        return JsonResponse( {'success': False, 'message': '未登录'}, status=401)
    count = OrderService.update_all_warn_status()
    return {'success': True, 'updated': count}


@router.get('/meta/status-options')
def status_options(request: HttpRequest):
    return [{'value': s, 'label': d} for s, d in STATUS_CHOICES]


@router.get('/meta/change-type-options')
def change_type_options(request: HttpRequest):
    return [{'value': s, 'label': d} for s, d in CHANGE_TYPE_CHOICES]


@router.get('/meta/urgency-options')
def urgency_options(request: HttpRequest):
    return [{'value': s, 'label': d} for s, d in URGENCY_CHOICES]


@router.get('/meta/warn-options')
def warn_options(request: HttpRequest):
    return [{'value': s, 'label': d} for s, d in WARN_STATUS_CHOICES]


@router.get('/orders/{order_id}/audit-remarks')
def get_audit_remarks(request: HttpRequest, order_id: int):
    profile = OrderService.get_user_profile(request.user)
    try:
        order = MaterialChangeOrder.objects.get(id=order_id)
    except MaterialChangeOrder.DoesNotExist:
        return []
    if not OrderService.can_view_order(profile, order):
        return []
    records = AuditRemark.objects.filter(order=order).order_by('-created_at')
    result = []
    for r in records:
        result.append({
            'id': r.id,
            'content': r.content,
            'remark_type': r.remark_type,
            'operator': r.operator.real_name if r.operator else None,
            'created_at': r.created_at,
        })
    return result

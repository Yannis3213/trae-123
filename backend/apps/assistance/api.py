from typing import Optional, List
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.http import HttpRequest
from ninja import NinjaAPI, Schema
from ninja.security import HttpBasicAuth
from .models import AssistanceApplication, UserProfile, Attachment, ExceptionLog as ExceptionLogModel
from .schemas import (
    UserSchema, LoginSchema, ApplicationListSchema, ApplicationDetailSchema,
    ApplicationCreateSchema, ApplicationProcessSchema, BatchProcessSchema,
    BatchProcessResult, WarningStatsSchema, ApplicationFilterSchema,
    AttachmentUploadSchema, ExceptionLogSchema
)
from .services import (
    BusinessException, get_user_role, get_role_name,
    build_application_list_schema, build_application_detail_schema,
    create_application, process_application_action, process_batch,
    get_warning_stats, get_application_list, create_exception_log,
    create_audit_note
)


api = NinjaAPI(title='街道办事处-月底集中处理帮扶申请系统', version='1.0.0')


class BasicAuth(HttpBasicAuth):
    def authenticate(self, request, username, password):
        user = authenticate(username=username, password=password)
        if user:
            return user
        return None


auth = BasicAuth()


class ErrorSchema(Schema):
    error_code: str
    error_message: str


@api.exception_handler(BusinessException)
def business_exception_handler(request, exc):
    return api.create_response(
        request,
        {'error_code': exc.error_code, 'error_message': exc.error_message},
        status=400
    )


@api.exception_handler(Exception)
def general_exception_handler(request, exc):
    user = getattr(request, 'auth', None)
    if user:
        create_exception_log(
            operator=user,
            exception_type='system_error',
            error_code='SYSTEM_ERROR',
            error_message=str(exc),
            request_data=request.path
        )
    return api.create_response(
        request,
        {'error_code': 'SYSTEM_ERROR', 'error_message': str(exc)},
        status=500
    )


@api.post('/auth/login', response=UserSchema)
def login(request, payload: LoginSchema):
    user = authenticate(username=payload.username, password=payload.password)
    if not user:
        raise BusinessException('AUTH_FAILED', '用户名或密码错误')

    role = get_user_role(user)
    if not role:
        raise BusinessException('NO_ROLE', '用户未分配角色')

    return {
        'id': user.id,
        'username': user.username,
        'role': role,
        'role_name': get_role_name(role),
        'department': user.profile.department if hasattr(user, 'profile') else None,
    }


@api.get('/auth/me', auth=auth, response=UserSchema)
def get_current_user(request):
    user = request.auth
    role = get_user_role(user)
    return {
        'id': user.id,
        'username': user.username,
        'role': role,
        'role_name': get_role_name(role),
        'department': user.profile.department if hasattr(user, 'profile') else None,
    }


@api.get('/applications', auth=auth, response=list[ApplicationListSchema])
def list_applications(
    request,
    status: Optional[str] = None,
    current_node: Optional[str] = None,
    warning_status: Optional[str] = None,
    community: Optional[str] = None,
    keyword: Optional[str] = None
):
    user = request.auth
    return get_application_list(
        user=user,
        status=status,
        current_node=current_node,
        warning_status=warning_status,
        community=community,
        keyword=keyword
    )


@api.post('/applications', auth=auth, response=ApplicationDetailSchema)
def create_new_application(request, payload: ApplicationCreateSchema):
    user = request.auth
    application = create_application(user, payload.dict())
    return build_application_detail_schema(application)


@api.post('/applications/process', auth=auth, response=ApplicationDetailSchema)
def process_single_application(request, payload: ApplicationProcessSchema):
    user = request.auth
    try:
        application = AssistanceApplication.objects.select_for_update().get(
            id=payload.application_id
        )
    except AssistanceApplication.DoesNotExist:
        raise BusinessException('NOT_FOUND', '帮扶申请不存在')

    application, record = process_application_action(
        user=user,
        application=application,
        action=payload.action,
        version=payload.version,
        comment=payload.comment or '',
        evidence_required=payload.evidence_required
    )

    return build_application_detail_schema(application)


@api.post('/applications/batch-process', auth=auth, response=BatchProcessResult)
def batch_process_applications(request, payload: BatchProcessSchema):
    user = request.auth
    items = [item.dict() for item in payload.items]
    return process_batch(user, items)


@api.get('/applications/export', auth=auth)
def export_applications(request):
    raise BusinessException('NOT_IMPLEMENTED', '导出功能暂未开放，请使用主流程功能')


@api.post('/applications/attachments', auth=auth, response=ApplicationDetailSchema)
def upload_attachment(request, payload: AttachmentUploadSchema):
    user = request.auth
    role = get_user_role(user)

    try:
        application = AssistanceApplication.objects.get(id=payload.application_id)
    except AssistanceApplication.DoesNotExist:
        raise BusinessException('NOT_FOUND', '帮扶申请不存在')

    if role == 'community_worker' and application.creator_id != user.id:
        raise BusinessException('PERMISSION_DENIED', '只有申请人可以上传补正材料')

    if application.status not in ['returned', 'pending']:
        raise BusinessException('STATUS_CONFLICT', '当前状态不允许上传材料，仅退回补正或待接单状态可上传')

    Attachment.objects.create(
        application=application,
        file_name=payload.file_name,
        file_type='application/pdf',
        file_path=f'/uploads/{application.application_no}/{payload.file_name}',
        file_size=1024 * 100,
        uploaded_by=user,
        evidence_type=payload.evidence_type,
        is_required=payload.is_required,
    )

    create_audit_note(
        application=application,
        note_type='evidence_upload',
        content=f'上传补正材料：{payload.file_name}（类型：{payload.evidence_type}）',
        operator=user,
    )

    application.version += 1
    application.save()

    return build_application_detail_schema(application)


@api.get('/applications/{application_id}/exceptions', auth=auth, response=List[ExceptionLogSchema])
def get_application_exceptions(request, application_id: int):
    user = request.auth
    try:
        application = AssistanceApplication.objects.get(id=application_id)
    except AssistanceApplication.DoesNotExist:
        raise BusinessException('NOT_FOUND', '帮扶申请不存在')

    role = get_user_role(user)
    if role == 'community_worker' and application.creator_id != user.id:
        raise BusinessException('PERMISSION_DENIED', '您无权查看此申请的异常记录')

    logs = application.exception_logs.all()
    return [
        {
            'id': log.id,
            'application_no': application.application_no,
            'exception_type': log.exception_type,
            'error_code': log.error_code,
            'error_message': log.error_message,
            'operator': log.operator.username,
            'resolved': log.resolved,
            'created_at': log.created_at,
        }
        for log in logs
    ]


@api.get('/warning/stats', auth=auth, response=WarningStatsSchema)
def get_warning_statistics(request):
    user = request.auth
    return get_warning_stats(user)


@api.get('/applications/{application_id}', auth=auth, response=ApplicationDetailSchema)
def get_application(request, application_id: int):
    user = request.auth
    try:
        application = AssistanceApplication.objects.get(id=application_id)
    except AssistanceApplication.DoesNotExist:
        raise BusinessException('NOT_FOUND', '帮扶申请不存在')

    role = get_user_role(user)
    if role == 'community_worker' and application.creator_id != user.id:
        raise BusinessException('PERMISSION_DENIED', '您无权查看此申请')
    elif role in ['street_clerk', 'leader']:
        if application.current_handler_id and application.current_handler_id != user.id:
            if not (role == 'street_clerk' and application.street_clerk_id == user.id):
                if not (role == 'leader' and application.leader_id == user.id):
                    raise BusinessException('PERMISSION_DENIED', '您无权查看此申请')

    return build_application_detail_schema(application)


@api.get('/statistics', auth=auth)
def get_statistics(request):
    raise BusinessException('NOT_IMPLEMENTED', '统计功能暂未开放，请使用主流程功能')


@api.get('/notifications', auth=auth)
def get_notifications(request):
    raise BusinessException('NOT_IMPLEMENTED', '通知功能暂未开放，请使用主流程功能')

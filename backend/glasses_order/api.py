import secrets
from datetime import timedelta
from typing import List, Optional

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q, Count
from django.utils import timezone
from ninja import NinjaAPI, Schema, File, UploadedFile
from ninja.security import HttpBearer

from .models import (
    UserProfile, GlassesOrder, OptometryRecord, LensOrder,
    OrderRegistration, Attachment, ProcessingRecord, AuditNote, ExceptionReason
)
from .schemas import (
    UserOut, LoginIn, LoginOut,
    GlassesOrderListSchema, GlassesOrderDetailSchema, GlassesOrderCreateSchema,
    OptometryRecordSchema, LensOrderSchema, OrderRegistrationSchema,
    AttachmentSchema, ProcessingRecordSchema, AuditNoteSchema, ExceptionReasonSchema,
    OrderReviewSchema, OrderCorrectSchema, BatchProcessSchema, BatchResultSchema,
    StatisticsSchema
)


TOKEN_STORE = {}


def generate_token(user_id: int) -> str:
    token = secrets.token_hex(32)
    TOKEN_STORE[token] = user_id
    return token


def get_user_from_token(token: str) -> Optional[User]:
    user_id = TOKEN_STORE.get(token)
    if not user_id:
        return None
    try:
        return User.objects.select_related('profile').get(id=user_id)
    except User.DoesNotExist:
        return None


class AuthBearer(HttpBearer):
    def authenticate(self, request, token):
        user = get_user_from_token(token)
        if user:
            request.user = user
            return token
        return None


api = NinjaAPI(
    title='配镜订单管理系统 API',
    version='1.0.0',
    urls_namespace='api',
)

auth = AuthBearer()


def user_to_out(user: User) -> UserOut:
    profile = user.profile
    return UserOut(
        id=user.id,
        username=user.username,
        real_name=profile.real_name,
        role=profile.role,
        role_display=profile.get_role_display()
    )


def order_to_list_schema(order: GlassesOrder) -> GlassesOrderListSchema:
    current_handler_name = None
    if order.current_handler:
        current_handler_name = order.current_handler.profile.real_name
    return GlassesOrderListSchema(
        id=order.id,
        order_no=order.order_no,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        business_area=order.business_area,
        status=order.status,
        status_display=order.get_status_display(),
        version=order.version,
        urgency_status=order.get_urgency_status(),
        current_handler_name=current_handler_name,
        submitted_at=order.submitted_at,
        review_due_at=order.review_due_at,
        sync_due_at=order.sync_due_at,
        reviewed_at=order.reviewed_at,
        synced_at=order.synced_at,
        has_defect=order.has_defect,
        created_at=order.created_at
    )


def add_processing_record(order, action, operator, from_status='', to_status='', opinion='', version=None):
    return ProcessingRecord.objects.create(
        order=order,
        action=action,
        operator=operator,
        from_status=from_status,
        to_status=to_status,
        opinion=opinion,
        version=version or order.version
    )


def add_audit_note(order, operator, content, note_type='general', related_record=None):
    return AuditNote.objects.create(
        order=order,
        operator=operator,
        note_type=note_type,
        content=content,
        related_record=related_record
    )


def add_exception(order, exception_type, description, detected_by):
    return ExceptionReason.objects.create(
        order=order,
        exception_type=exception_type,
        description=description,
        detected_by=detected_by
    )


def check_required_attachments(order: GlassesOrder) -> List[str]:
    missing = []
    has_opt = order.attachments.filter(category=Attachment.CATEGORY_OPTOMETRY, is_required=True).exists()
    has_opt_doc = order.attachments.filter(category=Attachment.CATEGORY_OPTOMETRY).exists()
    if not has_opt and not has_opt_doc:
        missing.append('验光档案附件')
    has_lens = order.attachments.filter(category=Attachment.CATEGORY_LENS).exists()
    if not has_lens:
        missing.append('镜片订购附件')
    has_reg = order.attachments.filter(category=Attachment.CATEGORY_REGISTRATION).exists()
    if not has_reg:
        missing.append('订单登记附件')
    return missing


def validate_order_for_role(order: GlassesOrder, user: User, expected_version: int = None, check_attachments: bool = False):
    profile = user.profile
    errors = []

    if expected_version is not None and order.version != expected_version:
        errors.append(f'版本冲突：当前版本为 v{order.version}，您提交的是 v{expected_version}')
        add_exception(order, ExceptionReason.TYPE_VERSION_CONFLICT,
                      f'用户 {profile.real_name} 尝试用旧版本 v{expected_version} 操作，当前版本 v{order.version}', user)

    if order.current_handler and order.current_handler_id != user.id:
        errors.append(f'当前处理人不是您，应为 {order.current_handler.profile.real_name}')
        add_exception(order, ExceptionReason.TYPE_PERMISSION_DENIED,
                      f'用户 {profile.real_name} 越权操作，当前处理人应为 {order.current_handler.profile.real_name}', user)

    if order.status == GlassesOrder.STATUS_PENDING_REVIEW:
        if profile.role != UserProfile.ROLE_OPHTHALMOLOGIST:
            errors.append('此状态只有眼科医生可以操作')
            add_exception(order, ExceptionReason.TYPE_PERMISSION_DENIED,
                          f'用户 {profile.real_name} (角色：{profile.get_role_display()}) 无权审核待审核订单', user)
    elif order.status == GlassesOrder.STATUS_RETURNED_FOR_CORRECTION:
        if profile.role != UserProfile.ROLE_OPTOMETRIST:
            errors.append('退回补正状态只有验光师可以操作')
            add_exception(order, ExceptionReason.TYPE_PERMISSION_DENIED,
                          f'用户 {profile.real_name} (角色：{profile.get_role_display()}) 无权处理退回补正订单', user)
    elif order.status == GlassesOrder.STATUS_REVIEW_APPROVED:
        if profile.role != UserProfile.ROLE_OPERATIONS_MANAGER:
            errors.append('此状态只有运营主管可以操作')
            add_exception(order, ExceptionReason.TYPE_PERMISSION_DENIED,
                          f'用户 {profile.real_name} (角色：{profile.get_role_display()}) 无权同步审核通过订单', user)
    elif order.status == GlassesOrder.STATUS_SYNCED:
        errors.append('订单已同步，无法再进行操作')
        add_exception(order, ExceptionReason.TYPE_STATUS_CONFLICT,
                      f'用户 {profile.real_name} 尝试操作已同步订单', user)

    if check_attachments:
        missing_attachments = check_required_attachments(order)
        if missing_attachments:
            errors.append('缺少必填附件：' + '、'.join(missing_attachments))
            for m in missing_attachments:
                add_exception(order, ExceptionReason.TYPE_MISSING_ATTACHMENT, m, user)

    return errors


def check_optometry_and_lens_complete(order: GlassesOrder):
    issues = []
    if hasattr(order, 'optometry_record') and order.optometry_record:
        if not order.optometry_record.is_complete:
            issues.append('验光档案信息不完整')
    else:
        issues.append('缺少验光档案')

    if hasattr(order, 'lens_order') and order.lens_order:
        if not order.lens_order.is_complete:
            issues.append('镜片订购信息不完整')
    else:
        issues.append('缺少镜片订购信息')
    return issues


@api.post('/auth/login', response=LoginOut, tags=['认证'])
def login(request, data: LoginIn):
    user = authenticate(username=data.username, password=data.password)
    if not user:
        return api.create_response(request, {'detail': '用户名或密码错误'}, status=401)
    token = generate_token(user.id)
    return LoginOut(token=token, user=user_to_out(user))


@api.post('/auth/logout', auth=auth, tags=['认证'])
def logout(request):
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[7:]
        TOKEN_STORE.pop(token, None)
    return {'message': '已退出登录'}


@api.get('/auth/me', response=UserOut, auth=auth, tags=['认证'])
def get_current_user(request):
    return user_to_out(request.user)


@api.get('/users', response=List[UserOut], auth=auth, tags=['用户'])
def list_users(request, role: Optional[str] = None):
    qs = UserProfile.objects.select_related('user')
    if role:
        qs = qs.filter(role=role)
    users = [up.user for up in qs.all()]
    return [user_to_out(u) for u in users]


@api.get('/orders', response=List[GlassesOrderListSchema], auth=auth, tags=['订单'])
def list_orders(
    request,
    status: Optional[str] = None,
    urgency: Optional[str] = None,
    business_area: Optional[str] = None,
    keyword: Optional[str] = None,
    defect_only: Optional[bool] = False,
):
    profile = request.user.profile
    qs = GlassesOrder.objects.select_related(
        'submitted_by__profile', 'current_handler__profile',
        'reviewed_by__profile', 'synced_by__profile'
    ).prefetch_related('optometry_record', 'lens_order')

    if profile.role == UserProfile.ROLE_OPTOMETRIST:
        qs = qs.filter(Q(submitted_by=request.user) | Q(status=GlassesOrder.STATUS_RETURNED_FOR_CORRECTION))
    elif profile.role == UserProfile.ROLE_OPHTHALMOLOGIST:
        qs = qs.filter(Q(status__in=[GlassesOrder.STATUS_PENDING_REVIEW, GlassesOrder.STATUS_REVIEW_APPROVED]) |
                       Q(current_handler=request.user))
    elif profile.role == UserProfile.ROLE_OPERATIONS_MANAGER:
        pass

    if status:
        qs = qs.filter(status=status)
    if business_area:
        qs = qs.filter(business_area=business_area)
    if keyword:
        qs = qs.filter(Q(order_no__icontains=keyword) | Q(customer_name__icontains=keyword) |
                       Q(customer_phone__icontains=keyword))
    if defect_only:
        qs = qs.filter(has_defect=True)

    orders = list(qs.all())

    if urgency:
        orders = [o for o in orders if o.get_urgency_status() == urgency]

    return [order_to_list_schema(o) for o in orders]


@api.get('/orders/statistics', response=StatisticsSchema, auth=auth, tags=['订单'])
def get_statistics(request):
    qs = GlassesOrder.objects.all()
    stats = StatisticsSchema()
    stats.total = qs.count()
    status_counts = qs.values('status').annotate(count=Count('id'))
    for sc in status_counts:
        if sc['status'] == GlassesOrder.STATUS_PENDING_REVIEW:
            stats.pending_review = sc['count']
        elif sc['status'] == GlassesOrder.STATUS_REVIEW_APPROVED:
            stats.review_approved = sc['count']
        elif sc['status'] == GlassesOrder.STATUS_SYNCED:
            stats.synced = sc['count']
        elif sc['status'] == GlassesOrder.STATUS_RETURNED_FOR_CORRECTION:
            stats.returned = sc['count']

    for o in qs.all():
        u = o.get_urgency_status()
        if u == GlassesOrder.URGENCY_NORMAL:
            stats.normal += 1
        elif u == GlassesOrder.URGENCY_WARNING:
            stats.warning += 1
        elif u == GlassesOrder.URGENCY_OVERDUE:
            stats.overdue += 1

    return stats


def build_order_detail(order: GlassesOrder) -> GlassesOrderDetailSchema:
    submitted_by_name = order.submitted_by.profile.real_name if order.submitted_by else None
    current_handler_name = order.current_handler.profile.real_name if order.current_handler else None
    reviewed_by_name = order.reviewed_by.profile.real_name if order.reviewed_by else None
    synced_by_name = order.synced_by.profile.real_name if order.synced_by else None
    last_operator_name = order.last_operator.profile.real_name if order.last_operator else None

    opt_schema = None
    if hasattr(order, 'optometry_record') and order.optometry_record:
        opt_schema = OptometryRecordSchema.model_validate(order.optometry_record)

    lens_schema = None
    if hasattr(order, 'lens_order') and order.lens_order:
        lens_schema = LensOrderSchema.model_validate(order.lens_order)

    reg_schema = None
    if hasattr(order, 'registration') and order.registration:
        reg_schema = OrderRegistrationSchema.model_validate(order.registration)

    attachments = []
    for att in order.attachments.all():
        attachments.append(AttachmentSchema(
            id=att.id,
            category=att.category,
            category_display=att.get_category_display(),
            file_name=att.file_name,
            file_path=att.file_path,
            file_size=att.file_size,
            uploaded_by=att.uploaded_by.profile.real_name,
            description=att.description,
            is_required=att.is_required,
            created_at=att.created_at
        ))

    records = []
    for pr in order.processing_records.all():
        records.append(ProcessingRecordSchema(
            id=pr.id,
            action=pr.action,
            action_display=pr.get_action_display(),
            operator=pr.operator.profile.real_name,
            from_status=pr.from_status,
            to_status=pr.to_status,
            opinion=pr.opinion,
            version=pr.version,
            created_at=pr.created_at
        ))

    audit_notes = []
    for an in order.audit_notes.all():
        audit_notes.append(AuditNoteSchema(
            id=an.id,
            operator=an.operator.profile.real_name,
            note_type=an.note_type,
            content=an.content,
            created_at=an.created_at
        ))

    exceptions = []
    for exc in order.exceptions.all():
        exceptions.append(ExceptionReasonSchema(
            id=exc.id,
            exception_type=exc.exception_type,
            exception_type_display=exc.get_exception_type_display(),
            description=exc.description,
            detected_by=exc.detected_by.profile.real_name,
            resolved=exc.resolved,
            resolved_by=exc.resolved_by.profile.real_name if exc.resolved_by else None,
            resolved_at=exc.resolved_at,
            resolution_note=exc.resolution_note,
            created_at=exc.created_at
        ))

    return GlassesOrderDetailSchema(
        id=order.id,
        order_no=order.order_no,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        business_area=order.business_area,
        status=order.status,
        status_display=order.get_status_display(),
        version=order.version,
        urgency_status=order.get_urgency_status(),
        submitted_by_name=submitted_by_name,
        current_handler_name=current_handler_name,
        reviewed_by_name=reviewed_by_name,
        synced_by_name=synced_by_name,
        submitted_at=order.submitted_at,
        review_due_at=order.review_due_at,
        sync_due_at=order.sync_due_at,
        reviewed_at=order.reviewed_at,
        synced_at=order.synced_at,
        last_opinion=order.last_opinion,
        last_operator_name=last_operator_name,
        has_defect=order.has_defect,
        defect_description=order.defect_description,
        optometry_record=opt_schema,
        lens_order=lens_schema,
        registration=reg_schema,
        attachments=attachments,
        processing_records=records,
        audit_notes=audit_notes,
        exceptions=exceptions,
        created_at=order.created_at,
        updated_at=order.updated_at
    )


@api.get('/orders/{order_id}', response=GlassesOrderDetailSchema, auth=auth, tags=['订单'])
def get_order_detail(request, order_id: int):
    try:
        order = GlassesOrder.objects.select_related(
            'submitted_by__profile', 'current_handler__profile',
            'reviewed_by__profile', 'synced_by__profile', 'last_operator__profile'
        ).prefetch_related(
            'optometry_record', 'lens_order', 'registration',
            'attachments__uploaded_by__profile',
            'processing_records__operator__profile',
            'audit_notes__operator__profile',
            'exceptions__detected_by__profile', 'exceptions__resolved_by__profile'
        ).get(id=order_id)
    except GlassesOrder.DoesNotExist:
        return api.create_response(request, {'detail': '订单不存在'}, status=404)

    profile = request.user.profile
    if profile.role == UserProfile.ROLE_OPTOMETRIST:
        if order.submitted_by_id != request.user.id and order.status != GlassesOrder.STATUS_RETURNED_FOR_CORRECTION:
            return api.create_response(request, {'detail': '无权查看此订单'}, status=403)

    return build_order_detail(order)


@api.post('/orders', response=GlassesOrderDetailSchema, auth=auth, tags=['订单'])
@transaction.atomic
def create_order(request, data: GlassesOrderCreateSchema):
    profile = request.user.profile
    if profile.role != UserProfile.ROLE_OPTOMETRIST:
        return api.create_response(request, {'detail': '只有验光师可以创建订单'}, status=403)

    now = timezone.now()
    order_no = f'G{now.strftime("%Y%m%d")}{GlassesOrder.objects.count() + 1:04d}'

    order = GlassesOrder.objects.create(
        order_no=order_no,
        customer_name=data.customer_name,
        customer_phone=data.customer_phone,
        business_area=data.business_area,
        status=GlassesOrder.STATUS_PENDING_REVIEW,
        version=1,
        submitted_by=request.user,
        submitted_at=now,
        review_due_at=now + timedelta(days=3),
    )

    if data.optometry_record:
        opt = data.optometry_record.model_dump(exclude={'id'})
        opt_rec = OptometryRecord.objects.create(order=order, optometrist=request.user, **opt)
        opt_rec.check_complete()
        opt_rec.save()

    if data.lens_order:
        lens = data.lens_order.model_dump(exclude={'id'})
        lens_rec = LensOrder.objects.create(order=order, **lens)
        lens_rec.check_complete()
        lens_rec.save()

    if data.registration:
        reg = data.registration.model_dump(exclude={'id'})
        reg_rec = OrderRegistration.objects.create(order=order, **reg)
        reg_rec.check_complete()
        reg_rec.save()

    oph_docs = UserProfile.objects.filter(role=UserProfile.ROLE_OPHTHALMOLOGIST).select_related('user')
    if oph_docs.exists():
        order.current_handler = oph_docs.first().user

    order.save()

    add_processing_record(order, ProcessingRecord.ACTION_SUBMIT, request.user,
                          from_status='', to_status=order.status, opinion='验光师提交订单', version=1)
    add_audit_note(order, request.user, f'验光师 {profile.real_name} 创建并提交配镜订单 {order_no}')

    issues = check_optometry_and_lens_complete(order)
    if issues:
        order.has_defect = True
        order.defect_description = '；'.join(issues)
        order.save()
        for issue in issues:
            if '验光' in issue:
                add_exception(order, ExceptionReason.TYPE_MISSING_OPTOMETRY, issue, request.user)
            elif '镜片' in issue:
                add_exception(order, ExceptionReason.TYPE_MISSING_LENS, issue, request.user)
        add_audit_note(order, request.user, '提交时检测到缺项：' + '；'.join(issues), note_type='defect')

    return build_order_detail(order)


@api.post('/orders/review', response=BatchResultSchema, auth=auth, tags=['订单'])
@transaction.atomic
def review_order(request, data: OrderReviewSchema):
    try:
        order = GlassesOrder.objects.select_for_update().get(id=data.order_id)
    except GlassesOrder.DoesNotExist:
        return BatchResultSchema(order_id=data.order_id, order_no='', success=False, message='订单不存在')

    profile = request.user.profile
    errors = validate_order_for_role(order, request.user, expected_version=data.version, check_attachments=True)
    if errors:
        add_audit_note(order, request.user, '审核拦截：' + '；'.join(errors), note_type='error')
        return BatchResultSchema(order_id=order.id, order_no=order.order_no, success=False, message='；'.join(errors))

    from_status = order.status

    if data.action == 'approve':
        issues = check_optometry_and_lens_complete(order)
        missing_att = check_required_attachments(order)
        if issues or missing_att:
            all_issues = issues + missing_att
            add_audit_note(order, request.user, '审核通过前检测异常：' + '；'.join(all_issues), note_type='warning')

        order.status = GlassesOrder.STATUS_REVIEW_APPROVED
        order.reviewed_by = request.user
        order.reviewed_at = timezone.now()
        order.sync_due_at = timezone.now() + timedelta(days=2)
        ops_mgrs = UserProfile.objects.filter(role=UserProfile.ROLE_OPERATIONS_MANAGER).select_related('user')
        if ops_mgrs.exists():
            order.current_handler = ops_mgrs.first().user

        action = ProcessingRecord.ACTION_APPROVE
    elif data.action == 'return':
        order.status = GlassesOrder.STATUS_RETURNED_FOR_CORRECTION
        order.has_defect = True
        order.defect_description = data.opinion or '眼科医生退回补正'
        optometrist = order.submitted_by
        if optometrist:
            order.current_handler = optometrist

        action = ProcessingRecord.ACTION_RETURN
        add_exception(order, ExceptionReason.TYPE_OTHER, f'退回补正：{data.opinion}', request.user)
    else:
        return BatchResultSchema(order_id=order.id, order_no=order.order_no, success=False, message='不支持的操作')

    order.version += 1
    order.last_opinion = data.opinion
    order.last_operator = request.user
    order.save()

    rec = add_processing_record(order, action, request.user,
                                from_status=from_status, to_status=order.status,
                                opinion=data.opinion, version=order.version)
    add_audit_note(order, request.user,
                   f'{profile.real_name} 执行【{ProcessingRecord(action=action).get_action_display()}】'
                   f'（v{data.version}→v{order.version}）：{data.opinion}',
                   related_record=rec)

    return BatchResultSchema(order_id=order.id, order_no=order.order_no, success=True,
                             message=f'操作成功，订单状态变更为 {order.get_status_display()}')


@api.post('/orders/correct', response=BatchResultSchema, auth=auth, tags=['订单'])
@transaction.atomic
def correct_order(request, data: OrderCorrectSchema):
    try:
        order = GlassesOrder.objects.select_for_update().get(id=data.order_id)
    except GlassesOrder.DoesNotExist:
        return BatchResultSchema(order_id=data.order_id, order_no='', success=False, message='订单不存在')

    profile = request.user.profile
    errors = validate_order_for_role(order, request.user, expected_version=data.version)
    if errors:
        add_audit_note(order, request.user, '补正拦截：' + '；'.join(errors), note_type='error')
        return BatchResultSchema(order_id=order.id, order_no=order.order_no, success=False, message='；'.join(errors))

    if order.status != GlassesOrder.STATUS_RETURNED_FOR_CORRECTION and order.status != GlassesOrder.STATUS_PENDING_REVIEW:
        msg = f'当前状态为 {order.get_status_display()}，无法补正'
        add_exception(order, ExceptionReason.TYPE_STATUS_CONFLICT, msg, request.user)
        return BatchResultSchema(order_id=order.id, order_no=order.order_no, success=False, message=msg)

    from_status = order.status

    if data.optometry_record:
        opt_data = data.optometry_record.model_dump(exclude={'id'})
        if hasattr(order, 'optometry_record') and order.optometry_record:
            for k, v in opt_data.items():
                setattr(order.optometry_record, k, v)
            order.optometry_record.optometrist = request.user
            order.optometry_record.check_complete()
            order.optometry_record.save()
        else:
            opt_rec = OptometryRecord.objects.create(order=order, optometrist=request.user, **opt_data)
            opt_rec.check_complete()
            opt_rec.save()

    if data.lens_order:
        lens_data = data.lens_order.model_dump(exclude={'id'})
        if hasattr(order, 'lens_order') and order.lens_order:
            for k, v in lens_data.items():
                setattr(order.lens_order, k, v)
            order.lens_order.check_complete()
            order.lens_order.save()
        else:
            lens_rec = LensOrder.objects.create(order=order, **lens_data)
            lens_rec.check_complete()
            lens_rec.save()

    if data.registration:
        reg_data = data.registration.model_dump(exclude={'id'})
        if hasattr(order, 'registration') and order.registration:
            for k, v in reg_data.items():
                setattr(order.registration, k, v)
            order.registration.check_complete()
            order.registration.save()
        else:
            reg_rec = OrderRegistration.objects.create(order=order, **reg_data)
            reg_rec.check_complete()
            reg_rec.save()

    issues = check_optometry_and_lens_complete(order)
    if issues:
        order.has_defect = True
        order.defect_description = '；'.join(issues)
    else:
        order.has_defect = False
        order.defect_description = ''

    order.status = GlassesOrder.STATUS_PENDING_REVIEW
    order.version += 1
    order.last_opinion = data.opinion
    order.last_operator = request.user
    oph_docs = UserProfile.objects.filter(role=UserProfile.ROLE_OPHTHALMOLOGIST).select_related('user')
    if oph_docs.exists():
        order.current_handler = oph_docs.first().user
    order.save()

    for exc in order.exceptions.filter(resolved=False, exception_type__in=[
        ExceptionReason.TYPE_MISSING_OPTOMETRY, ExceptionReason.TYPE_MISSING_LENS, ExceptionReason.TYPE_OTHER
    ]):
        exc.resolved = True
        exc.resolved_by = request.user
        exc.resolved_at = timezone.now()
        exc.resolution_note = f'补正解决：{data.opinion}'
        exc.save()

    rec = add_processing_record(order, ProcessingRecord.ACTION_CORRECT, request.user,
                                from_status=from_status, to_status=order.status,
                                opinion=data.opinion, version=order.version)
    add_audit_note(order, request.user,
                   f'{profile.real_name} 补正订单（v{data.version}→v{order.version}）：{data.opinion}',
                   related_record=rec)

    return BatchResultSchema(order_id=order.id, order_no=order.order_no, success=True,
                             message=f'补正成功，重新提交待审核')


@api.post('/orders/sync', response=BatchResultSchema, auth=auth, tags=['订单'])
@transaction.atomic
def sync_order(request, data: OrderReviewSchema):
    try:
        order = GlassesOrder.objects.select_for_update().get(id=data.order_id)
    except GlassesOrder.DoesNotExist:
        return BatchResultSchema(order_id=data.order_id, order_no='', success=False, message='订单不存在')

    profile = request.user.profile
    errors = validate_order_for_role(order, request.user, expected_version=data.version, check_attachments=True)
    if errors:
        add_audit_note(order, request.user, '同步拦截：' + '；'.join(errors), note_type='error')
        return BatchResultSchema(order_id=order.id, order_no=order.order_no, success=False, message='；'.join(errors))

    if order.status != GlassesOrder.STATUS_REVIEW_APPROVED:
        msg = f'当前状态为 {order.get_status_display()}，只有审核通过的订单可以同步'
        add_exception(order, ExceptionReason.TYPE_STATUS_CONFLICT, msg, request.user)
        return BatchResultSchema(order_id=order.id, order_no=order.order_no, success=False, message=msg)

    from_status = order.status
    order.status = GlassesOrder.STATUS_SYNCED
    order.synced_by = request.user
    order.synced_at = timezone.now()
    order.current_handler = None
    order.version += 1
    order.last_opinion = data.opinion
    order.last_operator = request.user
    order.save()

    rec = add_processing_record(order, ProcessingRecord.ACTION_SYNC, request.user,
                                from_status=from_status, to_status=order.status,
                                opinion=data.opinion, version=order.version)
    add_audit_note(order, request.user,
                   f'{profile.real_name} 同步订单（v{data.version}→v{order.version}）：{data.opinion}',
                   related_record=rec)

    return BatchResultSchema(order_id=order.id, order_no=order.order_no, success=True, message='同步成功')


@api.post('/orders/batch', response=List[BatchResultSchema], auth=auth, tags=['订单'])
def batch_process(request, data: BatchProcessSchema):
    profile = request.user.profile
    results = []

    for order_id in data.order_ids:
        try:
            with transaction.atomic():
                order = GlassesOrder.objects.select_for_update().get(id=order_id)

                if data.action == 'approve':
                    if order.status != GlassesOrder.STATUS_PENDING_REVIEW:
                        results.append(BatchResultSchema(
                            order_id=order.id, order_no=order.order_no, success=False,
                            message=f'状态冲突：当前状态为 {order.get_status_display()}，无法批量通过'
                        ))
                        add_exception(order, ExceptionReason.TYPE_STATUS_CONFLICT,
                                      f'批量通过失败：状态为 {order.get_status_display()}', request.user)
                        continue

                    errors = validate_order_for_role(order, request.user, check_attachments=True)
                    if errors:
                        results.append(BatchResultSchema(
                            order_id=order.id, order_no=order.order_no, success=False,
                            message='；'.join(errors)
                        ))
                        add_audit_note(order, request.user, '批量审核拦截：' + '；'.join(errors), note_type='error')
                        continue

                    from_status = order.status
                    order.status = GlassesOrder.STATUS_REVIEW_APPROVED
                    order.reviewed_by = request.user
                    order.reviewed_at = timezone.now()
                    order.sync_due_at = timezone.now() + timedelta(days=2)
                    ops_mgrs = UserProfile.objects.filter(role=UserProfile.ROLE_OPERATIONS_MANAGER).select_related('user')
                    if ops_mgrs.exists():
                        order.current_handler = ops_mgrs.first().user
                    order.version += 1
                    order.last_opinion = data.opinion
                    order.last_operator = request.user
                    order.save()

                    rec = add_processing_record(order, ProcessingRecord.ACTION_APPROVE, request.user,
                                                from_status=from_status, to_status=order.status,
                                                opinion=data.opinion, version=order.version)
                    add_audit_note(order, request.user,
                                   f'{profile.real_name} 批量审核通过：{data.opinion}', related_record=rec)
                    results.append(BatchResultSchema(
                        order_id=order.id, order_no=order.order_no, success=True,
                        message='批量审核通过成功'
                    ))

                elif data.action == 'sync':
                    if order.status != GlassesOrder.STATUS_REVIEW_APPROVED:
                        results.append(BatchResultSchema(
                            order_id=order.id, order_no=order.order_no, success=False,
                            message=f'状态冲突：当前状态为 {order.get_status_display()}，无法批量同步'
                        ))
                        add_exception(order, ExceptionReason.TYPE_STATUS_CONFLICT,
                                      f'批量同步失败：状态为 {order.get_status_display()}', request.user)
                        continue

                    errors = validate_order_for_role(order, request.user, check_attachments=True)
                    if errors:
                        results.append(BatchResultSchema(
                            order_id=order.id, order_no=order.order_no, success=False,
                            message='；'.join(errors)
                        ))
                        add_audit_note(order, request.user, '批量同步拦截：' + '；'.join(errors), note_type='error')
                        continue

                    from_status = order.status
                    order.status = GlassesOrder.STATUS_SYNCED
                    order.synced_by = request.user
                    order.synced_at = timezone.now()
                    order.current_handler = None
                    order.version += 1
                    order.last_opinion = data.opinion
                    order.last_operator = request.user
                    order.save()

                    rec = add_processing_record(order, ProcessingRecord.ACTION_SYNC, request.user,
                                                from_status=from_status, to_status=order.status,
                                                opinion=data.opinion, version=order.version)
                    add_audit_note(order, request.user,
                                   f'{profile.real_name} 批量同步：{data.opinion}', related_record=rec)
                    results.append(BatchResultSchema(
                        order_id=order.id, order_no=order.order_no, success=True,
                        message='批量同步成功'
                    ))

                elif data.action == 'return':
                    if order.status != GlassesOrder.STATUS_PENDING_REVIEW:
                        results.append(BatchResultSchema(
                            order_id=order.id, order_no=order.order_no, success=False,
                            message=f'状态冲突：当前状态为 {order.get_status_display()}，无法批量退回'
                        ))
                        continue

                    errors = validate_order_for_role(order, request.user)
                    if errors:
                        results.append(BatchResultSchema(
                            order_id=order.id, order_no=order.order_no, success=False,
                            message='；'.join(errors)
                        ))
                        continue

                    from_status = order.status
                    order.status = GlassesOrder.STATUS_RETURNED_FOR_CORRECTION
                    order.has_defect = True
                    order.defect_description = data.opinion or '批量退回补正'
                    optometrist = order.submitted_by
                    if optometrist:
                        order.current_handler = optometrist
                    order.version += 1
                    order.last_opinion = data.opinion
                    order.last_operator = request.user
                    order.save()

                    add_exception(order, ExceptionReason.TYPE_OTHER, f'批量退回补正：{data.opinion}', request.user)
                    rec = add_processing_record(order, ProcessingRecord.ACTION_RETURN, request.user,
                                                from_status=from_status, to_status=order.status,
                                                opinion=data.opinion, version=order.version)
                    add_audit_note(order, request.user,
                                   f'{profile.real_name} 批量退回补正：{data.opinion}', related_record=rec)
                    results.append(BatchResultSchema(
                        order_id=order.id, order_no=order.order_no, success=True,
                        message='批量退回补正成功'
                    ))

                else:
                    results.append(BatchResultSchema(
                        order_id=order.id, order_no=order.order_no if order else '',
                        success=False, message='不支持的批量操作'
                    ))

        except GlassesOrder.DoesNotExist:
            results.append(BatchResultSchema(
                order_id=order_id, order_no='', success=False, message='订单不存在'
            ))
        except Exception as e:
            results.append(BatchResultSchema(
                order_id=order_id, order_no='', success=False, message=f'系统错误：{str(e)}'
            ))

    return results


@api.post('/orders/{order_id}/attachments', response=AttachmentSchema, auth=auth, tags=['订单'])
@transaction.atomic
def upload_attachment(request, order_id: int, category: str, file: File[UploadedFile],
                      description: str = '', is_required: bool = False):
    try:
        order = GlassesOrder.objects.get(id=order_id)
    except GlassesOrder.DoesNotExist:
        return api.create_response(request, {'detail': '订单不存在'}, status=404)

    profile = request.user.profile
    valid_categories = [c[0] for c in Attachment.CATEGORY_CHOICES]
    if category not in valid_categories:
        return api.create_response(request, {'detail': '无效的附件类别'}, status=400)

    import os
    os.makedirs('media/attachments', exist_ok=True)
    file_path = f'media/attachments/{order.order_no}_{category}_{file.name}'
    with open(file_path, 'wb') as f:
        f.write(file.read())

    att = Attachment.objects.create(
        order=order,
        category=category,
        file_name=file.name,
        file_path=file_path,
        file_size=file.size,
        uploaded_by=request.user,
        description=description,
        is_required=is_required
    )

    add_processing_record(order, ProcessingRecord.ACTION_ADD_ATTACHMENT, request.user,
                          opinion=f'上传附件：{file.name} ({att.get_category_display()})')
    add_audit_note(order, request.user, f'{profile.real_name} 上传附件：{file.name}')

    return AttachmentSchema(
        id=att.id,
        category=att.category,
        category_display=att.get_category_display(),
        file_name=att.file_name,
        file_path=att.file_path,
        file_size=att.file_size,
        uploaded_by=att.uploaded_by.profile.real_name,
        description=att.description,
        is_required=att.is_required,
        created_at=att.created_at
    )


@api.get('/business-areas', auth=auth, tags=['基础数据'])
def list_business_areas(request):
    areas = GlassesOrder.objects.values_list('business_area', flat=True).distinct()
    return list(areas)

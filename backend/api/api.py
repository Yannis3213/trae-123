import logging
from datetime import date, datetime, timedelta
from typing import List, Optional
from django.http import HttpRequest
from django.db import transaction
from django.db.models import Count, Q, Prefetch

logger = logging.getLogger(__name__)

from ninja import NinjaAPI, Schema

from api.models import (
    User, RequirementDeliveryOrder, ProcessingRecord, ExceptionReason, AuditNote, Attachment,
    RoleChoices, OrderStatusChoices, RequirementStatusChoices, ModuleTypeChoices, ActionChoices
)
from api.schemas import (
    LoginSchema, LoginResponse, UserSchema,
    OrderListSchema, OrderDetailSchema, OrderCreateSchema,
    RequirementSubmitSchema, ScheduleSubmitSchema, DeliverySubmitSchema,
    AuditSchema, BatchAdvanceSchema, BatchVerifySchema, BatchProcessSchema,
    BatchResult, BatchResultItem, StatisticsSchema,
    DeadlineWarningSchema, SuccessResponse
)
from api.permissions import (
    can_create_order, can_submit_module, can_audit_module,
    can_review_order, can_archive_order, can_advance_order,
    can_verify_order, get_allowed_actions, is_correct_scenario
)
from api.utils import (
    validate_version, transition_status, generate_order_no,
    get_deadline_warning, VersionConflictError, EvidenceMissingError,
    PermissionDeniedError, StatusTransitionError, check_evidence_complete
)
from api.permissions import SUBMIT_ROLES, AUDIT_ROLES


api = NinjaAPI(title='需求交付单管理系统 API', version='1.0.0', csrf=False)


@api.exception_handler(VersionConflictError)
def version_conflict_handler(request, exc):
    return api.create_response(request, {'success': False, 'message': str(exc)}, status=409)


@api.exception_handler(EvidenceMissingError)
def evidence_missing_handler(request, exc):
    return api.create_response(request, {'success': False, 'message': str(exc)}, status=400)


@api.exception_handler(PermissionDeniedError)
def permission_denied_handler(request, exc):
    return api.create_response(request, {'success': False, 'message': str(exc)}, status=403)


@api.exception_handler(StatusTransitionError)
def status_transition_handler(request, exc):
    return api.create_response(request, {'success': False, 'message': str(exc)}, status=400)


def get_user_from_token(request):
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[7:]
        try:
            user_id = int(token.split('_')[0])
            return User.objects.get(id=user_id)
        except (ValueError, IndexError, User.DoesNotExist):
            pass
    return None


class AuthHttpRequest(HttpRequest):
    user: User


def auth_required(request):
    user = get_user_from_token(request)
    if not user:
        raise PermissionDeniedError('未登录或登录已过期')
    request.user = user
    return user


@api.post('/login', response=LoginResponse)
def login(request, payload: LoginSchema):
    try:
        user = User.objects.get(username=payload.username)
    except User.DoesNotExist:
        return api.create_response(request, {'success': False, 'message': '用户名或密码错误'}, status=401)
    if not user.check_password(payload.password):
        return api.create_response(request, {'success': False, 'message': '用户名或密码错误'}, status=401)
    token = f'{user.id}_{user.username}_mock_token'
    return {'token': token, 'user': UserSchema.from_orm(user)}


@api.get('/me', response=UserSchema)
def get_current_user(request):
    user = auth_required(request)
    return UserSchema.from_orm(user)


@api.get('/orders', response=List[OrderListSchema])
def list_orders(
    request,
    status: Optional[str] = None,
    role: Optional[str] = None,
    handler_id: Optional[int] = None,
    clue: Optional[str] = None,
):
    user = auth_required(request)
    queryset = RequirementDeliveryOrder.objects.all()
    if status:
        queryset = queryset.filter(status=status)
    if handler_id:
        queryset = queryset.filter(current_handler_id=handler_id)
    if clue:
        queryset = queryset.filter(requirement_confirmation_clue__icontains=clue)
    if role:
        if role == RoleChoices.DELIVERY_REGISTRAR:
            queryset = queryset.filter(
                Q(status__in=[OrderStatusChoices.PENDING_VERIFY, OrderStatusChoices.VERIFY_FAILED])
                | Q(requirement_status__in=[RequirementStatusChoices.NOT_STARTED, RequirementStatusChoices.EXCEPTION])
            )
        elif role == RoleChoices.DEV_LEAD:
            queryset = queryset.filter(
                Q(requirement_status=RequirementStatusChoices.COMPLETED)
                & Q(schedule_status__in=[RequirementStatusChoices.NOT_STARTED, RequirementStatusChoices.EXCEPTION])
            )
        elif role == RoleChoices.PROJECT_ASSISTANT:
            queryset = queryset.filter(
                Q(schedule_status=RequirementStatusChoices.COMPLETED)
                & Q(delivery_status__in=[RequirementStatusChoices.NOT_STARTED, RequirementStatusChoices.EXCEPTION])
            )
        elif role == RoleChoices.AUDIT_SUPERVISOR:
            queryset = queryset.filter(status__in=[
                OrderStatusChoices.REQUIREMENT_SUBMITTED,
                OrderStatusChoices.SCHEDULE_SUBMITTED,
                OrderStatusChoices.DELIVERY_SUBMITTED,
                OrderStatusChoices.PENDING_VERIFY,
                OrderStatusChoices.VERIFY_FAILED,
                OrderStatusChoices.REQUIREMENT_AUDITED,
                OrderStatusChoices.SCHEDULE_AUDITED,
            ])
        elif role == RoleChoices.REVIEW_LEADER:
            queryset = queryset.filter(status__in=[
                OrderStatusChoices.DELIVERY_AUDITED,
                OrderStatusChoices.REVIEW_PENDING,
            ])
        elif role == RoleChoices.DELIVERY_MANAGER:
            queryset = queryset.filter(status__in=[
                OrderStatusChoices.PENDING_VERIFY,
                OrderStatusChoices.VERIFY_FAILED,
                OrderStatusChoices.REQUIREMENT_AUDITED,
                OrderStatusChoices.SCHEDULE_AUDITED,
                OrderStatusChoices.REVIEW_COMPLETED,
            ])
    orders = list(queryset.select_related('current_handler', 'created_by'))
    return [OrderListSchema.from_orm(o) for o in orders]


@api.get('/orders/{order_id}', response=OrderDetailSchema)
def get_order_detail(request, order_id: int):
    auth_required(request)
    order = RequirementDeliveryOrder.objects.select_related(
        'current_handler', 'created_by'
    ).prefetch_related(
        Prefetch('attachments', queryset=Attachment.objects.select_related('uploaded_by')),
        Prefetch('processing_records', queryset=ProcessingRecord.objects.select_related('operator')),
        Prefetch('audit_notes', queryset=AuditNote.objects.select_related('author')),
        Prefetch('exception_reasons', queryset=ExceptionReason.objects.select_related('handler')),
    ).get(id=order_id)
    return OrderDetailSchema.from_orm(order)


@api.post('/orders', response=OrderDetailSchema)
def create_order(request, payload: OrderCreateSchema):
    user = auth_required(request)
    if not can_create_order(user):
        raise PermissionDeniedError('您没有创建单据的权限')
    with transaction.atomic():
        order = RequirementDeliveryOrder.objects.create(
            order_no=generate_order_no(),
            title=payload.title,
            project_name=payload.project_name,
            requirement_confirmation_clue=payload.requirement_confirmation_clue,
            requirement_deadline=payload.requirement_deadline,
            schedule_deadline=payload.schedule_deadline,
            delivery_deadline=payload.delivery_deadline,
            created_by=user,
            current_handler=user,
        )
    return OrderDetailSchema.from_orm(order)


@api.post('/orders/{order_id}/requirement/submit', response=SuccessResponse)
def submit_requirement(request, order_id: int, payload: RequirementSubmitSchema):
    user = auth_required(request)
    order = RequirementDeliveryOrder.objects.get(id=order_id)
    if not can_submit_module(user, order, 'requirement'):
        raise PermissionDeniedError('您没有提交需求确认的权限')
    validate_version(order, payload.version)
    is_correct = is_correct_scenario(user, order, 'requirement')
    action = 'correct' if is_correct else 'submit'
    with transaction.atomic():
        transition_status(
            order=order,
            module_type='requirement',
            action=action,
            operator=user,
            evidence=payload.evidence,
        )
    msg = '需求确认补正提交成功' if is_correct else '需求确认提交成功'
    return {'success': True, 'message': msg}


@api.post('/orders/{order_id}/requirement/audit', response=SuccessResponse)
def audit_requirement(request, order_id: int, payload: AuditSchema):
    user = auth_required(request)
    order = RequirementDeliveryOrder.objects.get(id=order_id)
    if not can_audit_module(user, order, 'requirement'):
        raise PermissionDeniedError('您没有审核需求确认的权限')
    validate_version(order, payload.version)
    with transaction.atomic():
        transition_status(
            order=order,
            module_type='requirement',
            action='audit',
            operator=user,
            remark=payload.remark,
            approved=payload.approved,
            exception_reason=payload.exception_reason,
        )
    msg = '需求确认审核通过' if payload.approved else '需求确认审核驳回'
    return {'success': True, 'message': msg}


@api.post('/orders/{order_id}/schedule/submit', response=SuccessResponse)
def submit_schedule(request, order_id: int, payload: ScheduleSubmitSchema):
    user = auth_required(request)
    order = RequirementDeliveryOrder.objects.get(id=order_id)
    if not can_submit_module(user, order, 'schedule'):
        raise PermissionDeniedError('您没有提交排期评估的权限')
    validate_version(order, payload.version)
    is_correct = is_correct_scenario(user, order, 'schedule')
    action = 'correct' if is_correct else 'submit'
    with transaction.atomic():
        transition_status(
            order=order,
            module_type='schedule',
            action=action,
            operator=user,
            evidence=payload.evidence,
        )
    msg = '排期评估补正提交成功' if is_correct else '排期评估提交成功'
    return {'success': True, 'message': msg}


@api.post('/orders/{order_id}/schedule/audit', response=SuccessResponse)
def audit_schedule(request, order_id: int, payload: AuditSchema):
    user = auth_required(request)
    order = RequirementDeliveryOrder.objects.get(id=order_id)
    if not can_audit_module(user, order, 'schedule'):
        raise PermissionDeniedError('您没有审核排期评估的权限')
    validate_version(order, payload.version)
    with transaction.atomic():
        transition_status(
            order=order,
            module_type='schedule',
            action='audit',
            operator=user,
            remark=payload.remark,
            approved=payload.approved,
            exception_reason=payload.exception_reason,
        )
    msg = '排期评估审核通过' if payload.approved else '排期评估审核驳回'
    return {'success': True, 'message': msg}


@api.post('/orders/{order_id}/delivery/submit', response=SuccessResponse)
def submit_delivery(request, order_id: int, payload: DeliverySubmitSchema):
    user = auth_required(request)
    order = RequirementDeliveryOrder.objects.get(id=order_id)
    if not can_submit_module(user, order, 'delivery'):
        raise PermissionDeniedError('您没有提交交付验收的权限')
    validate_version(order, payload.version)
    is_correct = is_correct_scenario(user, order, 'delivery')
    action = 'correct' if is_correct else 'submit'
    with transaction.atomic():
        transition_status(
            order=order,
            module_type='delivery',
            action=action,
            operator=user,
            evidence=payload.evidence,
        )
    msg = '交付验收补正提交成功' if is_correct else '交付验收提交成功'
    return {'success': True, 'message': msg}


@api.post('/orders/{order_id}/delivery/audit', response=SuccessResponse)
def audit_delivery(request, order_id: int, payload: AuditSchema):
    user = auth_required(request)
    order = RequirementDeliveryOrder.objects.get(id=order_id)
    if not can_audit_module(user, order, 'delivery'):
        raise PermissionDeniedError('您没有审核交付验收的权限')
    validate_version(order, payload.version)
    with transaction.atomic():
        transition_status(
            order=order,
            module_type='delivery',
            action='audit',
            operator=user,
            remark=payload.remark,
            approved=payload.approved,
            exception_reason=payload.exception_reason,
        )
    msg = '交付验收审核通过' if payload.approved else '交付验收审核驳回'
    return {'success': True, 'message': msg}


@api.post('/orders/{order_id}/review', response=SuccessResponse)
def review_order(request, order_id: int, payload: AuditSchema):
    user = auth_required(request)
    order = RequirementDeliveryOrder.objects.get(id=order_id)
    if not can_review_order(user, order):
        raise PermissionDeniedError('您没有复核的权限')
    validate_version(order, payload.version)
    with transaction.atomic():
        transition_status(
            order=order,
            module_type='',
            action='review',
            operator=user,
            remark=payload.remark,
            approved=payload.approved,
        )
    msg = '复核通过' if payload.approved else '复核驳回'
    return {'success': True, 'message': msg}


@api.post('/orders/{order_id}/archive', response=SuccessResponse)
def archive_order(request, order_id: int):
    user = auth_required(request)
    order = RequirementDeliveryOrder.objects.get(id=order_id)
    if not can_archive_order(user, order):
        raise PermissionDeniedError('您没有归档的权限')
    with transaction.atomic():
        transition_status(
            order=order,
            module_type='',
            action='archive',
            operator=user,
        )
    return {'success': True, 'message': '归档成功'}


@api.post('/orders/batch-advance', response=BatchResult)
def batch_advance_orders(request, payload: BatchAdvanceSchema):
    user = auth_required(request)
    if not can_verify_order(user):
        raise PermissionDeniedError('您没有批量推进的权限')
    results = []
    success_count = 0
    for order_id in payload.order_ids:
        try:
            order = RequirementDeliveryOrder.objects.get(id=order_id)
            if not can_advance_order(user, order):
                results.append(BatchResultItem(
                    order_id=order_id, order_no=order.order_no,
                    success=False, message='该单据当前状态不允许推进或无权限'
                ))
                continue
            with transaction.atomic():
                transition_status(
                    order=order,
                    module_type='',
                    action='advance',
                    operator=user,
                    remark=payload.remark,
                )
            results.append(BatchResultItem(
                order_id=order_id, order_no=order.order_no, success=True, message='推进成功'
            ))
            success_count += 1
        except RequirementDeliveryOrder.DoesNotExist:
            results.append(BatchResultItem(
                order_id=order_id, order_no='', success=False, message='单据不存在'
            ))
        except Exception as e:
            order = RequirementDeliveryOrder.objects.filter(id=order_id).first()
            results.append(BatchResultItem(
                order_id=order_id, order_no=order.order_no if order else '',
                success=False, message=str(e)
            ))
    return BatchResult(
        total=len(payload.order_ids),
        success_count=success_count,
        failed_count=len(payload.order_ids) - success_count,
        results=results,
    )


def get_exception_module_type(order: RequirementDeliveryOrder) -> ModuleTypeChoices:
    if order.requirement_status == RequirementStatusChoices.EXCEPTION:
        return ModuleTypeChoices.REQUIREMENT
    if order.schedule_status == RequirementStatusChoices.EXCEPTION:
        return ModuleTypeChoices.SCHEDULE
    if order.delivery_status == RequirementStatusChoices.EXCEPTION:
        return ModuleTypeChoices.DELIVERY
    return ModuleTypeChoices.REQUIREMENT


@api.post('/orders/batch-verify', response=BatchResult)
def batch_verify_orders(request, payload: BatchVerifySchema):
    user = auth_required(request)
    if not can_verify_order(user):
        raise PermissionDeniedError('您没有批量核验的权限')
    results = []
    success_count = 0
    for order_id in payload.order_ids:
        try:
            order = RequirementDeliveryOrder.objects.get(id=order_id)
            biz_result = None
            exception_reason = None
            failure_reason = None

            if order.status not in [OrderStatusChoices.PENDING_VERIFY, OrderStatusChoices.VERIFY_FAILED]:
                results.append(BatchResultItem(
                    order_id=order_id, order_no=order.order_no,
                    success=False, message='该单据当前状态不允许核验',
                    failure_reason='该单据当前状态不允许核验'
                ))
                continue

            intercept_failed = False

            if not can_verify_order(user):
                failure_reason = '越权操作：您没有核验权限'
                intercept_failed = True

            if order.status == OrderStatusChoices.VERIFY_FAILED and not intercept_failed:
                exception_module_type = get_exception_module_type(order)
                module_key = exception_module_type.lower()
                allowed_roles = SUBMIT_ROLES.get(module_key, []) + AUDIT_ROLES.get(module_key, [])
                if user.role not in allowed_roles:
                    failure_reason = f'越权操作：您没有操作{exception_module_type}异常模块的权限'
                    intercept_failed = True

            if not intercept_failed:
                version = None
                if payload.order_versions and order_id in payload.order_versions:
                    version = payload.order_versions[order_id]
                elif payload.version is not None:
                    version = payload.version

                if version is not None:
                    try:
                        validate_version(order, version)
                    except VersionConflictError as e:
                        failure_reason = str(e)
                        intercept_failed = True
                else:
                    logger.warning(f'订单 {order_id} 未传版本号，跳过版本校验')

            if not intercept_failed:
                if payload.approved:
                    if order.status == OrderStatusChoices.PENDING_VERIFY:
                        if order.requirement_status == RequirementStatusChoices.EXCEPTION:
                            failure_reason = '状态冲突：待核验状态下需求确认模块不能为异常状态'
                            intercept_failed = True
                    elif order.status == OrderStatusChoices.VERIFY_FAILED:
                        has_exception = (
                            order.requirement_status == RequirementStatusChoices.EXCEPTION
                            or order.schedule_status == RequirementStatusChoices.EXCEPTION
                            or order.delivery_status == RequirementStatusChoices.EXCEPTION
                        )
                        if not has_exception:
                            failure_reason = '状态冲突：核验失败状态下核验通过需要有异常模块'
                            intercept_failed = True
                else:
                    if order.status == OrderStatusChoices.VERIFY_FAILED:
                        has_exception = (
                            order.requirement_status == RequirementStatusChoices.EXCEPTION
                            or order.schedule_status == RequirementStatusChoices.EXCEPTION
                            or order.delivery_status == RequirementStatusChoices.EXCEPTION
                        )
                        if not has_exception:
                            pass

            if not intercept_failed and payload.approved:
                if order.status == OrderStatusChoices.PENDING_VERIFY:
                    is_complete, msg = check_evidence_complete('requirement', order.requirement_evidence)
                    if not is_complete:
                        failure_reason = f'证据缺失：{msg}'
                        intercept_failed = True
                elif order.status == OrderStatusChoices.VERIFY_FAILED:
                    exception_module_type = get_exception_module_type(order)
                    module_key = exception_module_type.lower()
                    evidence_map = {
                        'requirement': order.requirement_evidence,
                        'schedule': order.schedule_evidence,
                        'delivery': order.delivery_evidence,
                    }
                    evidence = evidence_map.get(module_key, {})
                    is_complete, msg = check_evidence_complete(module_key, evidence)
                    if not is_complete:
                        failure_reason = f'证据缺失：{msg}'
                        intercept_failed = True

            if intercept_failed:
                results.append(BatchResultItem(
                    order_id=order_id, order_no=order.order_no,
                    success=False, message=failure_reason,
                    failure_reason=failure_reason
                ))
                continue

            if payload.approved:
                with transaction.atomic():
                    transition_status(
                        order=order,
                        module_type='',
                        action='advance',
                        operator=user,
                        remark=payload.remark,
                    )
                if order.status == OrderStatusChoices.REVIEW_PENDING:
                    biz_result = '核验通过，状态变更为待复核'
                else:
                    status_display = dict(OrderStatusChoices.choices).get(order.status, order.status)
                    biz_result = f'核验通过，状态变更为{status_display}'
            else:
                with transaction.atomic():
                    from_status = order.status
                    reason = payload.remark or '批量核验不通过'

                    if order.status == OrderStatusChoices.PENDING_VERIFY:
                        order.requirement_status = RequirementStatusChoices.EXCEPTION
                        module_type = ModuleTypeChoices.REQUIREMENT
                    elif order.status == OrderStatusChoices.VERIFY_FAILED:
                        has_exception = (
                            order.requirement_status == RequirementStatusChoices.EXCEPTION
                            or order.schedule_status == RequirementStatusChoices.EXCEPTION
                            or order.delivery_status == RequirementStatusChoices.EXCEPTION
                        )
                        if has_exception:
                            module_type = get_exception_module_type(order)
                        else:
                            module_type = ModuleTypeChoices.REQUIREMENT
                            order.requirement_status = RequirementStatusChoices.EXCEPTION
                    else:
                        module_type = ModuleTypeChoices.REQUIREMENT

                    order.status = OrderStatusChoices.VERIFY_FAILED
                    order.version += 1
                    order.save()

                    ProcessingRecord.objects.create(
                        order=order,
                        action=ActionChoices.REJECT,
                        operator=user,
                        role=user.role,
                        from_status=from_status,
                        to_status=OrderStatusChoices.VERIFY_FAILED,
                        remark=reason,
                    )

                    ExceptionReason.objects.create(
                        order=order,
                        module_type=module_type,
                        reason=reason,
                        handler=order.current_handler,
                    )

                    AuditNote.objects.create(
                        order=order,
                        note=reason,
                        author=user,
                    )

                    exception_reason = reason
                    biz_result = '核验失败，已写入异常原因'

            results.append(BatchResultItem(
                order_id=order_id, order_no=order.order_no, success=True,
                message=biz_result or '处理成功',
                biz_result=biz_result,
                exception_reason=exception_reason,
                failure_reason=None
            ))
            success_count += 1
        except RequirementDeliveryOrder.DoesNotExist:
            results.append(BatchResultItem(
                order_id=order_id, order_no='', success=False, message='单据不存在',
                failure_reason='单据不存在'
            ))
        except Exception as e:
            order = RequirementDeliveryOrder.objects.filter(id=order_id).first()
            failure_reason = str(e)
            results.append(BatchResultItem(
                order_id=order_id, order_no=order.order_no if order else '',
                success=False, message=failure_reason,
                failure_reason=failure_reason
            ))
    return BatchResult(
        total=len(payload.order_ids),
        success_count=success_count,
        failed_count=len(payload.order_ids) - success_count,
        results=results,
    )


@api.post('/orders/batch-process', response=BatchResult)
def batch_process_orders(request, payload: BatchProcessSchema):
    user = auth_required(request)
    if not can_verify_order(user):
        raise PermissionDeniedError('您没有批量处理的权限')
    if payload.action == 'advance':
        advance_payload = BatchAdvanceSchema(
            order_ids=payload.order_ids,
            remark=payload.remark,
        )
        return batch_advance_orders(request, advance_payload)
    elif payload.action == 'verify':
        approved = payload.approved if payload.approved is not None else True
        verify_payload = BatchVerifySchema(
            order_ids=payload.order_ids,
            approved=approved,
            remark=payload.remark,
        )
        return batch_verify_orders(request, verify_payload)
    else:
        return BatchResult(
            total=len(payload.order_ids),
            success_count=0,
            failed_count=len(payload.order_ids),
            results=[
                BatchResultItem(
                    order_id=oid,
                    order_no='',
                    success=False,
                    message=f'不支持的 action: {payload.action}',
                )
                for oid in payload.order_ids
            ],
        )


@api.get('/statistics', response=StatisticsSchema)
def get_statistics(request):
    auth_required(request)
    qs = RequirementDeliveryOrder.objects
    by_status = {
        status: qs.filter(status=status).count()
        for status, _ in OrderStatusChoices.choices
    }
    by_module = {
        'requirement': {
            status: qs.filter(requirement_status=status).count()
            for status, _ in RequirementStatusChoices.choices
        },
        'schedule': {
            status: qs.filter(schedule_status=status).count()
            for status, _ in RequirementStatusChoices.choices
        },
        'delivery': {
            status: qs.filter(delivery_status=status).count()
            for status, _ in RequirementStatusChoices.choices
        },
    }
    return StatisticsSchema(
        total_orders=qs.count(),
        pending_verify=qs.filter(status=OrderStatusChoices.PENDING_VERIFY).count(),
        verify_failed=qs.filter(status=OrderStatusChoices.VERIFY_FAILED).count(),
        verify_completed=qs.filter(status__in=[
            OrderStatusChoices.VERIFY_COMPLETED,
            OrderStatusChoices.REVIEW_COMPLETED,
            OrderStatusChoices.ARCHIVED,
        ]).count(),
        in_progress=qs.filter(status__in=[
            OrderStatusChoices.REQUIREMENT_SUBMITTED,
            OrderStatusChoices.REQUIREMENT_AUDITED,
            OrderStatusChoices.SCHEDULE_SUBMITTED,
            OrderStatusChoices.SCHEDULE_AUDITED,
            OrderStatusChoices.DELIVERY_SUBMITTED,
            OrderStatusChoices.DELIVERY_AUDITED,
            OrderStatusChoices.REVIEW_PENDING,
            OrderStatusChoices.REVIEW_COMPLETED,
        ]).count(),
        archived=qs.filter(status=OrderStatusChoices.ARCHIVED).count(),
        by_status=by_status,
        by_module=by_module,
    )


@api.get('/deadline-warnings', response=List[DeadlineWarningSchema])
def get_deadline_warnings(request):
    auth_required(request)
    warnings = []
    today = date.today()
    orders = RequirementDeliveryOrder.objects.select_related('current_handler').all()
    for order in orders:
        for module_type, deadline in [
            ('需求确认', order.requirement_deadline),
            ('排期评估', order.schedule_deadline),
            ('交付验收', order.delivery_deadline),
        ]:
            if not deadline:
                continue
            warning = get_deadline_warning(deadline)
            if warning and warning[0] != 'normal':
                level, days_left = warning
                warnings.append(DeadlineWarningSchema(
                    order_id=order.id,
                    order_no=order.order_no,
                    title=order.title,
                    project_name=order.project_name,
                    module_type=module_type,
                    deadline=deadline,
                    days_left=days_left,
                    warning_level=level,
                    handler=UserSchema.from_orm(order.current_handler) if order.current_handler else None,
                ))
    warnings.sort(key=lambda x: x.days_left)
    return warnings


@api.get('/users', response=List[UserSchema])
def list_users(request, role: Optional[str] = None):
    auth_required(request)
    queryset = User.objects.filter(is_active=True)
    if role:
        queryset = queryset.filter(role=role)
    return [UserSchema.from_orm(u) for u in queryset]


@api.get('/orders/{order_id}/allowed-actions')
def get_order_allowed_actions(request, order_id: int):
    user = auth_required(request)
    order = RequirementDeliveryOrder.objects.get(id=order_id)
    return {'actions': get_allowed_actions(user, order)}

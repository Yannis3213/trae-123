from datetime import date, timedelta
from typing import Optional

from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone
from ninja import Router
from ninja.errors import HttpError

from listings.models import (
    VehicleListingApplication,
    ProcessingRecord,
    AuditNote,
    ApplicationStatus,
    RoleChoices,
    STATUS_LABEL_MAP,
    ROLE_DISPLAY_MAP,
)
from .auth import get_operator_from_session
from .schemas import (
    ApplicationOut,
    ApplicationCreate,
    ApplicationSupplement,
    ApplicationProcess,
    ApplicationReview,
    StateCheck,
    PaginatedApplicationOut,
    ErrorResponse,
)

listings_router = Router()


def _check_auth(request):
    operator = get_operator_from_session(request)
    if not operator:
        raise HttpError(401, '未登录，请先登录')
    return operator


def _check_role(operator, allowed_roles, action_name):
    if operator.role not in allowed_roles:
        role_display = ROLE_DISPLAY_MAP.get(operator.role, operator.role)
        return f"当前角色'{role_display}'无权执行'{action_name}'操作"
    return None


def _check_version(app, request_status, request_version):
    if app.status != request_status or app.version != request_version:
        return f"版本冲突：页面版本{request_version}与服务端版本{app.version}不一致"
    return None


def _get_responsible_person_display(app):
    person = app.responsible_person
    if person:
        return person.display_name
    return None


def _app_to_out(app):
    return ApplicationOut(
        id=app.id,
        application_no=app.application_no,
        brand=app.brand,
        model_name=app.model_name,
        year=app.year,
        vin=app.vin,
        license_plate=app.license_plate,
        mileage=app.mileage,
        status=app.status,
        version=app.version,
        applicant=app.applicant_id,
        evaluator=app.evaluator_id,
        reviewer=app.reviewer_id,
        applicant_display=app.applicant.display_name if app.applicant else None,
        evaluator_display=app.evaluator.display_name if app.evaluator else None,
        reviewer_display=app.reviewer.display_name if app.reviewer else None,
        store_name=app.store_name,
        has_listing_evidence=app.has_listing_evidence,
        missing_evidence_reason=app.missing_evidence_reason,
        supplement_remark=app.supplement_remark,
        evaluation_result=app.evaluation_result,
        review_result=app.review_result,
        reject_reason=app.reject_reason,
        deadline=app.deadline,
        created_at=app.created_at,
        updated_at=app.updated_at,
        page_label=app.page_label,
        expiry_status=app.expiry_status,
        responsible_person_display=_get_responsible_person_display(app),
    )


def _create_record_and_note(app, operator, action, from_status, to_status, remark='', failure_reason=''):
    role_display = ROLE_DISPLAY_MAP.get(operator.role, operator.role)
    ProcessingRecord.objects.create(
        application=app,
        operator=operator,
        operator_role=role_display,
        action=action,
        from_status=from_status,
        to_status=to_status,
        remark=remark,
        failure_reason=failure_reason,
    )
    AuditNote.objects.create(
        application=app,
        operator=operator,
        operator_role=role_display,
        note=f'{action}: {remark}' if remark else action,
        failure_reason=failure_reason,
    )


def _generate_application_no():
    today = date.today()
    date_str = today.strftime('%Y%m%d')
    prefix = f'CJ{date_str}'
    last_app = VehicleListingApplication.objects.filter(
        application_no__startswith=prefix
    ).order_by('-application_no').first()
    if last_app:
        seq = int(last_app.application_no[-4:]) + 1
    else:
        seq = 1
    return f'{prefix}{seq:04d}'


def _filter_queryset(qs, params):
    status = params.get('status')
    if status:
        qs = qs.filter(status=status)

    page_label = params.get('page_label')
    if page_label:
        status_map = {}
        for s, label in STATUS_LABEL_MAP.items():
            status_map.setdefault(label, []).append(s)
        statuses = status_map.get(page_label, [])
        if statuses:
            qs = qs.filter(status__in=statuses)
        else:
            qs = qs.none()

    store_name = params.get('store_name')
    if store_name:
        qs = qs.filter(store_name=store_name)

    applicant_id = params.get('applicant_id')
    if applicant_id:
        qs = qs.filter(applicant_id=applicant_id)

    evaluator_id = params.get('evaluator_id')
    if evaluator_id:
        qs = qs.filter(evaluator_id=evaluator_id)

    expiry_status = params.get('expiry_status')
    if expiry_status:
        now = timezone.now()
        if expiry_status == 'normal':
            qs = qs.filter(Q(deadline__isnull=True) | Q(deadline__gt=now + timedelta(days=3)))
        elif expiry_status == 'near_expiry':
            qs = qs.filter(deadline__gt=now, deadline__lte=now + timedelta(days=3))
        elif expiry_status == 'overdue':
            qs = qs.filter(deadline__lt=now)

    search = params.get('search')
    if search:
        qs = qs.filter(
            Q(application_no__icontains=search)
            | Q(vin__icontains=search)
            | Q(license_plate__icontains=search)
        )

    return qs


@listings_router.get('', response=PaginatedApplicationOut)
def list_applications(
    request,
    status: Optional[str] = None,
    page_label: Optional[str] = None,
    store_name: Optional[str] = None,
    applicant_id: Optional[int] = None,
    evaluator_id: Optional[int] = None,
    expiry_status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
):
    _check_auth(request)
    qs = VehicleListingApplication.objects.select_related(
        'applicant', 'evaluator', 'reviewer'
    ).all()

    params = {
        'status': status,
        'page_label': page_label,
        'store_name': store_name,
        'applicant_id': applicant_id,
        'evaluator_id': evaluator_id,
        'expiry_status': expiry_status,
        'search': search,
    }
    qs = _filter_queryset(qs, params)

    count = qs.count()
    start = (page - 1) * page_size
    end = start + page_size
    apps = qs[start:end]

    all_apps = VehicleListingApplication.objects.all()
    stats = {
        'pending_supplement': all_apps.filter(status__in=[
            ApplicationStatus.DRAFT, ApplicationStatus.PENDING_SUPPLEMENT,
            ApplicationStatus.RETURNED, ApplicationStatus.PENDING_PROCESS,
        ]).count(),
        'under_review': all_apps.filter(status__in=[
            ApplicationStatus.PROCESSING, ApplicationStatus.UNDER_REVIEW,
        ]).count(),
        'completed': all_apps.filter(status=ApplicationStatus.COMPLETED).count(),
    }

    results = [_app_to_out(app) for app in apps]
    return PaginatedApplicationOut(count=count, results=results, stats=stats)


@listings_router.get('{application_id}', response=ApplicationOut)
def get_application(request, application_id: int):
    _check_auth(request)
    try:
        app = VehicleListingApplication.objects.select_related(
            'applicant', 'evaluator', 'reviewer'
        ).prefetch_related('attachments', 'processing_records', 'audit_notes').get(id=application_id)
    except VehicleListingApplication.DoesNotExist:
        raise HttpError(404, f'车源上架单ID {application_id} 不存在')
    return _app_to_out(app)


@listings_router.post('', response={201: ApplicationOut, 400: ErrorResponse})
def create_application(request, payload: ApplicationCreate):
    operator = _check_auth(request)

    role_error = _check_role(operator, [RoleChoices.CONSULTANT], '创建')
    if role_error:
        raise HttpError(403, role_error)

    if not payload.has_listing_evidence and not payload.missing_evidence_reason.strip():
        raise HttpError(400, '缺挂牌确认证据时必须填写原因')

    with transaction.atomic():
        app = VehicleListingApplication.objects.create(
            application_no=_generate_application_no(),
            brand=payload.brand,
            model_name=payload.model_name,
            year=payload.year,
            vin=payload.vin,
            license_plate=payload.license_plate,
            mileage=payload.mileage,
            status=ApplicationStatus.DRAFT,
            applicant=operator,
            store_name=payload.store_name or operator.store_name,
            has_listing_evidence=payload.has_listing_evidence,
            missing_evidence_reason=payload.missing_evidence_reason,
            deadline=payload.deadline,
        )
        _create_record_and_note(
            app, operator, 'create', '', ApplicationStatus.DRAFT,
            remark=f'创建车源上架单 {app.application_no}',
        )

    return 201, _app_to_out(app)


@listings_router.post('{application_id}/submit', response={200: ApplicationOut, 409: ErrorResponse})
def submit_application(request, application_id: int, payload: StateCheck):
    operator = _check_auth(request)

    try:
        app = VehicleListingApplication.objects.select_for_update().get(id=application_id)
    except VehicleListingApplication.DoesNotExist:
        raise HttpError(404, f'车源上架单ID {application_id} 不存在')

    role_error = _check_role(operator, [RoleChoices.CONSULTANT], '提交')
    if role_error:
        raise HttpError(403, role_error)

    if app.applicant_id != operator.id:
        raise HttpError(403, f"车源上架单{app.application_no}：只有申请人本人才能提交")

    version_error = _check_version(app, payload.status, payload.version)
    if version_error:
        raise HttpError(409, f"车源上架单{app.application_no}：{version_error}，请刷新后重试")

    allowed_statuses = [ApplicationStatus.DRAFT, ApplicationStatus.PENDING_SUPPLEMENT, ApplicationStatus.RETURNED]
    if app.status not in allowed_statuses:
        status_display = dict(ApplicationStatus.choices).get(app.status, app.status)
        raise HttpError(400, f"车源上架单{app.application_no}：当前状态为'{status_display}'，无法提交")

    from_status = app.status

    with transaction.atomic():
        if app.has_listing_evidence:
            app.status = ApplicationStatus.PENDING_PROCESS
        else:
            app.status = ApplicationStatus.PENDING_SUPPLEMENT

        app.version = F('version') + 1
        app.save()
        app.refresh_from_db()

        _create_record_and_note(
            app, operator, 'submit', from_status, app.status,
            remark=f'提交车源上架单，状态变更为{app.get_status_display()}',
        )

    return 200, _app_to_out(app)


@listings_router.post('{application_id}/supplement', response={200: ApplicationOut, 409: ErrorResponse})
def supplement_application(request, application_id: int, payload: ApplicationSupplement):
    operator = _check_auth(request)

    try:
        app = VehicleListingApplication.objects.select_for_update().get(id=application_id)
    except VehicleListingApplication.DoesNotExist:
        raise HttpError(404, f'车源上架单ID {application_id} 不存在')

    role_error = _check_role(operator, [RoleChoices.CONSULTANT], '补正')
    if role_error:
        raise HttpError(403, f"车源上架单{app.application_no}：{role_error}")

    if app.applicant_id != operator.id:
        raise HttpError(403, f"车源上架单{app.application_no}：只有申请人本人才能补正")

    version_error = _check_version(app, payload.status, payload.version)
    if version_error:
        raise HttpError(409, f"车源上架单{app.application_no}：{version_error}，请刷新后重试")

    allowed_statuses = [ApplicationStatus.PENDING_SUPPLEMENT, ApplicationStatus.RETURNED]
    if app.status not in allowed_statuses:
        status_display = dict(ApplicationStatus.choices).get(app.status, app.status)
        raise HttpError(400, f"车源上架单{app.application_no}：当前状态为'{status_display}'，无法补正")

    from_status = app.status

    with transaction.atomic():
        if payload.has_listing_evidence is not None:
            app.has_listing_evidence = payload.has_listing_evidence
        if payload.has_listing_evidence is True and app.missing_evidence_reason:
            app.missing_evidence_reason = f'(已补正) {app.missing_evidence_reason}'
        if payload.missing_evidence_reason:
            app.missing_evidence_reason = payload.missing_evidence_reason
        app.supplement_remark = payload.supplement_remark
        app.status = ApplicationStatus.PENDING_PROCESS
        app.version = F('version') + 1
        app.save()
        app.refresh_from_db()

        _create_record_and_note(
            app, operator, 'supplement', from_status, app.status,
            remark=f'补正车源上架单: {payload.supplement_remark}',
        )

    return 200, _app_to_out(app)


@listings_router.post('{application_id}/process', response={200: ApplicationOut, 409: ErrorResponse})
def process_application(request, application_id: int, payload: ApplicationProcess):
    operator = _check_auth(request)

    try:
        app = VehicleListingApplication.objects.select_for_update().get(id=application_id)
    except VehicleListingApplication.DoesNotExist:
        raise HttpError(404, f'车源上架单ID {application_id} 不存在')

    role_error = _check_role(operator, [RoleChoices.EVALUATOR], '处理')
    if role_error:
        raise HttpError(403, f"车源上架单{app.application_no}：{role_error}")

    version_error = _check_version(app, payload.status, payload.version)
    if version_error:
        raise HttpError(409, f"车源上架单{app.application_no}：{version_error}，请刷新后重试")

    allowed_statuses = [ApplicationStatus.PENDING_PROCESS, ApplicationStatus.PROCESSING]
    if app.status not in allowed_statuses:
        status_display = dict(ApplicationStatus.choices).get(app.status, app.status)
        raise HttpError(400, f"车源上架单{app.application_no}：当前状态为'{status_display}'，评估师无法处理")

    from_status = app.status

    with transaction.atomic():
        app.evaluator = operator
        app.evaluation_result = payload.evaluation_result
        app.status = ApplicationStatus.UNDER_REVIEW
        app.version = F('version') + 1
        app.save()
        app.refresh_from_db()

        _create_record_and_note(
            app, operator, 'process', from_status, app.status,
            remark=f'评估处理: {payload.evaluation_result}',
        )

    return 200, _app_to_out(app)


@listings_router.post('{application_id}/review', response={200: ApplicationOut, 409: ErrorResponse})
def review_application(request, application_id: int, payload: ApplicationReview):
    operator = _check_auth(request)

    try:
        app = VehicleListingApplication.objects.select_for_update().get(id=application_id)
    except VehicleListingApplication.DoesNotExist:
        raise HttpError(404, f'车源上架单ID {application_id} 不存在')

    role_error = _check_role(operator, [RoleChoices.MANAGER], '复核')
    if role_error:
        raise HttpError(403, f"车源上架单{app.application_no}：{role_error}")

    version_error = _check_version(app, payload.status, payload.version)
    if version_error:
        raise HttpError(409, f"车源上架单{app.application_no}：{version_error}，请刷新后重试")

    if app.status != ApplicationStatus.UNDER_REVIEW:
        status_display = dict(ApplicationStatus.choices).get(app.status, app.status)
        raise HttpError(400, f"车源上架单{app.application_no}：当前状态为'{status_display}'，无法复核")

    if payload.action not in ('approve', 'return'):
        raise HttpError(400, f"无效的复核动作: {payload.action}")

    if payload.action == 'return' and not payload.reject_reason.strip():
        raise HttpError(400, f"车源上架单{app.application_no}：退回时必须填写退回原因")

    from_status = app.status

    with transaction.atomic():
        app.reviewer = operator
        app.review_result = payload.review_result

        if payload.action == 'approve':
            app.status = ApplicationStatus.COMPLETED
            action_name = 'review'
            remark_text = f'复核通过: {payload.review_result}'
        else:
            app.status = ApplicationStatus.RETURNED
            app.reject_reason = payload.reject_reason
            action_name = 'return'
            remark_text = f'退回补正: {payload.reject_reason}'

        app.version = F('version') + 1
        app.save()
        app.refresh_from_db()

        _create_record_and_note(
            app, operator, action_name, from_status, app.status,
            remark=remark_text,
        )

    return 200, _app_to_out(app)

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from ninja import Router
from ninja.errors import HttpError

from listings.models import (
    VehicleListingApplication,
    ProcessingRecord,
    AuditNote,
    ApplicationStatus,
    RoleChoices,
    ROLE_DISPLAY_MAP,
)
from .auth import get_operator_from_session
from .schemas import BatchProcessItem, BatchProcessResult

batch_router = Router()


def _check_auth(request):
    operator = get_operator_from_session(request)
    if not operator:
        raise HttpError(401, '未登录，请先登录')
    return operator


def _get_status_display(status):
    return dict(ApplicationStatus.choices).get(status, status)


def _process_single_item(operator, item):
    try:
        app = VehicleListingApplication.objects.select_for_update().get(id=item.application_id)
    except VehicleListingApplication.DoesNotExist:
        return BatchProcessResult(
            application_id=item.application_id,
            application_no='未知',
            success=False,
            reason=f'车源上架单ID {item.application_id} 不存在',
        )

    action = item.action

    if action == 'submit':
        if operator.role != RoleChoices.CONSULTANT:
            return BatchProcessResult(
                application_id=app.id,
                application_no=app.application_no,
                success=False,
                reason=f"越权操作：{ROLE_DISPLAY_MAP.get(operator.role, operator.role)}不能执行提交",
            )
        if app.applicant_id != operator.id:
            return BatchProcessResult(
                application_id=app.id,
                application_no=app.application_no,
                success=False,
                reason=f"车源上架单{app.application_no}：只有申请人本人才能提交",
            )
        allowed = [ApplicationStatus.DRAFT, ApplicationStatus.PENDING_SUPPLEMENT, ApplicationStatus.RETURNED]
        if app.status not in allowed:
            return BatchProcessResult(
                application_id=app.id,
                application_no=app.application_no,
                success=False,
                reason=f"车源上架单{app.application_no}：当前状态为'{_get_status_display(app.status)}'，无法提交",
            )
        from_status = app.status
        new_status = ApplicationStatus.PENDING_PROCESS if app.has_listing_evidence else ApplicationStatus.PENDING_SUPPLEMENT
        if new_status == ApplicationStatus.PENDING_SUPPLEMENT:
            return BatchProcessResult(
                application_id=app.id,
                application_no=app.application_no,
                success=False,
                reason=f"车源上架单{app.application_no}：缺挂牌确认证据，无法推进到待处理",
            )
        with transaction.atomic():
            app.status = new_status
            app.version = F('version') + 1
            app.save()
            app.refresh_from_db()
            role_display = ROLE_DISPLAY_MAP.get(operator.role, operator.role)
            ProcessingRecord.objects.create(
                application=app, operator=operator, operator_role=role_display,
                action='submit', from_status=from_status, to_status=new_status,
                remark=item.remark or '批量提交',
            )
            AuditNote.objects.create(
                application=app, operator=operator, operator_role=role_display,
                note=f'批量提交: {item.remark}' if item.remark else '批量提交',
            )
        return BatchProcessResult(
            application_id=app.id,
            application_no=app.application_no,
            success=True,
            reason=f'提交成功，状态变更为{_get_status_display(new_status)}',
        )

    elif action == 'supplement':
        if operator.role != RoleChoices.CONSULTANT:
            return BatchProcessResult(
                application_id=app.id,
                application_no=app.application_no,
                success=False,
                reason=f"越权操作：{ROLE_DISPLAY_MAP.get(operator.role, operator.role)}不能执行补正",
            )
        if app.applicant_id != operator.id:
            return BatchProcessResult(
                application_id=app.id,
                application_no=app.application_no,
                success=False,
                reason=f"车源上架单{app.application_no}：只有申请人本人才能补正",
            )
        allowed = [ApplicationStatus.PENDING_SUPPLEMENT, ApplicationStatus.RETURNED]
        if app.status not in allowed:
            return BatchProcessResult(
                application_id=app.id,
                application_no=app.application_no,
                success=False,
                reason=f"车源上架单{app.application_no}：当前状态为'{_get_status_display(app.status)}'，无法补正",
            )
        from_status = app.status
        with transaction.atomic():
            app.has_listing_evidence = True
            app.missing_evidence_reason = ''
            app.status = ApplicationStatus.PENDING_PROCESS
            app.version = F('version') + 1
            app.save()
            app.refresh_from_db()
            role_display = ROLE_DISPLAY_MAP.get(operator.role, operator.role)
            ProcessingRecord.objects.create(
                application=app, operator=operator, operator_role=role_display,
                action='supplement', from_status=from_status, to_status=ApplicationStatus.PENDING_PROCESS,
                remark=item.remark or '批量补正',
            )
            AuditNote.objects.create(
                application=app, operator=operator, operator_role=role_display,
                note=f'批量补正: {item.remark}' if item.remark else '批量补正',
            )
        return BatchProcessResult(
            application_id=app.id,
            application_no=app.application_no,
            success=True,
            reason='补正成功，状态变更为待处理',
        )

    elif action == 'process':
        if operator.role != RoleChoices.EVALUATOR:
            return BatchProcessResult(
                application_id=app.id,
                application_no=app.application_no,
                success=False,
                reason=f"越权操作：{ROLE_DISPLAY_MAP.get(operator.role, operator.role)}不能执行处理",
            )
        allowed = [ApplicationStatus.PENDING_PROCESS, ApplicationStatus.PROCESSING]
        if app.status not in allowed:
            return BatchProcessResult(
                application_id=app.id,
                application_no=app.application_no,
                success=False,
                reason=f"车源上架单{app.application_no}：当前状态为'{_get_status_display(app.status)}'，评估师无法处理",
            )
        from_status = app.status
        with transaction.atomic():
            app.evaluator = operator
            app.status = ApplicationStatus.UNDER_REVIEW
            app.version = F('version') + 1
            app.save()
            app.refresh_from_db()
            role_display = ROLE_DISPLAY_MAP.get(operator.role, operator.role)
            ProcessingRecord.objects.create(
                application=app, operator=operator, operator_role=role_display,
                action='process', from_status=from_status, to_status=ApplicationStatus.UNDER_REVIEW,
                remark=item.remark or '批量评估处理',
            )
            AuditNote.objects.create(
                application=app, operator=operator, operator_role=role_display,
                note=f'批量评估处理: {item.remark}' if item.remark else '批量评估处理',
            )
        return BatchProcessResult(
            application_id=app.id,
            application_no=app.application_no,
            success=True,
            reason='评估处理成功，状态变更为复核中',
        )

    elif action == 'review':
        if operator.role != RoleChoices.MANAGER:
            return BatchProcessResult(
                application_id=app.id,
                application_no=app.application_no,
                success=False,
                reason=f"越权操作：{ROLE_DISPLAY_MAP.get(operator.role, operator.role)}不能执行复核",
            )
        if app.status != ApplicationStatus.UNDER_REVIEW:
            return BatchProcessResult(
                application_id=app.id,
                application_no=app.application_no,
                success=False,
                reason=f"车源上架单{app.application_no}：当前状态为'{_get_status_display(app.status)}'，无法复核",
            )
        from_status = app.status
        with transaction.atomic():
            app.reviewer = operator
            app.status = ApplicationStatus.COMPLETED
            app.version = F('version') + 1
            app.save()
            app.refresh_from_db()
            role_display = ROLE_DISPLAY_MAP.get(operator.role, operator.role)
            ProcessingRecord.objects.create(
                application=app, operator=operator, operator_role=role_display,
                action='review', from_status=from_status, to_status=ApplicationStatus.COMPLETED,
                remark=item.remark or '批量复核通过',
            )
            AuditNote.objects.create(
                application=app, operator=operator, operator_role=role_display,
                note=f'批量复核通过: {item.remark}' if item.remark else '批量复核通过',
            )
        return BatchProcessResult(
            application_id=app.id,
            application_no=app.application_no,
            success=True,
            reason='复核通过，状态变更为办结',
        )

    else:
        return BatchProcessResult(
            application_id=app.id,
            application_no=app.application_no,
            success=False,
            reason=f"不支持的操作类型: {action}",
        )


@batch_router.post('process', response=list[BatchProcessResult])
def batch_process(request, items: list[BatchProcessItem]):
    operator = _check_auth(request)
    results = []
    for item in items:
        result = _process_single_item(operator, item)
        results.append(result)
    return results


@batch_router.post('advance-overdue', response=list[BatchProcessResult])
def batch_advance_overdue(request):
    operator = _check_auth(request)
    if operator.role != RoleChoices.EVALUATOR:
        raise HttpError(403, f"越权操作：{ROLE_DISPLAY_MAP.get(operator.role, operator.role)}不能执行逾期推进")

    now = timezone.now()
    overdue_apps = VehicleListingApplication.objects.filter(
        status=ApplicationStatus.PENDING_PROCESS,
        deadline__lt=now,
    ).select_related('applicant', 'evaluator')

    results = []
    for app in overdue_apps:
        try:
            with transaction.atomic():
                app_locked = VehicleListingApplication.objects.select_for_update().get(id=app.id)
                if app_locked.status != ApplicationStatus.PENDING_PROCESS:
                    results.append(BatchProcessResult(
                        application_id=app_locked.id,
                        application_no=app_locked.application_no,
                        success=False,
                        reason=f"车源上架单{app_locked.application_no}：当前状态为'{_get_status_display(app_locked.status)}'，已不是待处理状态",
                    ))
                    continue

                from_status = app_locked.status
                app_locked.evaluator = operator
                app_locked.status = ApplicationStatus.UNDER_REVIEW
                app_locked.version = F('version') + 1
                app_locked.save()
                app_locked.refresh_from_db()

                responsible = app_locked.responsible_person
                responsible_name = responsible.display_name if responsible else '未知'

                role_display = ROLE_DISPLAY_MAP.get(operator.role, operator.role)
                ProcessingRecord.objects.create(
                    application=app_locked, operator=operator, operator_role=role_display,
                    action='process', from_status=from_status, to_status=ApplicationStatus.UNDER_REVIEW,
                    remark='逾期自动推进至复核',
                    failure_reason=f'逾期处理：负责人{responsible_name}未在截止时间内处理',
                )
                AuditNote.objects.create(
                    application=app_locked, operator=operator, operator_role=role_display,
                    note='逾期自动推进至复核',
                    failure_reason=f'逾期处理：负责人{responsible_name}未在截止时间内处理',
                )

                results.append(BatchProcessResult(
                    application_id=app_locked.id,
                    application_no=app_locked.application_no,
                    success=True,
                    reason=f"车源上架单{app_locked.application_no}：逾期自动推进至复核，原负责人{responsible_name}超时未处理",
                ))
        except Exception as e:
            results.append(BatchProcessResult(
                application_id=app.id,
                application_no=app.application_no,
                success=False,
                reason=f"车源上架单{app.application_no}：处理异常 - {str(e)}",
            ))

    return results

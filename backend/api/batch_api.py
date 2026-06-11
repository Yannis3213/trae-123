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


def _record_batch_failure(app, operator, action, failure_reason):
    role_display = ROLE_DISPLAY_MAP.get(operator.role, operator.role)
    ProcessingRecord.objects.create(
        application=app,
        operator=operator,
        operator_role=role_display,
        action=f'batch_{action}',
        from_status=app.status,
        to_status=app.status,
        remark=f'批量{action}失败',
        failure_reason=failure_reason,
    )
    AuditNote.objects.create(
        application=app,
        operator=operator,
        operator_role=role_display,
        note=f'批量{action}失败：{failure_reason}',
        failure_reason=failure_reason,
    )


def _process_single_item(operator, item):
    with transaction.atomic():
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

        if not item.status:
            reason = f"车源上架单{app.application_no}：缺少页面状态参数，无法执行批量操作"
            _record_batch_failure(app, operator, action, reason)
            return BatchProcessResult(
                application_id=app.id,
                application_no=app.application_no,
                success=False,
                reason=reason,
            )
        if item.version <= 0:
            reason = f"车源上架单{app.application_no}：缺少页面版本参数，无法执行批量操作"
            _record_batch_failure(app, operator, action, reason)
            return BatchProcessResult(
                application_id=app.id,
                application_no=app.application_no,
                success=False,
                reason=reason,
            )
        if app.status != item.status or app.version != item.version:
            reason = f"车源上架单{app.application_no}：并发冲突：页面版本{item.version}与服务端版本{app.version}不一致，请刷新后重试"
            _record_batch_failure(app, operator, action, reason)
            return BatchProcessResult(
                application_id=app.id,
                application_no=app.application_no,
                success=False,
                reason=reason,
            )

        if action == 'submit':
            if operator.role != RoleChoices.CONSULTANT:
                reason = f"越权操作：{ROLE_DISPLAY_MAP.get(operator.role, operator.role)}不能执行提交"
                _record_batch_failure(app, operator, action, reason)
                return BatchProcessResult(
                    application_id=app.id,
                    application_no=app.application_no,
                    success=False,
                    reason=reason,
                )
            if app.applicant_id != operator.id:
                reason = f"车源上架单{app.application_no}：只有申请人本人才能提交"
                _record_batch_failure(app, operator, action, reason)
                return BatchProcessResult(
                    application_id=app.id,
                    application_no=app.application_no,
                    success=False,
                    reason=reason,
                )
            allowed = [ApplicationStatus.DRAFT, ApplicationStatus.PENDING_SUPPLEMENT, ApplicationStatus.RETURNED]
            if app.status not in allowed:
                reason = f"车源上架单{app.application_no}：当前状态为'{_get_status_display(app.status)}'，无法提交"
                if app.expiry_status == 'overdue':
                    responsible = app.responsible_person
                    responsible_name = responsible.display_name if responsible else '未知'
                    reason = f"车源上架单{app.application_no}：逾期拦截——当前状态为'{_get_status_display(app.status)}'不允许提交，负责人{responsible_name}超时未处理"
                _record_batch_failure(app, operator, action, reason)
                return BatchProcessResult(
                    application_id=app.id,
                    application_no=app.application_no,
                    success=False,
                    reason=reason,
                )
            from_status = app.status
            new_status = ApplicationStatus.PENDING_PROCESS if app.has_listing_evidence else ApplicationStatus.PENDING_SUPPLEMENT
            if new_status == ApplicationStatus.PENDING_SUPPLEMENT:
                reason = f"车源上架单{app.application_no}：缺挂牌确认证据，无法推进到待处理"
                _record_batch_failure(app, operator, action, reason)
                return BatchProcessResult(
                    application_id=app.id,
                    application_no=app.application_no,
                    success=False,
                    reason=reason,
                )
            app.status = new_status
            app.version = F('version') + 1
            app.save()
            app.refresh_from_db()
            role_display = ROLE_DISPLAY_MAP.get(operator.role, operator.role)
            ProcessingRecord.objects.create(
                application=app, operator=operator, operator_role=role_display,
                action='batch_submit', from_status=from_status, to_status=new_status,
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
                reason = f"越权操作：{ROLE_DISPLAY_MAP.get(operator.role, operator.role)}不能执行补正"
                _record_batch_failure(app, operator, action, reason)
                return BatchProcessResult(
                    application_id=app.id,
                    application_no=app.application_no,
                    success=False,
                    reason=reason,
                )
            if app.applicant_id != operator.id:
                reason = f"车源上架单{app.application_no}：只有申请人本人才能补正"
                _record_batch_failure(app, operator, action, reason)
                return BatchProcessResult(
                    application_id=app.id,
                    application_no=app.application_no,
                    success=False,
                    reason=reason,
                )
            allowed = [ApplicationStatus.PENDING_SUPPLEMENT, ApplicationStatus.RETURNED]
            if app.status not in allowed:
                reason = f"车源上架单{app.application_no}：当前状态为'{_get_status_display(app.status)}'，无法补正"
                if app.expiry_status == 'overdue':
                    responsible = app.responsible_person
                    responsible_name = responsible.display_name if responsible else '未知'
                    reason = f"车源上架单{app.application_no}：逾期拦截——当前状态为'{_get_status_display(app.status)}'不允许补正，负责人{responsible_name}超时未处理"
                _record_batch_failure(app, operator, action, reason)
                return BatchProcessResult(
                    application_id=app.id,
                    application_no=app.application_no,
                    success=False,
                    reason=reason,
                )
            if not app.has_listing_evidence:
                reason = f"车源上架单{app.application_no}：缺挂牌确认证据，补正后仍无法推进到待处理"
                _record_batch_failure(app, operator, action, reason)
                return BatchProcessResult(
                    application_id=app.id,
                    application_no=app.application_no,
                    success=False,
                    reason=reason,
                )
            from_status = app.status
            app.has_listing_evidence = True
            app.missing_evidence_reason = ''
            app.status = ApplicationStatus.PENDING_PROCESS
            app.version = F('version') + 1
            app.save()
            app.refresh_from_db()
            role_display = ROLE_DISPLAY_MAP.get(operator.role, operator.role)
            ProcessingRecord.objects.create(
                application=app, operator=operator, operator_role=role_display,
                action='batch_supplement', from_status=from_status, to_status=ApplicationStatus.PENDING_PROCESS,
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
                reason = f"越权操作：{ROLE_DISPLAY_MAP.get(operator.role, operator.role)}不能执行处理"
                _record_batch_failure(app, operator, action, reason)
                return BatchProcessResult(
                    application_id=app.id,
                    application_no=app.application_no,
                    success=False,
                    reason=reason,
                )
            allowed = [ApplicationStatus.PENDING_PROCESS, ApplicationStatus.PROCESSING]
            if app.status not in allowed:
                reason = f"车源上架单{app.application_no}：当前状态为'{_get_status_display(app.status)}'，评估师无法处理"
                if app.expiry_status == 'overdue':
                    responsible = app.responsible_person
                    responsible_name = responsible.display_name if responsible else '未知'
                    reason = f"车源上架单{app.application_no}：逾期拦截——当前状态为'{_get_status_display(app.status)}'不允许处理，负责人{responsible_name}超时未处理"
                _record_batch_failure(app, operator, action, reason)
                return BatchProcessResult(
                    application_id=app.id,
                    application_no=app.application_no,
                    success=False,
                    reason=reason,
                )
            from_status = app.status
            app.evaluator = operator
            app.status = ApplicationStatus.UNDER_REVIEW
            app.version = F('version') + 1
            app.save()
            app.refresh_from_db()
            role_display = ROLE_DISPLAY_MAP.get(operator.role, operator.role)
            ProcessingRecord.objects.create(
                application=app, operator=operator, operator_role=role_display,
                action='batch_process', from_status=from_status, to_status=ApplicationStatus.UNDER_REVIEW,
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
                reason = f"越权操作：{ROLE_DISPLAY_MAP.get(operator.role, operator.role)}不能执行复核"
                _record_batch_failure(app, operator, action, reason)
                return BatchProcessResult(
                    application_id=app.id,
                    application_no=app.application_no,
                    success=False,
                    reason=reason,
                )
            if app.status != ApplicationStatus.UNDER_REVIEW:
                reason = f"车源上架单{app.application_no}：当前状态为'{_get_status_display(app.status)}'，无法复核"
                if app.expiry_status == 'overdue':
                    responsible = app.responsible_person
                    responsible_name = responsible.display_name if responsible else '未知'
                    reason = f"车源上架单{app.application_no}：逾期拦截——当前状态为'{_get_status_display(app.status)}'不允许复核，负责人{responsible_name}超时未处理"
                _record_batch_failure(app, operator, action, reason)
                return BatchProcessResult(
                    application_id=app.id,
                    application_no=app.application_no,
                    success=False,
                    reason=reason,
                )
            from_status = app.status
            app.reviewer = operator
            app.status = ApplicationStatus.COMPLETED
            app.version = F('version') + 1
            app.save()
            app.refresh_from_db()
            role_display = ROLE_DISPLAY_MAP.get(operator.role, operator.role)
            ProcessingRecord.objects.create(
                application=app, operator=operator, operator_role=role_display,
                action='batch_review', from_status=from_status, to_status=ApplicationStatus.COMPLETED,
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
            reason = f"不支持的操作类型: {action}"
            _record_batch_failure(app, operator, action, reason)
            return BatchProcessResult(
                application_id=app.id,
                application_no=app.application_no,
                success=False,
                reason=reason,
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
    overdue_app_ids = VehicleListingApplication.objects.filter(
        deadline__lt=now,
    ).exclude(
        status=ApplicationStatus.COMPLETED
    ).values_list('id', flat=True)

    results = []
    for app_id in overdue_app_ids:
        with transaction.atomic():
            try:
                app = VehicleListingApplication.objects.select_for_update().select_related(
                    'applicant', 'evaluator', 'reviewer'
                ).get(id=app_id)
            except VehicleListingApplication.DoesNotExist:
                results.append(BatchProcessResult(
                    application_id=app_id,
                    application_no='未知',
                    success=False,
                    reason=f'车源上架单ID {app_id} 不存在',
                ))
                continue
            try:
                responsible = app.responsible_person
                responsible_name = responsible.display_name if responsible else '未知'
                responsible_role = ROLE_DISPLAY_MAP.get(responsible.role, responsible.role) if responsible else '未知'

                if app.status == ApplicationStatus.PENDING_PROCESS:
                    reason = f"车源上架单{app.application_no}：逾期拦截——当前状态为待处理，需评估师手动推进，原责任人{responsible_name}({responsible_role})超时未处理"
                elif app.status in [ApplicationStatus.PENDING_SUPPLEMENT, ApplicationStatus.RETURNED, ApplicationStatus.DRAFT]:
                    reason = f"车源上架单{app.application_no}：逾期拦截——当前状态为'{_get_status_display(app.status)}'，需车源顾问先补正材料，原责任人{responsible_name}({responsible_role})超时未处理"
                elif app.status == ApplicationStatus.UNDER_REVIEW:
                    reason = f"车源上架单{app.application_no}：逾期拦截——当前状态为复核中，需门店经理手动复核，原责任人{responsible_name}({responsible_role})超时未处理"
                elif app.status == ApplicationStatus.PROCESSING:
                    reason = f"车源上架单{app.application_no}：逾期拦截——当前状态为处理中，需评估师手动提交评估，原责任人{responsible_name}({responsible_role})超时未处理"
                else:
                    reason = f"车源上架单{app.application_no}：逾期拦截——当前状态为'{_get_status_display(app.status)}'，需要手动处理，原责任人{responsible_name}({responsible_role})超时未处理"

                _record_batch_failure(app, operator, 'advance_overdue', reason)
                results.append(BatchProcessResult(
                    application_id=app.id,
                    application_no=app.application_no,
                    success=False,
                    reason=reason,
                ))
            except Exception as e:
                reason = f"车源上架单{app.application_no}：处理异常 - {str(e)}"
                try:
                    _record_batch_failure(app, operator, 'advance_overdue', reason)
                except Exception:
                    pass
                results.append(BatchProcessResult(
                    application_id=app.id,
                    application_no=app.application_no,
                    success=False,
                    reason=reason,
                ))

    return results

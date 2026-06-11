import json
from datetime import date, datetime, timedelta
from typing import Tuple, Optional, Dict, Any
from dateutil.relativedelta import relativedelta

from django.db import transaction
from django.http import HttpRequest

from api.models import (
    RequirementDeliveryOrder, ProcessingRecord, ExceptionReason,
    OrderStatusChoices, RequirementStatusChoices, ActionChoices, ModuleTypeChoices, User
)


class VersionConflictError(Exception):
    pass


class EvidenceMissingError(Exception):
    pass


class PermissionDeniedError(Exception):
    pass


class StatusTransitionError(Exception):
    pass


def validate_version(order: RequirementDeliveryOrder, expected_version: int) -> None:
    if order.version != expected_version:
        raise VersionConflictError(f'版本冲突，当前版本为 {order.version}，请刷新后重试')


def check_evidence_complete(module_type: str, evidence: Dict[str, Any]) -> Tuple[bool, str]:
    required_fields = {
        'requirement': ['confirmation_document', 'stakeholder_signature'],
        'schedule': ['schedule_plan', 'resource_allocation'],
        'delivery': ['delivery_report', 'acceptance_certificate'],
    }
    fields = required_fields.get(module_type, [])
    missing = [f for f in fields if f not in evidence or not evidence[f]]
    if missing:
        return False, f'缺少必填证据字段: {", ".join(missing)}'
    return True, ''


def increment_version(order: RequirementDeliveryOrder) -> None:
    order.version += 1


@transaction.atomic
def create_processing_record(
    order: RequirementDeliveryOrder,
    action: ActionChoices,
    operator: Optional[User],
    from_status: OrderStatusChoices,
    to_status: OrderStatusChoices,
    remark: str = ''
) -> ProcessingRecord:
    return ProcessingRecord.objects.create(
        order=order,
        action=action,
        operator=operator,
        role=operator.role if operator else '',
        from_status=from_status,
        to_status=to_status,
        remark=remark,
    )


@transaction.atomic
def create_exception_reason(
    order: RequirementDeliveryOrder,
    module_type: ModuleTypeChoices,
    reason: str,
    handler: Optional[User]
) -> ExceptionReason:
    return ExceptionReason.objects.create(
        order=order,
        module_type=module_type,
        reason=reason,
        handler=handler,
    )


def get_deadline_warning(deadline: Optional[date]) -> Optional[Tuple[str, int]]:
    if not deadline:
        return None
    today = date.today()
    days_left = (deadline - today).days
    if days_left < 0:
        return ('overdue', days_left)
    elif days_left <= 3:
        return ('warning', days_left)
    return ('normal', days_left)


def generate_order_no() -> str:
    today = datetime.now()
    prefix = f'XQJF{today.strftime("%Y%m%d")}'
    last_order = RequirementDeliveryOrder.objects.filter(order_no__startswith=prefix).order_by('-order_no').first()
    if last_order:
        try:
            seq = int(last_order.order_no[-4:]) + 1
        except (ValueError, IndexError):
            seq = 1
    else:
        seq = 1
    return f'{prefix}{seq:04d}'


def check_all_modules_completed(order: RequirementDeliveryOrder) -> bool:
    return (
        order.requirement_status == RequirementStatusChoices.COMPLETED
        and order.schedule_status == RequirementStatusChoices.COMPLETED
        and order.delivery_status == RequirementStatusChoices.COMPLETED
    )


def transition_status(
    order: RequirementDeliveryOrder,
    module_type: str,
    action: str,
    operator: User,
    evidence: Optional[Dict[str, Any]] = None,
    remark: str = '',
    approved: bool = True,
    exception_reason: Optional[str] = None,
) -> None:
    from_status = order.status

    if action == 'submit':
        if not approved:
            pass
        if evidence:
            is_complete, msg = check_evidence_complete(module_type, evidence)
            if not is_complete:
                raise EvidenceMissingError(msg)
        if module_type == 'requirement':
            order.requirement_evidence = evidence or {}
            order.requirement_status = RequirementStatusChoices.IN_PROGRESS
            order.status = OrderStatusChoices.REQUIREMENT_SUBMITTED
        elif module_type == 'schedule':
            order.schedule_evidence = evidence or {}
            order.schedule_status = RequirementStatusChoices.IN_PROGRESS
            order.status = OrderStatusChoices.SCHEDULE_SUBMITTED
        elif module_type == 'delivery':
            order.delivery_evidence = evidence or {}
            order.delivery_status = RequirementStatusChoices.IN_PROGRESS
            order.status = OrderStatusChoices.DELIVERY_SUBMITTED
        create_processing_record(order, ActionChoices.SUBMIT, operator, from_status, order.status, remark)

    elif action == 'audit':
        if module_type == 'requirement':
            if approved:
                order.requirement_status = RequirementStatusChoices.COMPLETED
                order.status = OrderStatusChoices.REQUIREMENT_AUDITED
                create_processing_record(order, ActionChoices.APPROVE, operator, from_status, order.status, remark)
            else:
                order.requirement_status = RequirementStatusChoices.EXCEPTION
                order.status = OrderStatusChoices.VERIFY_FAILED
                if exception_reason:
                    create_exception_reason(order, ModuleTypeChoices.REQUIREMENT, exception_reason, operator)
                create_processing_record(order, ActionChoices.REJECT, operator, from_status, order.status, remark)
        elif module_type == 'schedule':
            if approved:
                order.schedule_status = RequirementStatusChoices.COMPLETED
                order.status = OrderStatusChoices.SCHEDULE_AUDITED
                create_processing_record(order, ActionChoices.APPROVE, operator, from_status, order.status, remark)
            else:
                order.schedule_status = RequirementStatusChoices.EXCEPTION
                order.status = OrderStatusChoices.VERIFY_FAILED
                if exception_reason:
                    create_exception_reason(order, ModuleTypeChoices.SCHEDULE, exception_reason, operator)
                create_processing_record(order, ActionChoices.REJECT, operator, from_status, order.status, remark)
        elif module_type == 'delivery':
            if approved:
                order.delivery_status = RequirementStatusChoices.COMPLETED
                if check_all_modules_completed(order):
                    order.status = OrderStatusChoices.REVIEW_PENDING
                else:
                    order.status = OrderStatusChoices.DELIVERY_AUDITED
                create_processing_record(order, ActionChoices.APPROVE, operator, from_status, order.status, remark)
            else:
                order.delivery_status = RequirementStatusChoices.EXCEPTION
                order.status = OrderStatusChoices.VERIFY_FAILED
                if exception_reason:
                    create_exception_reason(order, ModuleTypeChoices.DELIVERY, exception_reason, operator)
                create_processing_record(order, ActionChoices.REJECT, operator, from_status, order.status, remark)

    elif action == 'advance':
        if order.status == OrderStatusChoices.PENDING_VERIFY:
            order.status = OrderStatusChoices.REQUIREMENT_AUDITED
            order.requirement_status = RequirementStatusChoices.COMPLETED
        elif order.status == OrderStatusChoices.VERIFY_FAILED:
            order.requirement_status = RequirementStatusChoices.COMPLETED
            order.schedule_status = RequirementStatusChoices.COMPLETED
            order.delivery_status = RequirementStatusChoices.COMPLETED
            order.status = OrderStatusChoices.REVIEW_PENDING
        elif order.status == OrderStatusChoices.REQUIREMENT_AUDITED:
            order.schedule_status = RequirementStatusChoices.COMPLETED
            order.status = OrderStatusChoices.SCHEDULE_AUDITED
        elif order.status == OrderStatusChoices.SCHEDULE_AUDITED:
            order.delivery_status = RequirementStatusChoices.COMPLETED
            if check_all_modules_completed(order):
                order.status = OrderStatusChoices.REVIEW_PENDING
            else:
                order.status = OrderStatusChoices.DELIVERY_AUDITED
        create_processing_record(order, ActionChoices.ADVANCE, operator, from_status, order.status, remark)

    elif action == 'review':
        if approved:
            order.status = OrderStatusChoices.REVIEW_COMPLETED
            create_processing_record(order, ActionChoices.REVIEW, operator, from_status, order.status, remark)
        else:
            order.status = OrderStatusChoices.VERIFY_FAILED
            create_processing_record(order, ActionChoices.REJECT, operator, from_status, order.status, remark)

    elif action == 'archive':
        order.status = OrderStatusChoices.ARCHIVED
        order.current_handler = None
        create_processing_record(order, ActionChoices.ARCHIVE, operator, from_status, order.status, remark)

    increment_version(order)
    order.save()

import uuid
from datetime import datetime, timedelta
from typing import Tuple, Optional, List, Dict, Any
from django.contrib.auth.models import User
from django.db import transaction, models
from django.utils import timezone
from .models import (
    AssistanceApplication, ProcessingRecord, AuditNote, ExceptionLog,
    Attachment, NODE_CHOICES, STATUS_CHOICES, WARNING_STATUS_CHOICES,
    ROLE_CHOICES, UserProfile
)


NODE_NAMES = dict(NODE_CHOICES)
STATUS_NAMES = dict(STATUS_CHOICES)
WARNING_NAMES = dict(WARNING_STATUS_CHOICES)
ROLE_NAMES = dict(ROLE_CHOICES)

NODE_TIMEOUT_DAYS = {
    'difficulty_support': 3,
    'home_verification': 5,
    'rescue_confirmation': 2,
}

REQUIRED_EVIDENCE = {
    'difficulty_support': ['identity_proof', 'difficulty_proof'],
    'home_verification': ['visit_record', 'photo_evidence'],
    'rescue_confirmation': ['approval_document', 'amount_calculation'],
}

VALID_ACTIONS = {
    'difficulty_support': {
        'community_worker': ['create', 'submit', 'correct'],
        'street_clerk': ['accept', 'return', 'process'],
    },
    'home_verification': {
        'street_clerk': ['accept', 'verify', 'return', 'process'],
        'leader': ['review'],
    },
    'rescue_confirmation': {
        'leader': ['accept', 'approve', 'reject', 'confirm', 'return'],
    },
}

NODE_TRANSITION = {
    'difficulty_support': 'home_verification',
    'home_verification': 'rescue_confirmation',
    'rescue_confirmation': None,
}


class BusinessException(Exception):
    def __init__(self, error_code: str, error_message: str):
        self.error_code = error_code
        self.error_message = error_message
        super().__init__(error_message)


def get_user_role(user: User) -> str:
    profile = UserProfile.objects.filter(user=user).first()
    return profile.role if profile else None


def get_role_name(role: str) -> str:
    return ROLE_NAMES.get(role, role)


def get_node_name(node: str) -> str:
    return NODE_NAMES.get(node, node)


def get_status_name(status: str) -> str:
    return STATUS_NAMES.get(status, status)


def get_warning_name(warning: str) -> str:
    return WARNING_NAMES.get(warning, warning)


def update_warning_status(application: AssistanceApplication) -> None:
    if not application.node_deadline:
        application.warning_status = 'normal'
        return

    now = timezone.now()
    if now > application.node_deadline:
        application.warning_status = 'overdue'
    elif (application.node_deadline - now) <= timedelta(days=1):
        application.warning_status = 'approaching'
    else:
        application.warning_status = 'normal'


def check_permission(user: User, application: AssistanceApplication, action: str) -> None:
    role = get_user_role(user)
    if not role:
        raise BusinessException('PERMISSION_DENIED', '用户未分配角色，无操作权限')

    node = application.current_node
    valid_actions_for_role = VALID_ACTIONS.get(node, {}).get(role, [])

    if action not in valid_actions_for_role:
        raise BusinessException(
            'PERMISSION_DENIED',
            f'{get_role_name(role)}在{get_node_name(node)}节点不能执行{action}操作'
        )

    if application.current_handler and application.current_handler_id != user.id:
        if action in ['accept']:
            if application.status != 'pending':
                raise BusinessException('STATUS_CONFLICT', '该申请已被接单，状态冲突')
        else:
            raise BusinessException(
                'NOT_HANDLER',
                f'当前处理人为{application.current_handler.username}，您无权处理'
            )


def check_version(application: AssistanceApplication, expected_version: int) -> None:
    if application.version != expected_version:
        raise BusinessException(
            'VERSION_CONFLICT',
            f'版本冲突：当前版本为{application.version}，您提交的版本为{expected_version}'
        )


def check_status(application: AssistanceApplication, allowed_statuses: List[str]) -> None:
    if application.status not in allowed_statuses:
        raise BusinessException(
            'STATUS_CONFLICT',
            f'状态冲突：当前状态为{get_status_name(application.status)}，不允许此操作'
        )


def check_required_evidence(application: AssistanceApplication, node: str) -> None:
    required = REQUIRED_EVIDENCE.get(node, [])
    if not required:
        return

    existing_evidence = set(
        application.attachments.filter(is_required=True).values_list('evidence_type', flat=True)
    )
    missing = [e for e in required if e not in existing_evidence]

    if missing:
        missing_names = {
            'identity_proof': '身份证明',
            'difficulty_proof': '困难证明',
            'visit_record': '走访记录',
            'photo_evidence': '照片证据',
            'approval_document': '审批文件',
            'amount_calculation': '金额计算表',
        }
        missing_str = '、'.join([missing_names.get(m, m) for m in missing])
        raise BusinessException(
            'MISSING_EVIDENCE',
            f'缺少必填证据材料：{missing_str}'
        )


def check_duplicate_submission(application: AssistanceApplication, action: str) -> None:
    recent_record = ProcessingRecord.objects.filter(
        application=application,
        action=action
    ).order_by('-processing_time').first()

    if recent_record and (timezone.now() - recent_record.processing_time) < timedelta(seconds=5):
        raise BusinessException('DUPLICATE_SUBMISSION', '操作过于频繁，请稍后再试')


def validate_process(
    user: User,
    application: AssistanceApplication,
    action: str,
    version: int
) -> None:
    check_version(application, version)
    check_permission(user, application, action)
    check_duplicate_submission(application, action)


def generate_application_no() -> str:
    date_str = timezone.now().strftime('%Y%m%d')
    last_app = AssistanceApplication.objects.filter(
        application_no__startswith=f'BZ{date_str}'
    ).order_by('-application_no').first()

    if last_app:
        seq = int(last_app.application_no[-4:]) + 1
    else:
        seq = 1

    return f'BZ{date_str}{seq:04d}'


def get_next_handler(current_node: str) -> Optional[User]:
    next_node = NODE_TRANSITION.get(current_node)
    if not next_node:
        return None

    role_for_next = None
    if next_node == 'home_verification':
        role_for_next = 'street_clerk'
    elif next_node == 'rescue_confirmation':
        role_for_next = 'leader'

    if role_for_next:
        profile = UserProfile.objects.filter(role=role_for_next).first()
        if profile:
            return profile.user

    return None


def create_processing_record(
    application: AssistanceApplication,
    action: str,
    operator: User,
    comment: str = '',
    previous_status: str = '',
    new_status: str = '',
    previous_handler: User = None,
    new_handler: User = None
) -> ProcessingRecord:
    return ProcessingRecord.objects.create(
        application=application,
        node=application.current_node,
        action=action,
        operator=operator,
        previous_status=previous_status,
        new_status=new_status,
        previous_handler=previous_handler,
        new_handler=new_handler,
        comment=comment,
        version=application.version
    )


def create_audit_note(
    application: AssistanceApplication,
    note_type: str,
    content: str,
    operator: User
) -> AuditNote:
    return AuditNote.objects.create(
        application=application,
        node=application.current_node,
        note_type=note_type,
        content=content,
        operator=operator
    )


def create_exception_log(
    operator: User,
    exception_type: str,
    error_code: str,
    error_message: str,
    application: AssistanceApplication = None,
    batch_id: str = '',
    request_data: str = ''
) -> ExceptionLog:
    return ExceptionLog.objects.create(
        application=application,
        batch_id=batch_id,
        exception_type=exception_type,
        error_code=error_code,
        error_message=error_message,
        operator=operator,
        request_data=request_data
    )


def get_node_deadline(node: str) -> datetime:
    days = NODE_TIMEOUT_DAYS.get(node, 3)
    return timezone.now() + timedelta(days=days)


@transaction.atomic
def process_application_action(
    user: User,
    application: AssistanceApplication,
    action: str,
    version: int,
    comment: str = '',
    evidence_required: List[str] = None
) -> Tuple[AssistanceApplication, ProcessingRecord]:
    role = get_user_role(user)
    previous_status = application.status
    previous_handler = application.current_handler

    validate_process(user, application, action, version)

    if action == 'accept':
        check_status(application, ['pending', 'returned'])
        application.status = 'accepted'
        application.current_handler = user
        application.node_deadline = get_node_deadline(application.current_node)

        if role == 'street_clerk':
            application.street_clerk = user
        elif role == 'leader':
            application.leader = user

    elif action == 'return':
        check_status(application, ['accepted'])
        application.status = 'returned'
        application.current_handler = application.creator
        application.warning_status = 'normal'

    elif action in ['process', 'verify']:
        check_status(application, ['accepted'])
        if application.warning_status == 'overdue':
            raise BusinessException(
                'OVERDUE_BLOCKED',
                '该申请已逾期，不可直接推进，请先退回补正或联系负责人处理'
            )
        check_required_evidence(application, application.current_node)

        next_node = NODE_TRANSITION.get(application.current_node)
        if next_node:
            next_handler = get_next_handler(application.current_node)
            application.current_node = next_node
            application.status = 'pending'
            application.current_handler = next_handler
            application.node_deadline = get_node_deadline(next_node)
        else:
            raise BusinessException('INVALID_ACTION', '当前节点无法继续流转')

    elif action in ['approve', 'confirm']:
        check_status(application, ['accepted'])
        if application.warning_status == 'overdue':
            raise BusinessException(
                'OVERDUE_BLOCKED',
                '该申请已逾期，不可直接审批，请先退回补正或联系负责人处理'
            )
        check_required_evidence(application, application.current_node)
        application.status = 'passed'

    elif action == 'reject':
        check_status(application, ['accepted'])
        application.status = 'rejected'
        application.current_handler = None

    elif action == 'correct':
        check_status(application, ['returned'])
        check_required_evidence(application, application.current_node)
        application.status = 'pending'
        application.node_deadline = None
        application.warning_status = 'normal'

    elif action == 'submit':
        check_status(application, ['pending'])
        application.status = 'pending'
        application.current_handler = get_next_handler('difficulty_support')
        application.node_deadline = get_node_deadline('difficulty_support')

    application.version += 1
    update_warning_status(application)
    application.save()

    record = create_processing_record(
        application=application,
        action=action,
        operator=user,
        comment=comment,
        previous_status=previous_status,
        new_status=application.status,
        previous_handler=previous_handler,
        new_handler=application.current_handler
    )

    if evidence_required:
        create_audit_note(
            application=application,
            note_type='evidence_requirement',
            content=f'需补充材料：{", ".join(evidence_required)}',
            operator=user
        )

    if action == 'return' and comment:
        create_audit_note(
            application=application,
            note_type='return_reason',
            content=f'退回补正原因：{comment}',
            operator=user
        )

    if action == 'correct':
        create_audit_note(
            application=application,
            note_type='correction',
            content='社区专干已补正材料并重新提交',
            operator=user
        )

    return application, record


@transaction.atomic
def create_application(
    user: User,
    data: Dict[str, Any]
) -> AssistanceApplication:
    role = get_user_role(user)
    if role != 'community_worker':
        raise BusinessException('PERMISSION_DENIED', '只有社区专干可以创建帮扶申请')

    application = AssistanceApplication.objects.create(
        application_no=generate_application_no(),
        applicant_name=data['applicant_name'],
        applicant_id_card=data['applicant_id_card'],
        applicant_phone=data['applicant_phone'],
        community=data['community'],
        address=data['address'],
        family_situation=data['family_situation'],
        difficulty_type=data['difficulty_type'],
        application_reason=data['application_reason'],
        apply_amount=data.get('apply_amount'),
        creator=user,
        current_handler=user,
    )

    create_processing_record(
        application=application,
        action='create',
        operator=user,
        new_status='pending',
        new_handler=user
    )

    return application


def build_application_list_schema(app: AssistanceApplication) -> Dict[str, Any]:
    update_warning_status(app)
    return {
        'id': app.id,
        'application_no': app.application_no,
        'applicant_name': app.applicant_name,
        'community': app.community,
        'difficulty_type': app.difficulty_type,
        'current_node': app.current_node,
        'current_node_name': get_node_name(app.current_node),
        'status': app.status,
        'status_name': get_status_name(app.status),
        'warning_status': app.warning_status,
        'warning_status_name': get_warning_name(app.warning_status),
        'current_handler': app.current_handler.username if app.current_handler else None,
        'creator': app.creator.username,
        'node_deadline': app.node_deadline,
        'created_at': app.created_at,
        'version': app.version,
    }


def build_application_detail_schema(app: AssistanceApplication) -> Dict[str, Any]:
    update_warning_status(app)
    app.save()

    required_evidence = REQUIRED_EVIDENCE.get(app.current_node, [])
    existing_evidence = set(
        app.attachments.filter(is_required=True).values_list('evidence_type', flat=True)
    )
    missing_evidence = [e for e in required_evidence if e not in existing_evidence]

    return {
        'id': app.id,
        'application_no': app.application_no,
        'applicant_name': app.applicant_name,
        'applicant_id_card': app.applicant_id_card,
        'applicant_phone': app.applicant_phone,
        'community': app.community,
        'address': app.address,
        'family_situation': app.family_situation,
        'difficulty_type': app.difficulty_type,
        'application_reason': app.application_reason,
        'apply_amount': float(app.apply_amount) if app.apply_amount else None,
        'current_node': app.current_node,
        'current_node_name': get_node_name(app.current_node),
        'status': app.status,
        'status_name': get_status_name(app.status),
        'warning_status': app.warning_status,
        'warning_status_name': get_warning_name(app.warning_status),
        'current_handler': app.current_handler.username if app.current_handler else None,
        'current_handler_id': app.current_handler_id,
        'creator': app.creator.username,
        'creator_id': app.creator_id,
        'street_clerk': app.street_clerk.username if app.street_clerk else None,
        'street_clerk_id': app.street_clerk_id,
        'leader': app.leader.username if app.leader else None,
        'leader_id': app.leader_id,
        'node_deadline': app.node_deadline,
        'version': app.version,
        'created_at': app.created_at,
        'updated_at': app.updated_at,
        'missing_evidence': missing_evidence,
        'attachments': [
            {
                'id': att.id,
                'file_name': att.file_name,
                'file_type': att.file_type,
                'evidence_type': att.evidence_type,
                'is_required': att.is_required,
                'uploaded_by': att.uploaded_by.username,
                'created_at': att.created_at,
            }
            for att in app.attachments.all()
        ],
        'processing_records': [
            {
                'id': rec.id,
                'node': rec.node,
                'node_name': get_node_name(rec.node),
                'action': rec.action,
                'operator': rec.operator.username,
                'previous_status': rec.previous_status,
                'new_status': rec.new_status,
                'comment': rec.comment,
                'processing_time': rec.processing_time,
                'version': rec.version,
            }
            for rec in app.processing_records.all()
        ],
        'audit_notes': [
            {
                'id': note.id,
                'node': note.node,
                'node_name': get_node_name(note.node),
                'note_type': note.note_type,
                'content': note.content,
                'operator': note.operator.username,
                'created_at': note.created_at,
            }
            for note in app.audit_notes.all()
        ],
        'exception_logs': [
            {
                'id': log.id,
                'application_no': app.application_no,
                'exception_type': log.exception_type,
                'error_code': log.error_code,
                'error_message': log.error_message,
                'operator': log.operator.username,
                'resolved': log.resolved,
                'created_at': log.created_at,
            }
            for log in app.exception_logs.all()
        ],
    }


def process_batch_item(
    user: User,
    item: Dict[str, Any],
    batch_id: str
) -> Dict[str, Any]:
    app_id = item['application_id']
    version = item['version']
    action = item['action']
    comment = item.get('comment', '')

    result = {
        'application_id': app_id,
        'application_no': '',
        'success': False,
        'error_code': None,
        'error_message': None,
    }

    try:
        application = AssistanceApplication.objects.select_for_update().get(id=app_id)
        result['application_no'] = application.application_no

        process_application_action(
            user=user,
            application=application,
            action=action,
            version=version,
            comment=comment
        )
        result['success'] = True

    except AssistanceApplication.DoesNotExist:
        result['error_code'] = 'NOT_FOUND'
        result['error_message'] = f'申请ID {app_id} 不存在'
    except BusinessException as e:
        result['error_code'] = e.error_code
        result['error_message'] = e.error_message
        try:
            app = AssistanceApplication.objects.get(id=app_id)
            create_exception_log(
                operator=user,
                exception_type='batch_process',
                error_code=e.error_code,
                error_message=e.error_message,
                application=app,
                batch_id=batch_id,
                request_data=str(item)
            )
        except Exception:
            pass
    except Exception as e:
        result['error_code'] = 'SYSTEM_ERROR'
        result['error_message'] = str(e)

    return result


@transaction.atomic
def process_batch(
    user: User,
    items: List[Dict[str, Any]]
) -> Dict[str, Any]:
    role = get_user_role(user)
    if role not in ['street_clerk', 'leader']:
        raise BusinessException('PERMISSION_DENIED', '只有街道科员和分管领导可以批量处理')

    batch_id = f'BATCH{uuid.uuid4().hex[:8].upper()}'
    results = []

    for item in items:
        result = process_batch_item(user, item, batch_id)
        results.append(result)

    success_count = sum(1 for r in results if r['success'])
    failure_count = len(results) - success_count

    return {
        'batch_id': batch_id,
        'total_count': len(results),
        'success_count': success_count,
        'failure_count': failure_count,
        'results': results,
    }


def get_warning_stats(user: User) -> Dict[str, int]:
    role = get_user_role(user)
    queryset = AssistanceApplication.objects.exclude(status='passed').exclude(status='rejected')

    if role == 'community_worker':
        queryset = queryset.filter(creator=user)
    elif role in ['street_clerk', 'leader']:
        queryset = queryset.filter(current_handler=user)

    for app in queryset:
        update_warning_status(app)
        app.save()

    return {
        'normal': queryset.filter(warning_status='normal').count(),
        'approaching': queryset.filter(warning_status='approaching').count(),
        'overdue': queryset.filter(warning_status='overdue').count(),
    }


def get_application_list(
    user: User,
    status: str = None,
    current_node: str = None,
    warning_status: str = None,
    community: str = None,
    keyword: str = None
) -> List[Dict[str, Any]]:
    role = get_user_role(user)
    queryset = AssistanceApplication.objects.all()

    if role == 'community_worker':
        queryset = queryset.filter(creator=user)
    elif role in ['street_clerk', 'leader']:
        queryset = queryset.filter(current_handler=user)

    if status:
        if status == 'pending':
            queryset = queryset.filter(models.Q(status='pending') | models.Q(status='returned'))
        else:
            queryset = queryset.filter(status=status)
    if current_node:
        queryset = queryset.filter(current_node=current_node)
    if warning_status:
        queryset = queryset.filter(warning_status=warning_status)
    if community:
        queryset = queryset.filter(community=community)
    if keyword:
        queryset = queryset.filter(
            models.Q(applicant_name__contains=keyword) |
            models.Q(application_no__contains=keyword) |
            models.Q(community__contains=keyword)
        )

    return [build_application_list_schema(app) for app in queryset]

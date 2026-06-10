from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, g
from .config import Config


def get_deadline(created_at=None):
    if created_at is None:
        created_at = datetime.utcnow()
    return created_at + timedelta(hours=Config.PROCESSING_DEADLINE_HOURS)


def get_urgency_level(deadline):
    now = datetime.utcnow()
    if deadline is None:
        return 'normal'
    diff = deadline - now
    if diff.total_seconds() < 0:
        return 'overdue'
    elif diff.total_seconds() < Config.APPROACHING_DEADLINE_HOURS * 3600:
        return 'approaching'
    else:
        return 'normal'


def check_permission(role, action):
    permissions = Config.ROLE_PERMISSIONS.get(role, [])
    return action in permissions


def require_role(*roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            current_role = request.headers.get('X-User-Role')
            current_user = request.headers.get('X-User-Name', '未知用户')

            if not current_role:
                return jsonify({
                    'success': False,
                    'error': '缺少角色信息（X-User-Role 请求头）',
                    'code': Config.ERROR_CODES['MISSING_ROLE']
                }), 401

            if current_role not in roles:
                return jsonify({
                    'success': False,
                    'error': f'角色「{Config.ROLE_LABEL.get(current_role, current_role)}」无权执行此操作',
                    'code': Config.ERROR_CODES['PERMISSION_DENIED'],
                    'current_role': current_role,
                    'allowed_roles': list(roles)
                }), 403

            g.current_role = current_role
            g.current_user = current_user
            return f(*args, **kwargs)

        return decorated_function

    return decorator


def validate_version(booking, request_version):
    if request_version is not None and booking.version != request_version:
        return False
    return True


def check_required_modules(booking):
    missing_keys = []
    if not booking.team_booking_info or not booking.team_booking_info.is_complete:
        missing_keys.append('team_booking_info')
    if not booking.ticket_verification or not booking.ticket_verification.is_complete:
        missing_keys.append('ticket_verification')
    if not booking.entry_statistics or not booking.entry_statistics.is_complete:
        missing_keys.append('entry_statistics')
    return missing_keys


def describe_missing_modules(missing_keys):
    result = []
    for k in missing_keys:
        m = Config.MODULES.get(k, {})
        result.append({
            'key': k,
            'label': m.get('label', k),
            'owner_role': m.get('owner_role'),
            'owner_label': m.get('owner_label')
        })
    return result


def build_missing_modules_error(missing_keys):
    details = describe_missing_modules(missing_keys)
    labels = [d['label'] for d in details]
    owner_tips = []
    for d in details:
        owner_tips.append(f"{d['label']}由{d['owner_label']}补正")
    return {
        'missing_keys': missing_keys,
        'missing_labels': labels,
        'missing_details': details,
        'correction_targets': owner_tips,
        'correction_summary': '请通知：' + '；'.join(owner_tips)
    }


class ValidationResult:
    def __init__(self, ok=True, error=None, code=None, http_status=200, data=None):
        self.ok = ok
        self.error = error
        self.code = code
        self.http_status = http_status
        self.data = data or {}

    def to_response(self):
        body = {'success': False, 'error': self.error, 'code': self.code}
        body.update(self.data)
        return jsonify(body), self.http_status


def unified_validate(booking, current_role, action, request_version=None, require_complete_modules=False):
    EC = Config.ERROR_CODES

    if booking is None:
        return ValidationResult(False, '预约单不存在', EC['NOT_FOUND'], 404)

    if not check_permission(current_role, action):
        return ValidationResult(False,
            f'角色「{Config.ROLE_LABEL.get(current_role, current_role)}」无权执行动作「{action}」',
            EC['PERMISSION_DENIED'], 403,
            {'current_role': current_role, 'action': action})

    if not validate_version(booking, request_version):
        return ValidationResult(False,
            f'版本冲突：您提交的版本为 v{request_version}，服务端当前版本为 v{booking.version}。请刷新后重试。',
            EC['VERSION_CONFLICT'], 409,
            {'submitted_version': request_version, 'current_version': booking.version})

    if action == 'process':
        expected = Config.ROLE_STATUS_MAP.get(current_role, {})
        expected_status = expected.get('process')
        if booking.status != expected_status:
            return ValidationResult(False,
                f'状态冲突：{Config.ROLE_LABEL.get(current_role, current_role)}只能处理「{expected_status}」状态的单据，'
                f'当前预约单状态为「{booking.status}」，原状态保留未变更。',
                EC['STATUS_CONFLICT'], 409,
                {'expected_status': expected_status, 'current_status': booking.status,
                 'current_handler': booking.current_handler, 'preserved': True})

        if booking.current_role != current_role:
            return ValidationResult(False,
                f'当前处理人不匹配：当前处理人为「{booking.current_handler}」（角色：{booking.current_role}），'
                f'您的角色「{current_role}」不是当前处理人，原状态保留未变更。',
                EC['WRONG_HANDLER'], 403,
                {'current_handler': booking.current_handler, 'current_handler_role': booking.current_role,
                 'operator_role': current_role, 'preserved': True})

    if action in ('return', 'advance_overdue'):
        if booking.status == '已同步':
            return ValidationResult(False,
                '已同步的预约单已归档，不可退回/推进，原状态保留未变更。',
                EC['STATUS_CONFLICT'], 409,
                {'current_status': booking.status, 'preserved': True})

    if action == 'return':
        if booking.status not in Config.STATUS_FLOW or '退回补正' not in Config.STATUS_FLOW.get(booking.status, []):
            return ValidationResult(False,
                f'状态「{booking.status}」不支持退回补正，原状态保留。',
                EC['STATUS_CONFLICT'], 409,
                {'current_status': booking.status, 'preserved': True})

    if action == 'resubmit':
        if booking.status != '退回补正':
            return ValidationResult(False,
                f'只有「退回补正」状态可以重新提交，当前为「{booking.status}」，原状态保留。',
                EC['STATUS_CONFLICT'], 409,
                {'current_status': booking.status, 'preserved': True})

    if require_complete_modules or action in ('process', 'resubmit'):
        missing = check_required_modules(booking)
        if missing:
            info = build_missing_modules_error(missing)
            return ValidationResult(False,
                f'缺少必填证据模块：{"、".join(info["missing_labels"])}。原状态保留，需补正后再提交。',
                EC['MISSING_MODULES'], 400,
                {'preserved': True, **info})

    return ValidationResult(True)


def describe_booking_status_info(booking):
    return {
        'booking_no': booking.booking_no,
        'status': booking.status,
        'current_handler': booking.current_handler,
        'current_role': booking.current_role,
        'version': booking.version,
        'missing_modules': describe_missing_modules(check_required_modules(booking))
    }


def serialize_booking(booking, include_details=True):
    urgency = get_urgency_level(booking.deadline)
    missing_keys = check_required_modules(booking)
    missing_info = describe_missing_modules(missing_keys)

    data = {
        'id': booking.id,
        'booking_no': booking.booking_no,
        'team_name': booking.team_name,
        'contact_person': booking.contact_person,
        'contact_phone': booking.contact_phone,
        'visitor_count': booking.visitor_count,
        'visit_date': booking.visit_date.isoformat() if booking.visit_date else None,
        'visit_time': booking.visit_time,
        'status': booking.status,
        'current_handler': booking.current_handler,
        'current_role': booking.current_role,
        'version': booking.version,
        'deadline': booking.deadline.isoformat() if booking.deadline else None,
        'urgency': urgency,
        'created_at': booking.created_at.isoformat() if booking.created_at else None,
        'updated_at': booking.updated_at.isoformat() if booking.updated_at else None,
        'missing_modules': missing_info,
        'modules_complete': len(missing_keys) == 0
    }

    if include_details:
        def _fmt_time(v):
            return v.isoformat() if v else None

        data['team_booking_info'] = None
        if booking.team_booking_info:
            data['team_booking_info'] = {
                'itinerary': booking.team_booking_info.itinerary,
                'requirements': booking.team_booking_info.requirements,
                'submitted_by': booking.team_booking_info.submitted_by,
                'submitted_at': _fmt_time(booking.team_booking_info.submitted_at),
                'is_complete': booking.team_booking_info.is_complete,
                'owner_role': Config.MODULES['team_booking_info']['owner_role'],
                'owner_label': Config.MODULES['team_booking_info']['owner_label']
            }

        data['ticket_verification'] = None
        if booking.ticket_verification:
            data['ticket_verification'] = {
                'ticket_count': booking.ticket_verification.ticket_count,
                'verified_count': booking.ticket_verification.verified_count,
                'ticket_type': booking.ticket_verification.ticket_type,
                'verified_by': booking.ticket_verification.verified_by,
                'verified_at': _fmt_time(booking.ticket_verification.verified_at),
                'is_complete': booking.ticket_verification.is_complete,
                'owner_role': Config.MODULES['ticket_verification']['owner_role'],
                'owner_label': Config.MODULES['ticket_verification']['owner_label']
            }

        data['entry_statistics'] = None
        if booking.entry_statistics:
            data['entry_statistics'] = {
                'actual_entry_count': booking.entry_statistics.actual_entry_count,
                'entry_time': _fmt_time(booking.entry_statistics.entry_time),
                'exit_time': _fmt_time(booking.entry_statistics.exit_time),
                'recorded_by': booking.entry_statistics.recorded_by,
                'recorded_at': _fmt_time(booking.entry_statistics.recorded_at),
                'is_complete': booking.entry_statistics.is_complete,
                'owner_role': Config.MODULES['entry_statistics']['owner_role'],
                'owner_label': Config.MODULES['entry_statistics']['owner_label']
            }

        data['attachments'] = [{
            'id': a.id, 'file_name': a.file_name, 'file_type': a.file_type,
            'module': a.module, 'uploaded_by': a.uploaded_by,
            'uploaded_at': _fmt_time(a.uploaded_at)
        } for a in booking.attachments]

        data['processing_records'] = [{
            'id': r.id, 'action': r.action, 'from_status': r.from_status,
            'to_status': r.to_status, 'operator': r.operator,
            'operator_role': r.operator_role,
            'operator_label': Config.ROLE_LABEL.get(r.operator_role, r.operator_role),
            'remark': r.remark, 'created_at': _fmt_time(r.created_at)
        } for r in sorted(booking.processing_records, key=lambda x: x.created_at, reverse=True)]

        data['audit_notes'] = [{
            'id': n.id, 'note': n.note, 'author': n.author,
            'author_role': n.author_role,
            'author_label': Config.ROLE_LABEL.get(n.author_role, n.author_role),
            'created_at': _fmt_time(n.created_at)
        } for n in sorted(booking.audit_notes, key=lambda x: x.created_at, reverse=True)]

        data['exception_reasons'] = [{
            'id': e.id, 'reason': e.reason, 'category': e.category,
            'reporter': e.reporter, 'reporter_role': e.reporter_role,
            'reporter_label': Config.ROLE_LABEL.get(e.reporter_role, e.reporter_role),
            'created_at': _fmt_time(e.created_at)
        } for e in sorted(booking.exception_reasons, key=lambda x: x.created_at, reverse=True)]

    return data

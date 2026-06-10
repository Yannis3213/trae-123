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
                return jsonify({'error': '缺少角色信息', 'code': 'MISSING_ROLE'}), 401

            if current_role not in roles:
                return jsonify({
                    'error': f'角色 {current_role} 无权执行此操作',
                    'code': 'PERMISSION_DENIED'
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
    missing = []
    if not booking.team_booking_info or not booking.team_booking_info.is_complete:
        missing.append('团队预约')
    if not booking.ticket_verification or not booking.ticket_verification.is_complete:
        missing.append('票务核销')
    if not booking.entry_statistics or not booking.entry_statistics.is_complete:
        missing.append('入园统计')
    return missing


def serialize_booking(booking, include_details=True):
    urgency = get_urgency_level(booking.deadline)

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
        'updated_at': booking.updated_at.isoformat() if booking.updated_at else None
    }

    if include_details:
        if booking.team_booking_info:
            data['team_booking_info'] = {
                'itinerary': booking.team_booking_info.itinerary,
                'requirements': booking.team_booking_info.requirements,
                'submitted_by': booking.team_booking_info.submitted_by,
                'submitted_at': booking.team_booking_info.submitted_at.isoformat() if booking.team_booking_info.submitted_at else None,
                'is_complete': booking.team_booking_info.is_complete
            }
        else:
            data['team_booking_info'] = None

        if booking.ticket_verification:
            data['ticket_verification'] = {
                'ticket_count': booking.ticket_verification.ticket_count,
                'verified_count': booking.ticket_verification.verified_count,
                'ticket_type': booking.ticket_verification.ticket_type,
                'verified_by': booking.ticket_verification.verified_by,
                'verified_at': booking.ticket_verification.verified_at.isoformat() if booking.ticket_verification.verified_at else None,
                'is_complete': booking.ticket_verification.is_complete
            }
        else:
            data['ticket_verification'] = None

        if booking.entry_statistics:
            data['entry_statistics'] = {
                'actual_entry_count': booking.entry_statistics.actual_entry_count,
                'entry_time': booking.entry_statistics.entry_time.isoformat() if booking.entry_statistics.entry_time else None,
                'exit_time': booking.entry_statistics.exit_time.isoformat() if booking.entry_statistics.exit_time else None,
                'recorded_by': booking.entry_statistics.recorded_by,
                'recorded_at': booking.entry_statistics.recorded_at.isoformat() if booking.entry_statistics.recorded_at else None,
                'is_complete': booking.entry_statistics.is_complete
            }
        else:
            data['entry_statistics'] = None

        data['attachments'] = [{
            'id': a.id,
            'file_name': a.file_name,
            'file_type': a.file_type,
            'module': a.module,
            'uploaded_by': a.uploaded_by,
            'uploaded_at': a.uploaded_at.isoformat() if a.uploaded_at else None
        } for a in booking.attachments]

        data['processing_records'] = [{
            'id': r.id,
            'action': r.action,
            'from_status': r.from_status,
            'to_status': r.to_status,
            'operator': r.operator,
            'operator_role': r.operator_role,
            'remark': r.remark,
            'created_at': r.created_at.isoformat() if r.created_at else None
        } for r in sorted(booking.processing_records, key=lambda x: x.created_at, reverse=True)]

        data['audit_notes'] = [{
            'id': n.id,
            'note': n.note,
            'author': n.author,
            'author_role': n.author_role,
            'created_at': n.created_at.isoformat() if n.created_at else None
        } for n in sorted(booking.audit_notes, key=lambda x: x.created_at, reverse=True)]

        data['exception_reasons'] = [{
            'id': e.id,
            'reason': e.reason,
            'category': e.category,
            'reporter': e.reporter,
            'reporter_role': e.reporter_role,
            'created_at': e.created_at.isoformat() if e.created_at else None
        } for e in sorted(booking.exception_reasons, key=lambda x: x.created_at, reverse=True)]

    return data

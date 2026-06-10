from datetime import datetime
from flask import Blueprint, request, jsonify, g
from . import db
from .models import (
    TeamBooking, BookingInfo, TicketVerification, EntryStatistics,
    Attachment, ProcessingRecord, AuditNote, ExceptionReason
)
from .utils import (
    serialize_booking, require_role, validate_version,
    check_required_modules, get_deadline
)
from .config import Config

bp = Blueprint('api', __name__)


@bp.route('/bookings', methods=['GET'])
@require_role('dispatcher', 'ticketing', 'manager')
def get_bookings():
    status = request.args.get('status')
    urgency = request.args.get('urgency')
    current_role = g.current_role

    query = TeamBooking.query

    if status:
        query = query.filter_by(status=status)

    bookings = query.order_by(TeamBooking.created_at.desc()).all()

    if urgency:
        from .utils import get_urgency_level
        bookings = [b for b in bookings if get_urgency_level(b.deadline) == urgency]

    result = [serialize_booking(b, include_details=False) for b in bookings]
    return jsonify({
        'success': True,
        'data': result,
        'current_role': current_role
    })


@bp.route('/bookings/<int:booking_id>', methods=['GET'])
@require_role('dispatcher', 'ticketing', 'manager')
def get_booking_detail(booking_id):
    booking = TeamBooking.query.get(booking_id)
    if not booking:
        return jsonify({'success': False, 'error': '预约单不存在', 'code': 'NOT_FOUND'}), 404

    return jsonify({
        'success': True,
        'data': serialize_booking(booking, include_details=True)
    })


@bp.route('/bookings', methods=['POST'])
@require_role('dispatcher')
def create_booking():
    data = request.get_json()

    required_fields = ['team_name', 'contact_person', 'contact_phone', 'visitor_count', 'visit_date']
    missing = [f for f in required_fields if not data.get(f)]
    if missing:
        return jsonify({
            'success': False,
            'error': f'缺少必填字段: {", ".join(missing)}',
            'code': 'MISSING_FIELDS'
        }), 400

    booking_no = f'TB{datetime.now().strftime("%Y%m%d%H%M%S")}'

    booking = TeamBooking(
        booking_no=booking_no,
        team_name=data['team_name'],
        contact_person=data['contact_person'],
        contact_phone=data['contact_phone'],
        visitor_count=data['visitor_count'],
        visit_date=datetime.strptime(data['visit_date'], '%Y-%m-%d').date(),
        visit_time=data.get('visit_time'),
        status='待审核',
        current_handler='现场调度',
        current_role='dispatcher',
        version=1,
        deadline=get_deadline()
    )

    db.session.add(booking)
    db.session.flush()

    if data.get('itinerary') or data.get('requirements'):
        booking_info = BookingInfo(
            team_booking_id=booking.id,
            itinerary=data.get('itinerary', ''),
            requirements=data.get('requirements', ''),
            submitted_by=g.current_user,
            is_complete=bool(data.get('itinerary') and data.get('requirements'))
        )
        db.session.add(booking_info)

    record = ProcessingRecord(
        team_booking_id=booking.id,
        action='创建预约单',
        to_status='待审核',
        operator=g.current_user,
        operator_role=g.current_role,
        remark='团队预约单创建成功'
    )
    db.session.add(record)

    db.session.commit()

    return jsonify({
        'success': True,
        'data': serialize_booking(booking),
        'message': '预约单创建成功'
    }), 201


@bp.route('/bookings/<int:booking_id>/process', methods=['POST'])
def process_booking(booking_id):
    current_role = request.headers.get('X-User-Role')
    current_user = request.headers.get('X-User-Name', '未知用户')

    if not current_role:
        return jsonify({'success': False, 'error': '缺少角色信息', 'code': 'MISSING_ROLE'}), 401

    if not check_permission(current_role, 'process'):
        return jsonify({'success': False, 'error': '无权执行此操作', 'code': 'PERMISSION_DENIED'}), 403

    booking = TeamBooking.query.get(booking_id)
    if not booking:
        return jsonify({'success': False, 'error': '预约单不存在', 'code': 'NOT_FOUND'}), 404

    data = request.get_json() or {}
    request_version = data.get('version')

    if not validate_version(booking, request_version):
        return jsonify({
            'success': False,
            'error': f'版本冲突，当前版本为 {booking.version}，请刷新后重试',
            'code': 'VERSION_CONFLICT',
            'current_version': booking.version
        }), 409

    expected_role = Config.ROLE_STATUS_MAP.get(current_role, {})
    expected_status = expected_role.get('process')

    if booking.status != expected_status:
        return jsonify({
            'success': False,
            'error': f'状态冲突，当前状态为「{booking.status}」，{current_role} 只能处理「{expected_status}」状态的单据',
            'code': 'STATUS_CONFLICT',
            'current_status': booking.status
        }), 409

    if booking.current_role != current_role:
        return jsonify({
            'success': False,
            'error': f'当前处理人为「{booking.current_handler}」，请等待或联系对应人员',
            'code': 'WRONG_HANDLER',
            'current_handler': booking.current_handler
        }), 403

    missing_modules = check_required_modules(booking)
    if missing_modules and current_role != 'dispatcher':
        pass

    old_status = booking.status
    new_status = expected_role.get('next')

    if current_role == 'dispatcher':
        booking.status = new_status
        booking.current_handler = '景区经理'
        booking.current_role = 'manager'
        action_name = '现场调度审核通过，提交景区经理复核'
    elif current_role == 'ticketing':
        booking.status = new_status
        booking.current_handler = '景区经理'
        booking.current_role = 'manager'
        action_name = '票务核销完成，提交景区经理复核'
    elif current_role == 'manager':
        booking.status = new_status
        booking.current_handler = '已归档'
        booking.current_role = 'archived'
        action_name = '景区经理复核通过，归档完成'

    booking.version += 1
    booking.updated_at = datetime.utcnow()

    record = ProcessingRecord(
        team_booking_id=booking.id,
        action=action_name,
        from_status=old_status,
        to_status=new_status,
        operator=current_user,
        operator_role=current_role,
        remark=data.get('remark', '')
    )
    db.session.add(record)

    if data.get('note'):
        audit_note = AuditNote(
            team_booking_id=booking.id,
            note=data['note'],
            author=current_user,
            author_role=current_role
        )
        db.session.add(audit_note)

    db.session.commit()

    return jsonify({
        'success': True,
        'data': serialize_booking(booking),
        'message': f'{action_name}，状态变更为「{new_status}」'
    })


@bp.route('/bookings/<int:booking_id>/return', methods=['POST'])
@require_role('dispatcher', 'manager')
def return_booking(booking_id):
    booking = TeamBooking.query.get(booking_id)
    if not booking:
        return jsonify({'success': False, 'error': '预约单不存在', 'code': 'NOT_FOUND'}), 404

    data = request.get_json() or {}
    request_version = data.get('version')

    if not validate_version(booking, request_version):
        return jsonify({
            'success': False,
            'error': f'版本冲突，当前版本为 {booking.version}，请刷新后重试',
            'code': 'VERSION_CONFLICT',
            'current_version': booking.version
        }), 409

    if booking.status not in ['待审核', '审核通过']:
        return jsonify({
            'success': False,
            'error': f'当前状态「{booking.status}」不可退回',
            'code': 'STATUS_CONFLICT'
        }), 409

    missing_modules = check_required_modules(booking)
    correction_targets = []
    if missing_modules:
        for m in missing_modules:
            if m == '团队预约':
                correction_targets.append('现场调度补正团队预约信息')
            elif m == '票务核销':
                correction_targets.append('票务专员补正票务核销信息')
            elif m == '入园统计':
                correction_targets.append('现场调度补正入园统计信息')

    return_reason = data.get('reason', '未填写退回原因')
    old_status = booking.status

    booking.status = '退回补正'
    booking.current_handler = '现场调度'
    booking.current_role = 'dispatcher'
    booking.version += 1
    booking.updated_at = datetime.utcnow()

    record = ProcessingRecord(
        team_booking_id=booking.id,
        action='退回补正',
        from_status=old_status,
        to_status='退回补正',
        operator=g.current_user,
        operator_role=g.current_role,
        remark=return_reason
    )
    db.session.add(record)

    exception = ExceptionReason(
        team_booking_id=booking.id,
        reason=return_reason,
        category='退回补正',
        reporter=g.current_user,
        reporter_role=g.current_role
    )
    db.session.add(exception)

    if missing_modules:
        for mod in missing_modules:
            exc = ExceptionReason(
                team_booking_id=booking.id,
                reason=f'缺少{mod}信息，需要补正',
                category='材料缺失',
                reporter='系统',
                reporter_role='system'
            )
            db.session.add(exc)

    db.session.commit()

    response = {
        'success': True,
        'data': serialize_booking(booking),
        'message': '已退回补正',
        'missing_modules': missing_modules,
        'correction_targets': correction_targets
    }
    if correction_targets:
        response['warning'] = '请通知以下人员补正材料：' + '；'.join(correction_targets)

    return jsonify(response)


@bp.route('/bookings/<int:booking_id>/resubmit', methods=['POST'])
@require_role('dispatcher')
def resubmit_booking(booking_id):
    booking = TeamBooking.query.get(booking_id)
    if not booking:
        return jsonify({'success': False, 'error': '预约单不存在', 'code': 'NOT_FOUND'}), 404

    if booking.status != '退回补正':
        return jsonify({
            'success': False,
            'error': f'当前状态「{booking.status}」不可重新提交，仅「退回补正」状态可提交',
            'code': 'STATUS_CONFLICT'
        }), 409

    data = request.get_json() or {}
    request_version = data.get('version')

    if not validate_version(booking, request_version):
        return jsonify({
            'success': False,
            'error': f'版本冲突，当前版本为 {booking.version}，请刷新后重试',
            'code': 'VERSION_CONFLICT',
            'current_version': booking.version
        }), 409

    missing_modules = check_required_modules(booking)
    if missing_modules:
        return jsonify({
            'success': False,
            'error': f'缺少材料：{", ".join(missing_modules)}，请补正后重新提交',
            'code': 'MISSING_MODULES',
            'missing_modules': missing_modules
        }), 400

    old_status = booking.status
    booking.status = '待审核'
    booking.current_handler = '现场调度'
    booking.current_role = 'dispatcher'
    booking.version += 1
    booking.deadline = get_deadline()
    booking.updated_at = datetime.utcnow()

    record = ProcessingRecord(
        team_booking_id=booking.id,
        action='补正后重新提交',
        from_status=old_status,
        to_status='待审核',
        operator=g.current_user,
        operator_role=g.current_role,
        remark=data.get('remark', '材料已补正，重新提交审核')
    )
    db.session.add(record)

    db.session.commit()

    return jsonify({
        'success': True,
        'data': serialize_booking(booking),
        'message': '已重新提交审核'
    })


@bp.route('/bookings/<int:booking_id>/module', methods=['PUT'])
@require_role('dispatcher', 'ticketing')
def update_module(booking_id):
    booking = TeamBooking.query.get(booking_id)
    if not booking:
        return jsonify({'success': False, 'error': '预约单不存在', 'code': 'NOT_FOUND'}), 404

    data = request.get_json() or {}
    module_type = data.get('module')

    if module_type not in ['team_booking_info', 'ticket_verification', 'entry_statistics']:
        return jsonify({'success': False, 'error': '无效的模块类型', 'code': 'INVALID_MODULE'}), 400

    current_role = g.current_role

    if module_type == 'ticket_verification' and current_role != 'ticketing' and current_role != 'dispatcher':
        return jsonify({'success': False, 'error': '仅票务专员或现场调度可更新票务核销模块', 'code': 'PERMISSION_DENIED'}), 403

    if module_type in ['team_booking_info', 'entry_statistics'] and current_role != 'dispatcher':
        return jsonify({'success': False, 'error': '仅现场调度可更新此模块', 'code': 'PERMISSION_DENIED'}), 403

    version = data.get('version')
    if version is not None and booking.version != version:
        return jsonify({
            'success': False,
            'error': f'版本冲突',
            'code': 'VERSION_CONFLICT',
            'current_version': booking.version
        }), 409

    if module_type == 'team_booking_info':
        if booking.team_booking_info:
            booking.team_booking_info.itinerary = data.get('itinerary', booking.team_booking_info.itinerary)
            booking.team_booking_info.requirements = data.get('requirements', booking.team_booking_info.requirements)
            booking.team_booking_info.submitted_by = g.current_user
            booking.team_booking_info.submitted_at = datetime.utcnow()
            booking.team_booking_info.is_complete = bool(data.get('itinerary') and data.get('requirements'))
        else:
            bi = BookingInfo(
                team_booking_id=booking.id,
                itinerary=data.get('itinerary', ''),
                requirements=data.get('requirements', ''),
                submitted_by=g.current_user,
                is_complete=bool(data.get('itinerary') and data.get('requirements'))
            )
            db.session.add(bi)

    elif module_type == 'ticket_verification':
        required_fields = ['ticket_count', 'verified_count']
        missing = [f for f in required_fields if data.get(f) is None]
        if missing:
            return jsonify({
                'success': False,
                'error': f'缺少必填字段: {", ".join(missing)}',
                'code': 'MISSING_FIELDS'
            }), 400

        if booking.ticket_verification:
            booking.ticket_verification.ticket_count = data.get('ticket_count', booking.ticket_verification.ticket_count)
            booking.ticket_verification.verified_count = data.get('verified_count', booking.ticket_verification.verified_count)
            booking.ticket_verification.ticket_type = data.get('ticket_type', booking.ticket_verification.ticket_type)
            booking.ticket_verification.verified_by = g.current_user
            booking.ticket_verification.verified_at = datetime.utcnow()
            booking.ticket_verification.is_complete = bool(data.get('ticket_count') and data.get('verified_count'))
        else:
            tv = TicketVerification(
                team_booking_id=booking.id,
                ticket_count=data.get('ticket_count', 0),
                verified_count=data.get('verified_count', 0),
                ticket_type=data.get('ticket_type', ''),
                verified_by=g.current_user,
                verified_at=datetime.utcnow(),
                is_complete=bool(data.get('ticket_count') and data.get('verified_count'))
            )
            db.session.add(tv)

    elif module_type == 'entry_statistics':
        if booking.entry_statistics:
            booking.entry_statistics.actual_entry_count = data.get('actual_entry_count', booking.entry_statistics.actual_entry_count)
            entry_time_str = data.get('entry_time')
            if entry_time_str:
                booking.entry_statistics.entry_time = datetime.fromisoformat(entry_time_str.replace('Z', '+00:00'))
            exit_time_str = data.get('exit_time')
            if exit_time_str:
                booking.entry_statistics.exit_time = datetime.fromisoformat(exit_time_str.replace('Z', '+00:00'))
            booking.entry_statistics.recorded_by = g.current_user
            booking.entry_statistics.recorded_at = datetime.utcnow()
            booking.entry_statistics.is_complete = data.get('actual_entry_count') is not None and data.get('actual_entry_count') > 0
        else:
            entry_time = None
            exit_time = None
            if data.get('entry_time'):
                entry_time = datetime.fromisoformat(data['entry_time'].replace('Z', '+00:00'))
            if data.get('exit_time'):
                exit_time = datetime.fromisoformat(data['exit_time'].replace('Z', '+00:00'))

            es = EntryStatistics(
                team_booking_id=booking.id,
                actual_entry_count=data.get('actual_entry_count', 0),
                entry_time=entry_time,
                exit_time=exit_time,
                recorded_by=g.current_user,
                recorded_at=datetime.utcnow(),
                is_complete=data.get('actual_entry_count') is not None and data.get('actual_entry_count') > 0
            )
            db.session.add(es)

    booking.version += 1
    booking.updated_at = datetime.utcnow()

    record = ProcessingRecord(
        team_booking_id=booking.id,
        action=f'更新{module_type}模块',
        operator=g.current_user,
        operator_role=current_role,
        remark=f'更新{module_type}信息'
    )
    db.session.add(record)

    db.session.commit()

    return jsonify({
        'success': True,
        'data': serialize_booking(booking),
        'message': f'{module_type}模块更新成功'
    })


@bp.route('/bookings/batch-process', methods=['POST'])
@require_role('dispatcher', 'manager')
def batch_process():
    data = request.get_json() or {}
    ids = data.get('ids', [])
    action = data.get('action', 'process')

    if not ids:
        return jsonify({'success': False, 'error': '请选择要处理的单据', 'code': 'EMPTY_IDS'}), 400

    current_role = g.current_role
    current_user = g.current_user

    if action not in ['process', 'return', 'advance_overdue']:
        return jsonify({'success': False, 'error': '无效的批量操作', 'code': 'INVALID_ACTION'}), 400

    results = []

    for bid in ids:
        booking = TeamBooking.query.get(bid)
        if not booking:
            results.append({'id': bid, 'success': False, 'reason': '预约单不存在'})
            continue

        try:
            if action == 'process':
                expected_role = Config.ROLE_STATUS_MAP.get(current_role, {})
                expected_status = expected_role.get('process')

                if booking.status != expected_status:
                    results.append({
                        'id': bid,
                        'booking_no': booking.booking_no,
                        'success': False,
                        'reason': f'状态冲突：当前为「{booking.status}」，需「{expected_status}」才可处理'
                    })
                    continue

                if booking.current_role != current_role:
                    results.append({
                        'id': bid,
                        'booking_no': booking.booking_no,
                        'success': False,
                        'reason': f'当前处理人为「{booking.current_handler}」，非当前角色处理范围'
                    })
                    continue

                old_status = booking.status
                new_status = expected_role.get('next')

                if current_role == 'dispatcher':
                    booking.status = new_status
                    booking.current_handler = '景区经理'
                    booking.current_role = 'manager'
                elif current_role == 'manager':
                    booking.status = new_status
                    booking.current_handler = '已归档'
                    booking.current_role = 'archived'

                booking.version += 1
                booking.updated_at = datetime.utcnow()

                record = ProcessingRecord(
                    team_booking_id=booking.id,
                    action='批量处理',
                    from_status=old_status,
                    to_status=new_status,
                    operator=current_user,
                    operator_role=current_role,
                    remark='批量处理通过'
                )
                db.session.add(record)

                results.append({
                    'id': bid,
                    'booking_no': booking.booking_no,
                    'success': True,
                    'new_status': new_status
                })

            elif action == 'return':
                if booking.status not in ['待审核', '审核通过']:
                    results.append({
                        'id': bid,
                        'booking_no': booking.booking_no,
                        'success': False,
                        'reason': f'状态「{booking.status}」不可退回'
                    })
                    continue

                booking.status = '退回补正'
                booking.current_handler = '现场调度'
                booking.current_role = 'dispatcher'
                booking.version += 1
                booking.updated_at = datetime.utcnow()

                record = ProcessingRecord(
                    team_booking_id=booking.id,
                    action='批量退回',
                    from_status=booking.status,
                    to_status='退回补正',
                    operator=current_user,
                    operator_role=current_role,
                    remark=data.get('reason', '批量退回补正')
                )
                db.session.add(record)

                results.append({
                    'id': bid,
                    'booking_no': booking.booking_no,
                    'success': True,
                    'new_status': '退回补正'
                })

            elif action == 'advance_overdue':
                from .utils import get_urgency_level
                urgency = get_urgency_level(booking.deadline)
                if urgency != 'overdue':
                    results.append({
                        'id': bid,
                        'booking_no': booking.booking_no,
                        'success': False,
                        'reason': '非逾期状态，不可批量推进'
                    })
                    continue

                if booking.status != '待审核':
                    results.append({
                        'id': bid,
                        'booking_no': booking.booking_no,
                        'success': False,
                        'reason': f'仅「待审核」状态可推进，当前为「{booking.status}」'
                    })
                    continue

                booking.current_handler = '景区经理'
                booking.current_role = 'manager'
                booking.version += 1
                booking.updated_at = datetime.utcnow()

                record = ProcessingRecord(
                    team_booking_id=booking.id,
                    action='逾期批量推进',
                    operator=current_user,
                    operator_role=current_role,
                    remark='逾期单据批量推进至景区经理'
                )
                db.session.add(record)

                exception = ExceptionReason(
                    team_booking_id=booking.id,
                    reason='节点超时，已批量推进至景区经理',
                    category='超时逾期',
                    reporter='系统',
                    reporter_role='system'
                )
                db.session.add(exception)

                results.append({
                    'id': bid,
                    'booking_no': booking.booking_no,
                    'success': True,
                    'new_handler': '景区经理'
                })

        except Exception as e:
            db.session.rollback()
            results.append({
                'id': bid,
                'booking_no': booking.booking_no if booking else '',
                'success': False,
                'reason': f'处理异常: {str(e)}'
            })

    db.session.commit()

    success_count = sum(1 for r in results if r['success'])
    fail_count = len(results) - success_count

    return jsonify({
        'success': True,
        'data': {
            'results': results,
            'success_count': success_count,
            'fail_count': fail_count
        },
        'message': f'批量处理完成：成功 {success_count} 条，失败 {fail_count} 条'
    })


@bp.route('/bookings/<int:booking_id>/notes', methods=['POST'])
@require_role('dispatcher', 'ticketing', 'manager')
def add_note(booking_id):
    booking = TeamBooking.query.get(booking_id)
    if not booking:
        return jsonify({'success': False, 'error': '预约单不存在', 'code': 'NOT_FOUND'}), 404

    data = request.get_json() or {}
    note_content = data.get('note')

    if not note_content or not note_content.strip():
        return jsonify({'success': False, 'error': '备注内容不能为空', 'code': 'EMPTY_NOTE'}), 400

    note = AuditNote(
        team_booking_id=booking.id,
        note=note_content.strip(),
        author=g.current_user,
        author_role=g.current_role
    )
    db.session.add(note)
    db.session.commit()

    return jsonify({
        'success': True,
        'data': {
            'id': note.id,
            'note': note.note,
            'author': note.author,
            'author_role': note.author_role,
            'created_at': note.created_at.isoformat()
        },
        'message': '备注添加成功'
    })


@bp.route('/statistics/dashboard', methods=['GET'])
@require_role('dispatcher', 'ticketing', 'manager')
def get_dashboard_stats():
    from .utils import get_urgency_level

    all_bookings = TeamBooking.query.all()

    normal = 0
    approaching = 0
    overdue = 0

    status_counts = {}

    for b in all_bookings:
        urgency = get_urgency_level(b.deadline)
        if urgency == 'normal':
            normal += 1
        elif urgency == 'approaching':
            approaching += 1
        else:
            overdue += 1

        status_counts[b.status] = status_counts.get(b.status, 0) + 1

    return jsonify({
        'success': True,
        'data': {
            'total': len(all_bookings),
            'normal': normal,
            'approaching': approaching,
            'overdue': overdue,
            'by_status': status_counts
        }
    })


def check_permission(role, action):
    permissions = Config.ROLE_PERMISSIONS.get(role, [])
    return action in permissions

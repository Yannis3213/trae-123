from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, g
from . import db
from .models import (
    TeamBooking, BookingInfo, TicketVerification, EntryStatistics,
    Attachment, ProcessingRecord, AuditNote, ExceptionReason
)
from .utils import (
    serialize_booking, require_role, unified_validate,
    check_required_modules, build_missing_modules_error,
    describe_missing_modules, get_deadline, describe_booking_status_info,
    check_permission
)
from .config import Config

bp = Blueprint('api', __name__)


def _add_processing_record(booking_id, action, operator, operator_role,
                           from_status=None, to_status=None, remark=''):
    r = ProcessingRecord(
        team_booking_id=booking_id,
        action=action,
        from_status=from_status,
        to_status=to_status,
        operator=operator,
        operator_role=operator_role,
        remark=remark
    )
    db.session.add(r)
    return r


def _add_exception(booking_id, reason, category, reporter='系统', reporter_role='system'):
    e = ExceptionReason(
        team_booking_id=booking_id,
        reason=reason,
        category=category,
        reporter=reporter,
        reporter_role=reporter_role
    )
    db.session.add(e)
    return e


def _add_audit_note(booking_id, note, author, author_role):
    n = AuditNote(
        team_booking_id=booking_id,
        note=note,
        author=author,
        author_role=author_role
    )
    db.session.add(n)
    return n


@bp.route('/config/ports', methods=['GET'])
def get_port_config():
    return jsonify({
        'success': True,
        'data': {
            'frontend_port': Config.FRONTEND_PORT,
            'backend_port': Config.BACKEND_PORT
        }
    })


@bp.route('/bookings', methods=['GET'])
@require_role('dispatcher', 'ticketing', 'manager')
def get_bookings():
    status = request.args.get('status')
    urgency = request.args.get('urgency')
    missing_module = request.args.get('missing_module')
    current_role = g.current_role

    query = TeamBooking.query

    if status:
        query = query.filter_by(status=status)

    bookings = query.order_by(TeamBooking.created_at.desc()).all()

    if urgency:
        from .utils import get_urgency_level
        bookings = [b for b in bookings if get_urgency_level(b.deadline) == urgency]

    if missing_module:
        def _has_missing(b, key):
            if key == 'team_booking_info':
                return not (b.team_booking_info and b.team_booking_info.is_complete)
            if key == 'ticket_verification':
                return not (b.ticket_verification and b.ticket_verification.is_complete)
            if key == 'entry_statistics':
                return not (b.entry_statistics and b.entry_statistics.is_complete)
            return False
        bookings = [b for b in bookings if _has_missing(b, missing_module)]

    result = [serialize_booking(b, include_details=False) for b in bookings]

    missing_summary = {}
    for key, meta in Config.MODULES.items():
        cnt = 0
        for b in bookings:
            missing_keys = check_required_modules(b)
            if key in missing_keys:
                cnt += 1
        missing_summary[key] = {
            'label': meta['label'],
            'owner_role': meta['owner_role'],
            'owner_label': meta['owner_label'],
            'count': cnt
        }

    return jsonify({
        'success': True,
        'data': result,
        'current_role': current_role,
        'missing_summary': missing_summary
    })


@bp.route('/bookings/<int:booking_id>', methods=['GET'])
@require_role('dispatcher', 'ticketing', 'manager')
def get_booking_detail(booking_id):
    booking = TeamBooking.query.get(booking_id)
    if not booking:
        return jsonify({
            'success': False,
            'error': '预约单不存在',
            'code': Config.ERROR_CODES['NOT_FOUND']
        }), 404

    result = serialize_booking(booking, include_details=True)

    result['actions_available'] = {
        'can_process': False,
        'can_return': False,
        'can_resubmit': False,
        'can_edit_booking_info': False,
        'can_edit_ticket': False,
        'can_edit_entry': False
    }

    role = g.current_role
    if booking.status != '已同步':
        if role == 'dispatcher':
            if booking.status == '待审核':
                result['actions_available']['can_process'] = booking.current_role == 'dispatcher'
            if booking.status in ('待审核',):
                result['actions_available']['can_return'] = booking.current_role == 'dispatcher'
            if booking.status == '退回补正':
                result['actions_available']['can_resubmit'] = True
            result['actions_available']['can_edit_booking_info'] = True
            result['actions_available']['can_edit_ticket'] = True
            result['actions_available']['can_edit_entry'] = True
        elif role == 'ticketing':
            if booking.status == '待审核':
                result['actions_available']['can_process'] = booking.current_role == 'dispatcher' or booking.current_role == 'ticketing'
            result['actions_available']['can_edit_ticket'] = True
        elif role == 'manager':
            if booking.status == '审核通过':
                result['actions_available']['can_process'] = booking.current_role == 'manager'
            if booking.status in ('待审核', '审核通过'):
                result['actions_available']['can_return'] = True

    return jsonify({'success': True, 'data': result})


@bp.route('/bookings', methods=['POST'])
@require_role('dispatcher')
def create_booking():
    data = request.get_json() or {}

    required_fields = ['team_name', 'contact_person', 'contact_phone', 'visitor_count', 'visit_date']
    missing = [f for f in required_fields if not data.get(f)]
    if missing:
        return jsonify({
            'success': False,
            'error': f'缺少必填字段: {", ".join(missing)}',
            'code': Config.ERROR_CODES['MISSING_FIELDS'],
            'missing_fields': missing
        }), 400

    booking_no = f'TB{datetime.now().strftime("%Y%m%d%H%M%S")}{datetime.now().microsecond % 1000:03d}'

    booking = TeamBooking(
        booking_no=booking_no,
        team_name=data['team_name'],
        contact_person=data['contact_person'],
        contact_phone=data['contact_phone'],
        visitor_count=data['visitor_count'],
        visit_date=datetime.strptime(data['visit_date'], '%Y-%m-%d').date(),
        visit_time=data.get('visit_time'),
        status='待审核',
        current_handler=Config.HANDLER_ROLE_MAP['dispatcher'],
        current_role='dispatcher',
        version=1,
        deadline=get_deadline()
    )
    db.session.add(booking)
    db.session.flush()

    has_booking_info = False
    if data.get('itinerary') or data.get('requirements'):
        complete = bool(data.get('itinerary') and data.get('requirements'))
        booking_info = BookingInfo(
            team_booking_id=booking.id,
            itinerary=data.get('itinerary', ''),
            requirements=data.get('requirements', ''),
            submitted_by=g.current_user,
            is_complete=complete
        )
        db.session.add(booking_info)
        has_booking_info = complete

    _add_processing_record(
        booking.id, '创建预约单', g.current_user, g.current_role,
        to_status='待审核', remark='团队预约单创建成功'
    )

    if not has_booking_info:
        _add_exception(
            booking.id, '团队预约信息未完整填写（行程/需求）', '材料缺失',
            reporter=g.current_user, reporter_role=g.current_role
        )
    _add_exception(
        booking.id, '票务核销尚未提交，等待票务专员补正', '材料缺失'
    )
    _add_exception(
        booking.id, '入园统计尚未提交，等待现场调度补正', '材料缺失'
    )

    db.session.commit()

    return jsonify({
        'success': True,
        'data': serialize_booking(booking),
        'message': '预约单创建成功'
    }), 201


@bp.route('/bookings/<int:booking_id>/process', methods=['POST'])
@require_role('dispatcher', 'ticketing', 'manager')
def process_booking(booking_id):
    current_role = g.current_role
    current_user = g.current_user

    booking = TeamBooking.query.get(booking_id)
    if not booking:
        return jsonify({
            'success': False,
            'error': '预约单不存在',
            'code': Config.ERROR_CODES['NOT_FOUND']
        }), 404

    data = request.get_json() or {}
    request_version = data.get('version')

    vr = unified_validate(booking, current_role, 'process',
                          request_version=request_version,
                          require_complete_modules=True)
    if not vr.ok:
        _add_exception(
            booking_id,
            f'处理失败：{vr.error}',
            '校验拦截',
            reporter='系统', reporter_role='system'
        )
        db.session.commit()
        return vr.to_response()

    old_status = booking.status
    role_map = Config.ROLE_STATUS_MAP[current_role]
    new_status = role_map['next']
    old_handler = booking.current_handler
    old_role = booking.current_role

    if current_role == 'dispatcher':
        booking.status = new_status
        booking.current_handler = Config.HANDLER_ROLE_MAP['manager']
        booking.current_role = 'manager'
        action = '现场调度审核通过 → 提交景区经理复核'
    elif current_role == 'ticketing':
        booking.status = new_status
        booking.current_handler = Config.HANDLER_ROLE_MAP['manager']
        booking.current_role = 'manager'
        action = '票务核销完成 → 提交景区经理复核'
    elif current_role == 'manager':
        booking.status = new_status
        booking.current_handler = Config.HANDLER_ROLE_MAP['archived']
        booking.current_role = 'archived'
        action = '景区经理复核通过 → 已同步归档'

    booking.version += 1
    booking.updated_at = datetime.utcnow()

    _add_processing_record(
        booking_id, action, current_user, current_role,
        from_status=old_status, to_status=new_status,
        remark=data.get('remark', '')
    )

    if data.get('note'):
        _add_audit_note(booking_id, data['note'], current_user, current_role)

    if new_status == '已同步':
        _add_exception(
            booking_id, '流程已归档：团队预约单处理完成', '正常完成',
            reporter=current_user, reporter_role=current_role
        )

    db.session.commit()

    return jsonify({
        'success': True,
        'data': serialize_booking(booking),
        'message': f'{action}，状态从「{old_status}」变更为「{new_status}」',
        'transition': {
            'from_status': old_status, 'to_status': new_status,
            'from_handler': old_handler, 'from_role': old_role,
            'to_handler': booking.current_handler, 'to_role': booking.current_role
        }
    })


@bp.route('/bookings/<int:booking_id>/return', methods=['POST'])
@require_role('dispatcher', 'manager')
def return_booking(booking_id):
    booking = TeamBooking.query.get(booking_id)
    if not booking:
        return jsonify({
            'success': False, 'error': '预约单不存在',
            'code': Config.ERROR_CODES['NOT_FOUND']
        }), 404

    data = request.get_json() or {}
    request_version = data.get('version')
    return_reason = (data.get('reason') or '').strip() or '未填写退回原因'

    vr = unified_validate(booking, g.current_role, 'return',
                          request_version=request_version)
    if not vr.ok:
        _add_exception(
            booking_id,
            f'退回失败：{vr.error}', '校验拦截',
            reporter='系统', reporter_role='system'
        )
        db.session.commit()
        return vr.to_response()

    missing_keys = check_required_modules(booking)
    missing_info = build_missing_modules_error(missing_keys) if missing_keys else None

    old_status = booking.status
    booking.status = '退回补正'
    booking.current_handler = Config.HANDLER_ROLE_MAP['dispatcher']
    booking.current_role = 'dispatcher'
    booking.version += 1
    booking.updated_at = datetime.utcnow()

    _add_processing_record(
        booking_id, '退回补正', g.current_user, g.current_role,
        from_status=old_status, to_status='退回补正',
        remark=return_reason
    )

    _add_exception(
        booking_id, return_reason, '退回补正',
        reporter=g.current_user, reporter_role=g.current_role
    )

    if missing_info:
        for detail in missing_info['missing_details']:
            _add_exception(
                booking_id,
                f'缺少【{detail["label"]}】信息 → 需要【{detail["owner_label"]}】补正',
                '材料缺失'
            )

    db.session.commit()

    resp = {
        'success': True,
        'data': serialize_booking(booking),
        'message': f'已退回补正（原状态：{old_status}）',
        'preserved': False,
        'from_status': old_status, 'to_status': '退回补正'
    }
    if missing_info:
        resp['missing_modules'] = missing_info
        resp['warning'] = (
            f'缺少必填证据模块：{"、".join(missing_info["missing_labels"])}；'
            + missing_info['correction_summary']
        )
    return jsonify(resp)


@bp.route('/bookings/<int:booking_id>/resubmit', methods=['POST'])
@require_role('dispatcher')
def resubmit_booking(booking_id):
    booking = TeamBooking.query.get(booking_id)
    if not booking:
        return jsonify({
            'success': False, 'error': '预约单不存在',
            'code': Config.ERROR_CODES['NOT_FOUND']
        }), 404

    data = request.get_json() or {}
    request_version = data.get('version')

    vr = unified_validate(booking, g.current_role, 'resubmit',
                          request_version=request_version,
                          require_complete_modules=True)
    if not vr.ok:
        _add_exception(
            booking_id,
            f'重新提交失败：{vr.error}', '校验拦截',
            reporter='系统', reporter_role='system'
        )
        db.session.commit()
        return vr.to_response()

    old_status = booking.status
    booking.status = '待审核'
    booking.current_handler = Config.HANDLER_ROLE_MAP['dispatcher']
    booking.current_role = 'dispatcher'
    booking.version += 1
    booking.deadline = get_deadline()
    booking.updated_at = datetime.utcnow()

    remark = (data.get('remark') or '材料已补正，重新提交审核').strip()
    _add_processing_record(
        booking_id, '补正后重新提交', g.current_user, g.current_role,
        from_status=old_status, to_status='待审核', remark=remark
    )
    _add_exception(
        booking_id, '材料补正完成 → 重新进入待审核队列', '补正完成',
        reporter=g.current_user, reporter_role=g.current_role
    )

    db.session.commit()

    return jsonify({
        'success': True,
        'data': serialize_booking(booking),
        'message': '已重新提交审核，处理时限已重新计算'
    })


@bp.route('/bookings/<int:booking_id>/module', methods=['PUT'])
@require_role('dispatcher', 'ticketing')
def update_module(booking_id):
    booking = TeamBooking.query.get(booking_id)
    if not booking:
        return jsonify({
            'success': False, 'error': '预约单不存在',
            'code': Config.ERROR_CODES['NOT_FOUND']
        }), 404

    if booking.status == '已同步':
        return jsonify({
            'success': False,
            'error': '已同步归档的单据不允许修改模块信息',
            'code': Config.ERROR_CODES['STATUS_CONFLICT'],
            'current_status': booking.status,
            'preserved': True
        }), 409

    data = request.get_json() or {}
    module_type = data.get('module')

    if module_type not in Config.MODULES:
        return jsonify({
            'success': False, 'error': f'无效的模块类型: {module_type}',
            'code': Config.ERROR_CODES['INVALID_MODULE']
        }), 400

    action_map = {
        'team_booking_info': 'update_booking_info',
        'ticket_verification': 'update_ticket',
        'entry_statistics': 'update_entry'
    }
    action_name = action_map[module_type]
    if not check_permission(g.current_role, action_name):
        return jsonify({
            'success': False,
            'error': f'角色「{Config.ROLE_LABEL.get(g.current_role, g.current_role)}」无权更新模块「{Config.MODULES[module_type]["label"]}」',
            'code': Config.ERROR_CODES['PERMISSION_DENIED']
        }), 403

    version = data.get('version')
    if version is not None and booking.version != version:
        return jsonify({
            'success': False,
            'error': f'版本冲突：提交 v{version} vs 当前 v{booking.version}，请刷新后重试',
            'code': Config.ERROR_CODES['VERSION_CONFLICT'],
            'current_version': booking.version,
            'preserved': True
        }), 409

    is_complete = False
    module_label = Config.MODULES[module_type]['label']

    if module_type == 'team_booking_info':
        it = data.get('itinerary', booking.team_booking_info.itinerary if booking.team_booking_info else '')
        rq = data.get('requirements', booking.team_booking_info.requirements if booking.team_booking_info else '')
        is_complete = bool(it and rq)
        if booking.team_booking_info:
            booking.team_booking_info.itinerary = it
            booking.team_booking_info.requirements = rq
            booking.team_booking_info.submitted_by = g.current_user
            booking.team_booking_info.submitted_at = datetime.utcnow()
            booking.team_booking_info.is_complete = is_complete
        else:
            db.session.add(BookingInfo(
                team_booking_id=booking.id, itinerary=it, requirements=rq,
                submitted_by=g.current_user, is_complete=is_complete
            ))

    elif module_type == 'ticket_verification':
        required = ['ticket_count', 'verified_count']
        missing = [f for f in required if data.get(f) is None and (not booking.ticket_verification)]
        if missing:
            return jsonify({
                'success': False,
                'error': f'缺少必填字段: {", ".join(missing)}',
                'code': Config.ERROR_CODES['MISSING_FIELDS'],
                'preserved': True
            }), 400
        tc = data.get('ticket_count', booking.ticket_verification.ticket_count if booking.ticket_verification else 0)
        vc = data.get('verified_count', booking.ticket_verification.verified_count if booking.ticket_verification else 0)
        tt = data.get('ticket_type', booking.ticket_verification.ticket_type if booking.ticket_verification else '')
        is_complete = bool(tc and vc and int(tc) > 0 and int(vc) > 0)
        if booking.ticket_verification:
            booking.ticket_verification.ticket_count = tc
            booking.ticket_verification.verified_count = vc
            booking.ticket_verification.ticket_type = tt
            booking.ticket_verification.verified_by = g.current_user
            booking.ticket_verification.verified_at = datetime.utcnow()
            booking.ticket_verification.is_complete = is_complete
        else:
            db.session.add(TicketVerification(
                team_booking_id=booking.id, ticket_count=tc, verified_count=vc,
                ticket_type=tt, verified_by=g.current_user,
                verified_at=datetime.utcnow(), is_complete=is_complete
            ))

    elif module_type == 'entry_statistics':
        aec = data.get('actual_entry_count',
                       booking.entry_statistics.actual_entry_count if booking.entry_statistics else 0)
        et_s = data.get('entry_time')
        ext_s = data.get('exit_time')
        def _parse(s):
            try:
                return datetime.fromisoformat(s.replace('Z', '+00:00')) if s else None
            except Exception:
                return None
        et = _parse(et_s) or (booking.entry_statistics.entry_time if booking.entry_statistics else None)
        ext = _parse(ext_s) or (booking.entry_statistics.exit_time if booking.entry_statistics else None)
        is_complete = aec is not None and int(aec) > 0
        if booking.entry_statistics:
            booking.entry_statistics.actual_entry_count = aec
            booking.entry_statistics.entry_time = et
            booking.entry_statistics.exit_time = ext
            booking.entry_statistics.recorded_by = g.current_user
            booking.entry_statistics.recorded_at = datetime.utcnow()
            booking.entry_statistics.is_complete = is_complete
        else:
            db.session.add(EntryStatistics(
                team_booking_id=booking.id, actual_entry_count=aec, entry_time=et,
                exit_time=ext, recorded_by=g.current_user,
                recorded_at=datetime.utcnow(), is_complete=is_complete
            ))

    booking.version += 1
    booking.updated_at = datetime.utcnow()

    _add_processing_record(
        booking_id, f'更新【{module_label}】模块', g.current_user, g.current_role,
        remark=f'{"已完整填写" if is_complete else "部分填写"}：{module_label}'
    )

    if is_complete:
        _add_exception(
            booking_id,
            f'【{module_label}】已由【{g.current_user}】补正完成',
            '材料补正',
            reporter=g.current_user, reporter_role=g.current_role
        )

    db.session.commit()

    resp = {
        'success': True,
        'data': serialize_booking(booking),
        'message': f'{module_label}模块更新成功（{"已完成" if is_complete else "待完善"}）',
        'module_complete': is_complete
    }
    missing_now = check_required_modules(booking)
    if missing_now:
        info = build_missing_modules_error(missing_now)
        resp['still_missing'] = info
    else:
        resp['all_modules_complete'] = True
    return jsonify(resp)


@bp.route('/bookings/batch-process', methods=['POST'])
@require_role('dispatcher', 'manager')
def batch_process():
    data = request.get_json() or {}
    ids = data.get('ids', [])
    action = data.get('action', 'process')

    if not ids:
        return jsonify({
            'success': False,
            'error': '请选择要处理的预约单',
            'code': Config.ERROR_CODES['EMPTY_IDS']
        }), 400

    valid_actions = ('process', 'return', 'advance_overdue')
    if action not in valid_actions:
        return jsonify({
            'success': False,
            'error': f'无效的批量操作: {action}，支持: {", ".join(valid_actions)}',
            'code': Config.ERROR_CODES['INVALID_ACTION']
        }), 400

    if action == 'advance_overdue' and g.current_role != 'manager':
        return jsonify({
            'success': False,
            'error': '仅景区经理可执行「逾期批量推进」操作',
            'code': Config.ERROR_CODES['PERMISSION_DENIED']
        }), 403

    current_role = g.current_role
    current_user = g.current_user
    results = []

    for bid in ids:
        booking = TeamBooking.query.get(bid)
        result = {'id': bid, 'booking_no': booking.booking_no if booking else f'#{bid}'}

        try:
            if not booking:
                result['success'] = False
                result['fail_reason'] = '预约单不存在'
                result['fail_code'] = Config.ERROR_CODES['NOT_FOUND']
                results.append(result)
                continue

            if action == 'process':
                vr = unified_validate(booking, current_role, 'process',
                                      require_complete_modules=True)
                if not vr.ok:
                    result['success'] = False
                    result['fail_reason'] = vr.error
                    result['fail_code'] = vr.code
                    for k, v in vr.data.items():
                        result[k] = v
                    _add_exception(
                        booking.id, f'批量处理拦截：{vr.error}', '校验拦截'
                    )
                    db.session.commit()
                    results.append(result)
                    continue

                old_status = booking.status
                role_map = Config.ROLE_STATUS_MAP[current_role]
                new_status = role_map['next']
                if current_role == 'dispatcher':
                    booking.status = new_status
                    booking.current_handler = Config.HANDLER_ROLE_MAP['manager']
                    booking.current_role = 'manager'
                elif current_role == 'manager':
                    booking.status = new_status
                    booking.current_handler = Config.HANDLER_ROLE_MAP['archived']
                    booking.current_role = 'archived'

                booking.version += 1
                booking.updated_at = datetime.utcnow()
                _add_processing_record(
                    booking.id, '批量处理通过', current_user, current_role,
                    from_status=old_status, to_status=new_status,
                    remark=data.get('remark', '批量处理')
                )
                result['success'] = True
                result['new_status'] = new_status
                result['new_handler'] = booking.current_handler
                result['info'] = describe_booking_status_info(booking)

            elif action == 'return':
                vr = unified_validate(booking, current_role, 'return')
                if not vr.ok:
                    result['success'] = False
                    result['fail_reason'] = vr.error
                    result['fail_code'] = vr.code
                    for k, v in vr.data.items():
                        result[k] = v
                    results.append(result)
                    continue

                old_status = booking.status
                return_reason = (data.get('reason') or '批量退回补正').strip()
                booking.status = '退回补正'
                booking.current_handler = Config.HANDLER_ROLE_MAP['dispatcher']
                booking.current_role = 'dispatcher'
                booking.version += 1
                booking.updated_at = datetime.utcnow()
                _add_processing_record(
                    booking.id, '批量退回', current_user, current_role,
                    from_status=old_status, to_status='退回补正', remark=return_reason
                )
                _add_exception(
                    booking.id, return_reason, '退回补正',
                    reporter=current_user, reporter_role=current_role
                )
                missing_keys = check_required_modules(booking)
                if missing_keys:
                    info = build_missing_modules_error(missing_keys)
                    for detail in info['missing_details']:
                        _add_exception(
                            booking.id,
                            f'缺少【{detail["label"]}】 → 需要【{detail["owner_label"]}】补正',
                            '材料缺失'
                        )
                    result['missing_modules'] = info
                result['success'] = True
                result['new_status'] = '退回补正'
                result['info'] = describe_booking_status_info(booking)

            elif action == 'advance_overdue':
                from .utils import get_urgency_level
                urgency = get_urgency_level(booking.deadline)
                if urgency != 'overdue':
                    result['success'] = False
                    result['fail_reason'] = f'非逾期状态（当前：{urgency}），不可批量推进'
                    result['fail_code'] = 'NOT_OVERDUE'
                    result['preserved'] = True
                    results.append(result)
                    continue
                if booking.status != '待审核':
                    result['success'] = False
                    result['fail_reason'] = f'仅「待审核」可推进，当前「{booking.status}」'
                    result['fail_code'] = Config.ERROR_CODES['STATUS_CONFLICT']
                    result['preserved'] = True
                    results.append(result)
                    continue
                if booking.current_role == 'manager':
                    result['success'] = False
                    result['fail_reason'] = '已在景区经理处，无需重复推进'
                    result['fail_code'] = Config.ERROR_CODES['DUPLICATE_ACTION']
                    result['preserved'] = True
                    results.append(result)
                    continue

                missing_keys = check_required_modules(booking)

                old_handler = booking.current_handler
                booking.current_handler = Config.HANDLER_ROLE_MAP['manager']
                booking.current_role = 'manager'
                booking.version += 1
                booking.updated_at = datetime.utcnow()
                _add_processing_record(
                    booking.id, '逾期批量推进至景区经理', current_user, current_role,
                    remark='因节点超时，批量推进至景区经理复核'
                )
                _add_exception(
                    booking.id,
                    '节点超时：批量推进至景区经理，责任人按原处理人（' + old_handler + '）计算',
                    '超时逾期', reporter=current_user, reporter_role=current_role
                )
                if missing_keys:
                    info = build_missing_modules_error(missing_keys)
                    for detail in info['missing_details']:
                        _add_exception(
                            booking.id,
                            f'推进前仍缺【{detail["label"]}】 → 需【{detail["owner_label"]}】继续补正',
                            '材料缺失'
                        )
                    result['missing_modules'] = info
                result['success'] = True
                result['new_handler'] = Config.HANDLER_ROLE_MAP['manager']
                result['info'] = describe_booking_status_info(booking)

            db.session.commit()
        except Exception as e:
            db.session.rollback()
            result['success'] = False
            result['fail_reason'] = f'数据库异常：{str(e)}'
            result['fail_code'] = 'DB_ERROR'

        results.append(result)

    success_count = sum(1 for r in results if r['success'])
    fail_count = len(results) - success_count
    by_fail_code = {}
    for r in results:
        if not r['success'] and r.get('fail_code'):
            fc = r['fail_code']
            if fc not in by_fail_code:
                by_fail_code[fc] = {'count': 0, 'reason_example': r.get('fail_reason', '')}
            by_fail_code[fc]['count'] += 1

    return jsonify({
        'success': True,
        'data': {
            'results': results,
            'success_count': success_count,
            'fail_count': fail_count,
            'summary': {
                'total': len(results),
                'success': success_count,
                'fail': fail_count,
                'by_fail_code': by_fail_code,
                'current_role': current_role,
                'current_role_label': Config.ROLE_LABEL.get(current_role, current_role)
            }
        },
        'message': f'批量处理完成：成功 {success_count} 条，失败 {fail_count} 条'
    })


@bp.route('/bookings/<int:booking_id>/notes', methods=['POST'])
@require_role('dispatcher', 'ticketing', 'manager')
def add_note(booking_id):
    booking = TeamBooking.query.get(booking_id)
    if not booking:
        return jsonify({
            'success': False, 'error': '预约单不存在',
            'code': Config.ERROR_CODES['NOT_FOUND']
        }), 404

    data = request.get_json() or {}
    note_content = (data.get('note') or '').strip()
    if not note_content:
        return jsonify({
            'success': False, 'error': '备注内容不能为空',
            'code': Config.ERROR_CODES['EMPTY_NOTE']
        }), 400

    note = AuditNote(
        team_booking_id=booking_id,
        note=note_content,
        author=g.current_user,
        author_role=g.current_role
    )
    db.session.add(note)
    booking.version += 1
    booking.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({
        'success': True,
        'data': {
            'id': note.id,
            'note': note.note,
            'author': note.author,
            'author_role': note.author_role,
            'author_label': Config.ROLE_LABEL.get(note.author_role, note.author_role),
            'created_at': note.created_at.isoformat(),
            'new_version': booking.version
        },
        'message': '备注添加成功'
    })


@bp.route('/statistics/dashboard', methods=['GET'])
@require_role('dispatcher', 'ticketing', 'manager')
def get_dashboard_stats():
    from .utils import get_urgency_level

    all_bookings = TeamBooking.query.all()

    normal = approaching = overdue = 0
    status_counts = {}
    missing_counts = {k: 0 for k in Config.MODULES.keys()}

    for b in all_bookings:
        urgency = get_urgency_level(b.deadline)
        if urgency == 'normal': normal += 1
        elif urgency == 'approaching': approaching += 1
        else: overdue += 1
        status_counts[b.status] = status_counts.get(b.status, 0) + 1
        for k in check_required_modules(b):
            missing_counts[k] = missing_counts.get(k, 0) + 1

    role = g.current_role
    role_actionable = 0
    role_missing = {}
    for key, meta in Config.MODULES.items():
        if meta['owner_role'] == role:
            role_missing[key] = {
                'label': meta['label'],
                'count': missing_counts.get(key, 0),
                'owner_label': meta['owner_label']
            }

    by_handler_counts = {}
    for b in all_bookings:
        by_handler_counts[b.current_handler] = by_handler_counts.get(b.current_handler, 0) + 1

    fail_code_summary = {}
    try:
        recent_24h = datetime.utcnow() - timedelta(hours=24)
        from .models import ExceptionReason
        reasons = ExceptionReason.query.filter(
            ExceptionReason.reason_type.in_(['校验拦截', '材料缺失', '超时逾期']),
            ExceptionReason.created_at >= recent_24h
        ).all()

        _code_map = {
            '版本冲突': 'VERSION_CONFLICT',
            '状态冲突': 'STATUS_CONFLICT',
            '处理人': 'WRONG_HANDLER',
            '越权': 'PERMISSION_DENIED',
            '缺': 'MISSING_MODULES',
            '非逾期': 'NOT_OVERDUE',
            '重复': 'DUPLICATE_ACTION',
            '超时': 'NOT_OVERDUE',
            '数据库': 'DB_ERROR'
        }
        for r in reasons:
            code = 'MISSING_MODULES'
            for kw, c in _code_map.items():
                if kw in (r.reason or ''):
                    code = c
                    break
            fail_code_summary.setdefault(code, {'count': 0, 'reason_example': r.reason or ''})
            fail_code_summary[code]['count'] += 1
    except Exception as _e:
        pass

    return jsonify({
        'success': True,
        'data': {
            'total': len(all_bookings),
            'normal': normal,
            'approaching': approaching,
            'overdue': overdue,
            'by_status': status_counts,
            'by_missing_module': {
                k: {
                    'count': missing_counts[k],
                    'label': meta['label'],
                    'owner_role': meta['owner_role'],
                    'owner_label': meta['owner_label']
                } for k, meta in Config.MODULES.items()
            },
            'by_handler': by_handler_counts,
            'current_role': role,
            'current_role_label': Config.ROLE_LABEL.get(role, role),
            'my_missing_modules': role_missing,
            'my_actionable_count': sum(
                1 for b in all_bookings
                if b.current_role == role and b.status != '已同步'
            ),
            'recent_fail_code_summary': fail_code_summary
        }
    })

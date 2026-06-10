from datetime import datetime, timedelta, date
from .models import (
    db, TeamBooking, BookingInfo, TicketVerification, EntryStatistics,
    ProcessingRecord, AuditNote, ExceptionReason
)
from .utils import get_deadline


def seed_database():
    if TeamBooking.query.count() > 0:
        return

    bookings_data = [
        {
            'booking_no': 'TB202606100001',
            'team_name': '阳光旅行团',
            'contact_person': '张经理',
            'contact_phone': '13800138001',
            'visitor_count': 45,
            'visit_date': date(2026, 6, 15),
            'visit_time': '09:00',
            'status': '待审核',
            'current_handler': '现场调度',
            'current_role': 'dispatcher',
            'deadline_hours': 20,
            'scenario': 'normal_pending',
            'modules': {
                'booking': True,
                'ticket': True,
                'entry': True
            }
        },
        {
            'booking_no': 'TB202606100002',
            'team_name': '快乐亲子团',
            'contact_person': '李主任',
            'contact_phone': '13900139002',
            'visitor_count': 30,
            'visit_date': date(2026, 6, 14),
            'visit_time': '10:00',
            'status': '审核通过',
            'current_handler': '景区经理',
            'current_role': 'manager',
            'deadline_hours': 10,
            'scenario': 'normal_approved',
            'modules': {
                'booking': True,
                'ticket': True,
                'entry': True
            }
        },
        {
            'booking_no': 'TB202606100003',
            'team_name': '和谐夕阳红',
            'contact_person': '王阿姨',
            'contact_phone': '13700137003',
            'visitor_count': 25,
            'visit_date': date(2026, 6, 13),
            'visit_time': '08:30',
            'status': '已同步',
            'current_handler': '已归档',
            'current_role': 'archived',
            'deadline_hours': -48,
            'scenario': 'normal_done',
            'modules': {
                'booking': True,
                'ticket': True,
                'entry': True
            }
        },
        {
            'booking_no': 'TB202606100004',
            'team_name': '新星研学团',
            'contact_person': '赵老师',
            'contact_phone': '13600136004',
            'visitor_count': 60,
            'visit_date': date(2026, 6, 16),
            'visit_time': '09:30',
            'status': '待审核',
            'current_handler': '现场调度',
            'current_role': 'dispatcher',
            'deadline_hours': 18,
            'scenario': 'missing_ticket',
            'modules': {
                'booking': True,
                'ticket': False,
                'entry': True
            }
        },
        {
            'booking_no': 'TB202606100005',
            'team_name': '锦绣中华团',
            'contact_person': '陈导',
            'contact_phone': '13500135005',
            'visitor_count': 35,
            'visit_date': date(2026, 6, 12),
            'visit_time': '14:00',
            'status': '待审核',
            'current_handler': '现场调度',
            'current_role': 'dispatcher',
            'deadline_hours': 2,
            'scenario': 'approaching',
            'modules': {
                'booking': True,
                'ticket': True,
                'entry': True
            }
        },
        {
            'booking_no': 'TB202606100006',
            'team_name': '四海一家团',
            'contact_person': '刘总',
            'contact_phone': '13400134006',
            'visitor_count': 50,
            'visit_date': date(2026, 6, 10),
            'visit_time': '11:00',
            'status': '待审核',
            'current_handler': '现场调度',
            'current_role': 'dispatcher',
            'deadline_hours': -6,
            'scenario': 'overdue',
            'modules': {
                'booking': True,
                'ticket': True,
                'entry': True
            }
        },
        {
            'booking_no': 'TB202606100007',
            'team_name': '鹏程万里团',
            'contact_person': '孙女士',
            'contact_phone': '13300133007',
            'visitor_count': 28,
            'visit_date': date(2026, 6, 17),
            'visit_time': '13:00',
            'status': '退回补正',
            'current_handler': '现场调度',
            'current_role': 'dispatcher',
            'deadline_hours': 36,
            'scenario': 'returned_missing',
            'modules': {
                'booking': True,
                'ticket': False,
                'entry': False
            }
        },
        {
            'booking_no': 'TB202606100008',
            'team_name': '金色年华团',
            'contact_person': '周先生',
            'contact_phone': '13200132008',
            'visitor_count': 40,
            'visit_date': date(2026, 6, 11),
            'visit_time': '15:30',
            'status': '退回补正',
            'current_handler': '现场调度',
            'current_role': 'dispatcher',
            'deadline_hours': -12,
            'scenario': 'returned_conflict',
            'modules': {
                'booking': True,
                'ticket': True,
                'entry': True
            }
        }
    ]

    for bd in bookings_data:
        base_time = datetime.utcnow()
        deadline = base_time + timedelta(hours=bd['deadline_hours'])
        created_at = base_time - timedelta(hours=24 - bd['deadline_hours']) if bd['deadline_hours'] < 24 else base_time

        booking = TeamBooking(
            booking_no=bd['booking_no'],
            team_name=bd['team_name'],
            contact_person=bd['contact_person'],
            contact_phone=bd['contact_phone'],
            visitor_count=bd['visitor_count'],
            visit_date=bd['visit_date'],
            visit_time=bd['visit_time'],
            status=bd['status'],
            current_handler=bd['current_handler'],
            current_role=bd['current_role'],
            version=1,
            deadline=deadline,
            created_at=created_at
        )
        db.session.add(booking)
        db.session.flush()

        if bd['modules']['booking']:
            bi = BookingInfo(
                team_booking_id=booking.id,
                itinerary='A线：大门 → 主峰 → 玻璃栈道 → 下山缆车',
                requirements='需要中英文双语导游1名，午餐团餐40人桌',
                submitted_by='系统初始化',
                submitted_at=created_at,
                is_complete=True
            )
            db.session.add(bi)

        if bd['modules']['ticket']:
            tv = TicketVerification(
                team_booking_id=booking.id,
                ticket_count=bd['visitor_count'],
                verified_count=bd['visitor_count'],
                ticket_type='团队通票',
                verified_by='票务专员-小李',
                verified_at=created_at + timedelta(minutes=30),
                is_complete=True
            )
            db.session.add(tv)

        if bd['modules']['entry']:
            es = EntryStatistics(
                team_booking_id=booking.id,
                actual_entry_count=bd['visitor_count'],
                entry_time=created_at + timedelta(days=1, hours=2),
                exit_time=created_at + timedelta(days=1, hours=8),
                recorded_by='现场调度-小王',
                recorded_at=created_at + timedelta(days=1, hours=8, minutes=30),
                is_complete=True
            )
            db.session.add(es)

        if bd['scenario'] == 'normal_pending':
            pr = ProcessingRecord(
                team_booking_id=booking.id,
                action='创建预约单',
                to_status='待审核',
                operator='系统初始化',
                operator_role='system',
                remark='演示数据：正常待审核流程'
            )
            db.session.add(pr)

        elif bd['scenario'] == 'normal_approved':
            pr1 = ProcessingRecord(
                team_booking_id=booking.id,
                action='创建预约单',
                to_status='待审核',
                operator='系统初始化',
                operator_role='system',
                remark='演示数据'
            )
            pr2 = ProcessingRecord(
                team_booking_id=booking.id,
                action='现场调度审核通过，提交景区经理复核',
                from_status='待审核',
                to_status='审核通过',
                operator='现场调度-小王',
                operator_role='dispatcher',
                remark='三模块信息齐全，审核通过'
            )
            db.session.add_all([pr1, pr2])
            booking.version = 2

        elif bd['scenario'] == 'normal_done':
            pr1 = ProcessingRecord(
                team_booking_id=booking.id,
                action='创建预约单',
                to_status='待审核',
                operator='系统初始化',
                operator_role='system',
                remark='演示数据'
            )
            pr2 = ProcessingRecord(
                team_booking_id=booking.id,
                action='现场调度审核通过，提交景区经理复核',
                from_status='待审核',
                to_status='审核通过',
                operator='现场调度-小王',
                operator_role='dispatcher',
                remark='审核通过'
            )
            pr3 = ProcessingRecord(
                team_booking_id=booking.id,
                action='景区经理复核通过，归档完成',
                from_status='审核通过',
                to_status='已同步',
                operator='景区经理-张总',
                operator_role='manager',
                remark='复核无误，归档完成'
            )
            an = AuditNote(
                team_booking_id=booking.id,
                note='团队接待顺利，游客反馈良好',
                author='景区经理-张总',
                author_role='manager'
            )
            db.session.add_all([pr1, pr2, pr3, an])
            booking.version = 3

        elif bd['scenario'] == 'missing_ticket':
            pr = ProcessingRecord(
                team_booking_id=booking.id,
                action='创建预约单',
                to_status='待审核',
                operator='系统初始化',
                operator_role='system',
                remark='演示数据：缺少票务核销模块'
            )
            exc = ExceptionReason(
                team_booking_id=booking.id,
                reason='票务核销信息未提交，请票务专员补正',
                category='材料缺失',
                reporter='系统',
                reporter_role='system'
            )
            db.session.add_all([pr, exc])

        elif bd['scenario'] == 'approaching':
            pr = ProcessingRecord(
                team_booking_id=booking.id,
                action='创建预约单',
                to_status='待审核',
                operator='系统初始化',
                operator_role='system',
                remark='演示数据：临期预警（剩余不足4小时）'
            )
            exc = ExceptionReason(
                team_booking_id=booking.id,
                reason='节点即将超时，请尽快处理',
                category='临期预警',
                reporter='系统',
                reporter_role='system'
            )
            db.session.add_all([pr, exc])

        elif bd['scenario'] == 'overdue':
            pr = ProcessingRecord(
                team_booking_id=booking.id,
                action='创建预约单',
                to_status='待审核',
                operator='系统初始化',
                operator_role='system',
                remark='演示数据：已逾期'
            )
            exc = ExceptionReason(
                team_booking_id=booking.id,
                reason='节点超时，已超过处理期限',
                category='超时逾期',
                reporter='系统',
                reporter_role='system'
            )
            db.session.add_all([pr, exc])

        elif bd['scenario'] == 'returned_missing':
            pr1 = ProcessingRecord(
                team_booking_id=booking.id,
                action='创建预约单',
                to_status='待审核',
                operator='系统初始化',
                operator_role='system',
                remark='演示数据'
            )
            pr2 = ProcessingRecord(
                team_booking_id=booking.id,
                action='退回补正',
                from_status='待审核',
                to_status='退回补正',
                operator='景区经理-张总',
                operator_role='manager',
                remark='缺少票务核销和入园统计信息，请补正后重新提交'
            )
            exc1 = ExceptionReason(
                team_booking_id=booking.id,
                reason='缺少票务核销和入园统计信息，请补正后重新提交',
                category='退回补正',
                reporter='景区经理-张总',
                reporter_role='manager'
            )
            exc2 = ExceptionReason(
                team_booking_id=booking.id,
                reason='缺少票务核销信息，需要补正',
                category='材料缺失',
                reporter='系统',
                reporter_role='system'
            )
            exc3 = ExceptionReason(
                team_booking_id=booking.id,
                reason='缺少入园统计信息，需要补正',
                category='材料缺失',
                reporter='系统',
                reporter_role='system'
            )
            an = AuditNote(
                team_booking_id=booking.id,
                note='材料不齐全，请票务专员和现场调度分别补正后再提交',
                author='景区经理-张总',
                author_role='manager'
            )
            db.session.add_all([pr1, pr2, exc1, exc2, exc3, an])
            booking.version = 2

        elif bd['scenario'] == 'returned_conflict':
            pr1 = ProcessingRecord(
                team_booking_id=booking.id,
                action='创建预约单',
                to_status='待审核',
                operator='系统初始化',
                operator_role='system',
                remark='演示数据'
            )
            pr2 = ProcessingRecord(
                team_booking_id=booking.id,
                action='现场调度审核通过，提交景区经理复核',
                from_status='待审核',
                to_status='审核通过',
                operator='现场调度-小王',
                operator_role='dispatcher',
                remark='提交复核'
            )
            pr3 = ProcessingRecord(
                team_booking_id=booking.id,
                action='退回补正',
                from_status='审核通过',
                to_status='退回补正',
                operator='景区经理-张总',
                operator_role='manager',
                remark='入园人数与预约人数不符，存在状态冲突，请核实后重新提交'
            )
            exc1 = ExceptionReason(
                team_booking_id=booking.id,
                reason='入园人数（40人）与预约人数（40人）表面一致，但核销时间与入园时间存在逻辑冲突',
                category='状态冲突',
                reporter='景区经理-张总',
                reporter_role='manager'
            )
            an = AuditNote(
                team_booking_id=booking.id,
                note='请现场调度核实票务核销和入园统计的时间线一致性',
                author='景区经理-张总',
                author_role='manager'
            )
            db.session.add_all([pr1, pr2, pr3, exc1, an])
            booking.version = 3

    db.session.commit()

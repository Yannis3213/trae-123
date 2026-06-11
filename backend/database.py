import sqlite3
import os
from contextlib import contextmanager
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), 'meeting_booking.db')

ROLES = {
    'register': '会议预约登记员',
    'audit': '会议预约审核主管',
    'review': '行政后勤中心复核负责人'
}

STAGES = {
    'room_booking': '会议室预约',
    'equipment_prep': '设备准备',
    'usage_confirm': '使用确认'
}

STATUS_FLOW = {
    'pending_sign': '待签收',
    'exception_return': '异常回传',
    'sign_complete': '签收完成',
    'reviewed': '已归档'
}

def init_db():
    with get_conn() as conn:
        c = conn.cursor()
        
        c.execute('''CREATE TABLE IF NOT EXISTS meeting_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_no TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            meeting_date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            room_name TEXT,
            attendees INTEGER,
            content TEXT,
            status TEXT NOT NULL DEFAULT 'pending_sign',
            current_stage TEXT NOT NULL DEFAULT 'room_booking',
            current_role TEXT NOT NULL DEFAULT 'register',
            handler TEXT,
            deadline TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            created_by TEXT NOT NULL,
            room_booking_evidence TEXT,
            equipment_evidence TEXT,
            usage_evidence TEXT,
            is_overdue INTEGER NOT NULL DEFAULT 0
        )''')
        
        c.execute('''CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            stage TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            uploaded_by TEXT NOT NULL,
            uploaded_at TEXT NOT NULL,
            FOREIGN KEY (order_id) REFERENCES meeting_orders(id)
        )''')
        
        c.execute('''CREATE TABLE IF NOT EXISTS process_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            order_version INTEGER NOT NULL,
            action TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT,
            from_stage TEXT,
            to_stage TEXT,
            from_role TEXT,
            to_role TEXT,
            handler TEXT NOT NULL,
            handler_role TEXT NOT NULL,
            opinion TEXT,
            audit_remark TEXT,
            exception_reason TEXT,
            is_exception INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (order_id) REFERENCES meeting_orders(id)
        )''')
        
        c.execute('''CREATE TABLE IF NOT EXISTS audit_remarks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            remark TEXT NOT NULL,
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (order_id) REFERENCES meeting_orders(id)
        )''')
        
        c.execute('''CREATE TABLE IF NOT EXISTS exception_reasons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            stage TEXT NOT NULL,
            reason TEXT NOT NULL,
            reported_by TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (order_id) REFERENCES meeting_orders(id)
        )''')
        
        conn.commit()
        _init_sample_data(conn)

def _init_sample_data(conn):
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM meeting_orders")
    if c.fetchone()[0] > 0:
        return
    
    now = datetime.now()
    
    sample_orders = [
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-001',
            'title': 'Q2季度总结大会',
            'meeting_date': (now + timedelta(days=5)).strftime('%Y-%m-%d'),
            'start_time': '09:00',
            'end_time': '11:00',
            'room_name': '多功能厅A',
            'attendees': 50,
            'content': '第二季度工作总结与第三季度规划部署',
            'deadline': (now + timedelta(days=3)).strftime('%Y-%m-%d %H:%M:%S'),
            'created_by': 'zhangsan',
            'handler': 'lisi',
            'current_role': 'audit',
            'status': 'pending_sign',
            'current_stage': 'room_booking',
            'version': 1,
            'room_booking_evidence': '',
            'equipment_evidence': '',
            'usage_evidence': ''
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-002',
            'title': '产品需求评审会',
            'meeting_date': (now + timedelta(days=3)).strftime('%Y-%m-%d'),
            'start_time': '14:00',
            'end_time': '16:00',
            'room_name': '会议室302',
            'attendees': 12,
            'content': '新产品V2.0功能需求讨论与评审',
            'deadline': (now + timedelta(days=2)).strftime('%Y-%m-%d %H:%M:%S'),
            'created_by': 'zhangsan',
            'handler': 'lisi',
            'current_role': 'audit',
            'status': 'pending_sign',
            'current_stage': 'room_booking',
            'version': 1,
            'room_booking_evidence': '已确认302会议室【HR-2026-0608-001】',
            'equipment_evidence': '',
            'usage_evidence': ''
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-003',
            'title': '技术架构讨论会',
            'meeting_date': (now + timedelta(days=7)).strftime('%Y-%m-%d'),
            'start_time': '10:00',
            'end_time': '12:00',
            'room_name': '会议室201',
            'attendees': 8,
            'content': '系统架构升级方案讨论与决策',
            'deadline': (now + timedelta(days=5)).strftime('%Y-%m-%d %H:%M:%S'),
            'created_by': 'zhangsan',
            'handler': 'zhangsan',
            'current_role': 'register',
            'status': 'exception_return',
            'current_stage': 'room_booking',
            'version': 2,
            'room_booking_evidence': '',
            'equipment_evidence': '',
            'usage_evidence': ''
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-004',
            'title': '新员工入职培训',
            'meeting_date': (now + timedelta(days=2)).strftime('%Y-%m-%d'),
            'start_time': '09:00',
            'end_time': '17:00',
            'room_name': '培训室',
            'attendees': 20,
            'content': '6月新员工入职培训',
            'deadline': (now - timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S'),
            'created_by': 'zhangsan',
            'handler': 'lisi',
            'current_role': 'audit',
            'status': 'pending_sign',
            'current_stage': 'equipment_prep',
            'version': 2,
            'is_overdue': 1,
            'room_booking_evidence': '培训室已预约【AD-2026-0605-015】',
            'equipment_evidence': '',
            'usage_evidence': ''
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-005',
            'title': '客户沟通会',
            'meeting_date': (now + timedelta(days=1)).strftime('%Y-%m-%d'),
            'start_time': '15:00',
            'end_time': '17:00',
            'room_name': '贵宾会议室',
            'attendees': 6,
            'content': '重要客户合作洽谈',
            'deadline': (now + timedelta(hours=12)).strftime('%Y-%m-%d %H:%M:%S'),
            'created_by': 'zhangsan',
            'handler': 'wangwu',
            'current_role': 'review',
            'status': 'reviewed',
            'current_stage': 'usage_confirm',
            'version': 5,
            'room_booking_evidence': '贵宾室已确认【VIP-2026-0610-001】',
            'equipment_evidence': '投影、音响、茶水已准备',
            'usage_evidence': '客户签字确认单'
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-006',
            'title': '部门周例会',
            'meeting_date': (now + timedelta(days=1)).strftime('%Y-%m-%d'),
            'start_time': '10:00',
            'end_time': '11:00',
            'room_name': '会议室101',
            'attendees': 15,
            'content': '每周例行工作汇报',
            'deadline': (now + timedelta(hours=6)).strftime('%Y-%m-%d %H:%M:%S'),
            'created_by': 'zhangsan',
            'handler': 'lisi',
            'current_role': 'audit',
            'status': 'pending_sign',
            'current_stage': 'equipment_prep',
            'version': 2,
            'room_booking_evidence': '101会议室已预约',
            'equipment_evidence': '',
            'usage_evidence': ''
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-007',
            'title': '安全生产培训',
            'meeting_date': (now + timedelta(days=4)).strftime('%Y-%m-%d'),
            'start_time': '14:00',
            'end_time': '16:00',
            'room_name': '多功能厅B',
            'attendees': 80,
            'content': '全员安全生产知识培训',
            'deadline': (now + timedelta(days=2)).strftime('%Y-%m-%d %H:%M:%S'),
            'created_by': 'zhangsan',
            'handler': 'lisi',
            'current_role': 'audit',
            'status': 'pending_sign',
            'current_stage': 'usage_confirm',
            'version': 3,
            'room_booking_evidence': '多功能厅B已确认',
            'equipment_evidence': '音响、话筒、投影已调试完成',
            'usage_evidence': ''
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-008',
            'title': '财务月度报表评审',
            'meeting_date': (now + timedelta(days=6)).strftime('%Y-%m-%d'),
            'start_time': '09:30',
            'end_time': '12:00',
            'room_name': '董事会议室',
            'attendees': 10,
            'content': '5月财务报表审阅与分析',
            'deadline': (now + timedelta(days=4)).strftime('%Y-%m-%d %H:%M:%S'),
            'created_by': 'zhangsan',
            'handler': 'zhangsan',
            'current_role': 'register',
            'status': 'exception_return',
            'current_stage': 'equipment_prep',
            'version': 3,
            'room_booking_evidence': '董事会议室已预约',
            'equipment_evidence': '',
            'usage_evidence': ''
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-009',
            'title': '年中绩效评审会',
            'meeting_date': (now + timedelta(days=3)).strftime('%Y-%m-%d'),
            'start_time': '09:00',
            'end_time': '12:00',
            'room_name': '大会议室',
            'attendees': 30,
            'content': '上半年绩效评审与下半年目标设定',
            'deadline': (now + timedelta(days=2)).strftime('%Y-%m-%d %H:%M:%S'),
            'created_by': 'zhangsan',
            'handler': 'wangwu',
            'current_role': 'review',
            'status': 'sign_complete',
            'current_stage': 'usage_confirm',
            'version': 6,
            'room_booking_evidence': '大会议室已确认【PERF-2026-0609-001】',
            'equipment_evidence': '投影仪、麦克风、签到系统已就绪',
            'usage_evidence': '参会人员签到表及评审结论'
        }
    ]
    
    for order in sample_orders:
        created_at = (now - timedelta(hours=2)).strftime('%Y-%m-%d %H:%M:%S')
        updated_at = now.strftime('%Y-%m-%d %H:%M:%S')
        c.execute('''INSERT INTO meeting_orders 
            (order_no, title, meeting_date, start_time, end_time, room_name, 
             attendees, content, status, current_stage, current_role, handler,
             deadline, version, created_at, updated_at, created_by, room_booking_evidence, 
             equipment_evidence, usage_evidence, is_overdue)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (order['order_no'], order['title'], order['meeting_date'], 
             order['start_time'], order['end_time'], order.get('room_name'),
             order.get('attendees'), order.get('content'), order.get('status', 'pending_sign'),
             order['current_stage'], order['current_role'], order.get('handler'), 
             order['deadline'], order.get('version', 1),
             created_at, updated_at, order['created_by'],
             order.get('room_booking_evidence', ''), order.get('equipment_evidence', ''),
             order.get('usage_evidence', ''), order.get('is_overdue', 0)))
    
    conn.commit()
    
    _init_sample_records(conn, sample_orders)

def _init_sample_records(conn, orders):
    c = conn.cursor()
    now = datetime.now()
    
    order_no_map = {o['order_no']: idx + 1 for idx, o in enumerate(orders)}
    
    records = [
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-001',
            'version': 1,
            'action': 'create',
            'from_status': None,
            'to_status': 'pending_sign',
            'from_stage': None,
            'to_stage': 'room_booking',
            'from_role': None,
            'to_role': 'audit',
            'handler': 'zhangsan',
            'handler_role': 'register',
            'opinion': '创建Q2季度总结大会预约单',
            'audit_remark': None,
            'exception_reason': None,
            'is_exception': 0,
            'hours_ago': 24
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-002',
            'version': 1,
            'action': 'create',
            'from_status': None,
            'to_status': 'pending_sign',
            'from_stage': None,
            'to_stage': 'room_booking',
            'from_role': None,
            'to_role': 'audit',
            'handler': 'zhangsan',
            'handler_role': 'register',
            'opinion': '创建产品需求评审会预约单',
            'audit_remark': None,
            'exception_reason': None,
            'is_exception': 0,
            'hours_ago': 20
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-003',
            'version': 1,
            'action': 'create',
            'from_status': None,
            'to_status': 'pending_sign',
            'from_stage': None,
            'to_stage': 'room_booking',
            'from_role': None,
            'to_role': 'audit',
            'handler': 'zhangsan',
            'handler_role': 'register',
            'opinion': '创建技术架构讨论会预约单',
            'audit_remark': None,
            'exception_reason': None,
            'is_exception': 0,
            'hours_ago': 48
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-003',
            'version': 1,
            'action': 'exception',
            'from_status': 'pending_sign',
            'to_status': 'exception_return',
            'from_stage': 'room_booking',
            'to_stage': 'room_booking',
            'from_role': 'audit',
            'to_role': 'register',
            'handler': 'lisi',
            'handler_role': 'audit',
            'opinion': '材料不完整',
            'audit_remark': None,
            'exception_reason': '缺少会议室预约确认单编号，请补正后重新提交',
            'is_exception': 1,
            'hours_ago': 36
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-004',
            'version': 1,
            'action': 'create',
            'from_status': None,
            'to_status': 'pending_sign',
            'from_stage': None,
            'to_stage': 'room_booking',
            'from_role': None,
            'to_role': 'audit',
            'handler': 'zhangsan',
            'handler_role': 'register',
            'opinion': '创建新员工入职培训预约单',
            'audit_remark': None,
            'exception_reason': None,
            'is_exception': 0,
            'hours_ago': 72
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-004',
            'version': 1,
            'action': 'approve',
            'from_status': 'pending_sign',
            'to_status': 'pending_sign',
            'from_stage': 'room_booking',
            'to_stage': 'equipment_prep',
            'from_role': 'audit',
            'to_role': 'audit',
            'handler': 'lisi',
            'handler_role': 'audit',
            'opinion': '会议室预约已确认，进入设备准备环节',
            'audit_remark': None,
            'exception_reason': None,
            'is_exception': 0,
            'hours_ago': 60
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-005',
            'version': 1,
            'action': 'create',
            'from_status': None,
            'to_status': 'pending_sign',
            'from_stage': None,
            'to_stage': 'room_booking',
            'from_role': None,
            'to_role': 'audit',
            'handler': 'zhangsan',
            'handler_role': 'register',
            'opinion': '创建客户沟通会预约单',
            'audit_remark': None,
            'exception_reason': None,
            'is_exception': 0,
            'hours_ago': 96
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-005',
            'version': 1,
            'action': 'approve',
            'from_status': 'pending_sign',
            'to_status': 'pending_sign',
            'from_stage': 'room_booking',
            'to_stage': 'equipment_prep',
            'from_role': 'audit',
            'to_role': 'audit',
            'handler': 'lisi',
            'handler_role': 'audit',
            'opinion': '贵宾室已确认，进入设备准备环节',
            'audit_remark': None,
            'exception_reason': None,
            'is_exception': 0,
            'hours_ago': 84
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-005',
            'version': 2,
            'action': 'approve',
            'from_status': 'pending_sign',
            'to_status': 'pending_sign',
            'from_stage': 'equipment_prep',
            'to_stage': 'usage_confirm',
            'from_role': 'audit',
            'to_role': 'audit',
            'handler': 'lisi',
            'handler_role': 'audit',
            'opinion': '设备已全部准备就绪，进入使用确认环节',
            'audit_remark': None,
            'exception_reason': None,
            'is_exception': 0,
            'hours_ago': 72
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-005',
            'version': 3,
            'action': 'approve',
            'from_status': 'pending_sign',
            'to_status': 'sign_complete',
            'from_stage': 'usage_confirm',
            'to_stage': 'usage_confirm',
            'from_role': 'audit',
            'to_role': 'review',
            'handler': 'lisi',
            'handler_role': 'audit',
            'opinion': '使用确认已完成，提交复核归档',
            'audit_remark': None,
            'exception_reason': None,
            'is_exception': 0,
            'hours_ago': 48
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-005',
            'version': 4,
            'action': 'review',
            'from_status': 'sign_complete',
            'to_status': 'reviewed',
            'from_stage': 'usage_confirm',
            'to_stage': 'usage_confirm',
            'from_role': 'review',
            'to_role': 'review',
            'handler': 'wangwu',
            'handler_role': 'review',
            'opinion': '复核通过，已归档',
            'audit_remark': '重要客户会议，流程合规',
            'exception_reason': None,
            'is_exception': 0,
            'hours_ago': 24
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-006',
            'version': 1,
            'action': 'create',
            'from_status': None,
            'to_status': 'pending_sign',
            'from_stage': None,
            'to_stage': 'room_booking',
            'from_role': None,
            'to_role': 'audit',
            'handler': 'zhangsan',
            'handler_role': 'register',
            'opinion': '创建部门周例会预约单',
            'audit_remark': None,
            'exception_reason': None,
            'is_exception': 0,
            'hours_ago': 30
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-006',
            'version': 1,
            'action': 'approve',
            'from_status': 'pending_sign',
            'to_status': 'pending_sign',
            'from_stage': 'room_booking',
            'to_stage': 'equipment_prep',
            'from_role': 'audit',
            'to_role': 'audit',
            'handler': 'lisi',
            'handler_role': 'audit',
            'opinion': '101会议室已确认',
            'audit_remark': None,
            'exception_reason': None,
            'is_exception': 0,
            'hours_ago': 18
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-007',
            'version': 1,
            'action': 'create',
            'from_status': None,
            'to_status': 'pending_sign',
            'from_stage': None,
            'to_stage': 'room_booking',
            'from_role': None,
            'to_role': 'audit',
            'handler': 'zhangsan',
            'handler_role': 'register',
            'opinion': '创建安全生产培训预约单',
            'audit_remark': None,
            'exception_reason': None,
            'is_exception': 0,
            'hours_ago': 60
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-007',
            'version': 1,
            'action': 'approve',
            'from_status': 'pending_sign',
            'to_status': 'pending_sign',
            'from_stage': 'room_booking',
            'to_stage': 'equipment_prep',
            'from_role': 'audit',
            'to_role': 'audit',
            'handler': 'lisi',
            'handler_role': 'audit',
            'opinion': '多功能厅B已确认',
            'audit_remark': None,
            'exception_reason': None,
            'is_exception': 0,
            'hours_ago': 50
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-007',
            'version': 2,
            'action': 'approve',
            'from_status': 'pending_sign',
            'to_status': 'pending_sign',
            'from_stage': 'equipment_prep',
            'to_stage': 'usage_confirm',
            'from_role': 'audit',
            'to_role': 'audit',
            'handler': 'lisi',
            'handler_role': 'audit',
            'opinion': '设备已全部调试完成',
            'audit_remark': None,
            'exception_reason': None,
            'is_exception': 0,
            'hours_ago': 36
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-008',
            'version': 1,
            'action': 'create',
            'from_status': None,
            'to_status': 'pending_sign',
            'from_stage': None,
            'to_stage': 'room_booking',
            'from_role': None,
            'to_role': 'audit',
            'handler': 'zhangsan',
            'handler_role': 'register',
            'opinion': '创建财务月度报表评审预约单',
            'audit_remark': None,
            'exception_reason': None,
            'is_exception': 0,
            'hours_ago': 96
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-008',
            'version': 1,
            'action': 'approve',
            'from_status': 'pending_sign',
            'to_status': 'pending_sign',
            'from_stage': 'room_booking',
            'to_stage': 'equipment_prep',
            'from_role': 'audit',
            'to_role': 'audit',
            'handler': 'lisi',
            'handler_role': 'audit',
            'opinion': '董事会议室已确认',
            'audit_remark': None,
            'exception_reason': None,
            'is_exception': 0,
            'hours_ago': 84
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-008',
            'version': 2,
            'action': 'exception',
            'from_status': 'pending_sign',
            'to_status': 'exception_return',
            'from_stage': 'equipment_prep',
            'to_stage': 'equipment_prep',
            'from_role': 'audit',
            'to_role': 'register',
            'handler': 'lisi',
            'handler_role': 'audit',
            'opinion': '设备清单不完整',
            'audit_remark': None,
            'exception_reason': '董事会议室需配备专业音响系统和视频会议设备，请补充设备清单后重新提交',
            'is_exception': 1,
            'hours_ago': 72
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-009',
            'version': 1,
            'action': 'create',
            'from_status': None,
            'to_status': 'pending_sign',
            'from_stage': None,
            'to_stage': 'room_booking',
            'from_role': None,
            'to_role': 'audit',
            'handler': 'zhangsan',
            'handler_role': 'register',
            'opinion': '创建年中绩效评审会预约单',
            'audit_remark': None,
            'exception_reason': None,
            'is_exception': 0,
            'hours_ago': 120
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-009',
            'version': 1,
            'action': 'exception',
            'from_status': 'pending_sign',
            'to_status': 'exception_return',
            'from_stage': 'room_booking',
            'to_stage': 'room_booking',
            'from_role': 'audit',
            'to_role': 'register',
            'handler': 'lisi',
            'handler_role': 'audit',
            'opinion': '会议室预约信息缺少确认编号',
            'audit_remark': None,
            'exception_reason': '大会议室预约缺少确认编号，请补充后重新提交',
            'is_exception': 1,
            'hours_ago': 108
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-009',
            'version': 2,
            'action': 'resubmit',
            'from_status': 'exception_return',
            'to_status': 'pending_sign',
            'from_stage': 'room_booking',
            'to_stage': 'room_booking',
            'from_role': 'register',
            'to_role': 'audit',
            'handler': 'zhangsan',
            'handler_role': 'register',
            'opinion': '已补充会议室预约确认编号',
            'audit_remark': None,
            'exception_reason': None,
            'is_exception': 0,
            'hours_ago': 96
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-009',
            'version': 3,
            'action': 'approve',
            'from_status': 'pending_sign',
            'to_status': 'pending_sign',
            'from_stage': 'room_booking',
            'to_stage': 'equipment_prep',
            'from_role': 'audit',
            'to_role': 'audit',
            'handler': 'lisi',
            'handler_role': 'audit',
            'opinion': '会议室预约已确认，进入设备准备环节',
            'audit_remark': None,
            'exception_reason': None,
            'is_exception': 0,
            'hours_ago': 84
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-009',
            'version': 4,
            'action': 'approve',
            'from_status': 'pending_sign',
            'to_status': 'pending_sign',
            'from_stage': 'equipment_prep',
            'to_stage': 'usage_confirm',
            'from_role': 'audit',
            'to_role': 'audit',
            'handler': 'lisi',
            'handler_role': 'audit',
            'opinion': '设备全部就绪，进入使用确认环节',
            'audit_remark': None,
            'exception_reason': None,
            'is_exception': 0,
            'hours_ago': 72
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-009',
            'version': 5,
            'action': 'approve',
            'from_status': 'pending_sign',
            'to_status': 'sign_complete',
            'from_stage': 'usage_confirm',
            'to_stage': 'usage_confirm',
            'from_role': 'audit',
            'to_role': 'review',
            'handler': 'lisi',
            'handler_role': 'audit',
            'opinion': '使用确认完成，提交复核归档',
            'audit_remark': '补正后流程完整，三阶段证据齐全，待复核归档',
            'exception_reason': None,
            'is_exception': 0,
            'hours_ago': 48
        }
    ]
    
    for record in records:
        order_id = order_no_map.get(record['order_no'])
        if not order_id:
            continue
        
        created_at = (now - timedelta(hours=record['hours_ago'])).strftime('%Y-%m-%d %H:%M:%S')
        
        c.execute('''INSERT INTO process_records 
            (order_id, order_version, action, from_status, to_status, from_stage, to_stage,
             from_role, to_role, handler, handler_role, opinion, audit_remark, exception_reason, is_exception, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (order_id, record['version'], record['action'], record['from_status'], record['to_status'],
             record['from_stage'], record['to_stage'], record['from_role'], record['to_role'],
             record['handler'], record['handler_role'], record['opinion'], record['audit_remark'],
             record['exception_reason'], record['is_exception'], created_at))
    
    conn.commit()
    
    exception_examples = [
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-003',
            'stage': 'room_booking',
            'reason': '缺少会议室预约确认单编号，请补正后重新提交',
            'reported_by': 'lisi',
            'hours_ago': 36
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-008',
            'stage': 'equipment_prep',
            'reason': '董事会议室需配备专业音响系统和视频会议设备，请补充设备清单后重新提交',
            'reported_by': 'lisi',
            'hours_ago': 72
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-009',
            'stage': 'room_booking',
            'reason': '大会议室预约缺少确认编号，请补充后重新提交',
            'reported_by': 'lisi',
            'hours_ago': 108
        }
    ]
    
    for ex in exception_examples:
        order_id = order_no_map.get(ex['order_no'])
        if not order_id:
            continue
        
        created_at = (now - timedelta(hours=ex['hours_ago'])).strftime('%Y-%m-%d %H:%M:%S')
        c.execute('''INSERT INTO exception_reasons 
            (order_id, stage, reason, reported_by, created_at)
            VALUES (?, ?, ?, ?, ?)''',
            (order_id, ex['stage'], ex['reason'], ex['reported_by'], created_at))
    
    conn.commit()
    
    remark_examples = [
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-005',
            'remark': '重要客户会议，流程合规，证据齐全，同意归档',
            'created_by': 'wangwu',
            'hours_ago': 24
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-009',
            'remark': '补正后流程完整，三阶段证据齐全，待复核归档',
            'created_by': 'lisi',
            'hours_ago': 48
        }
    ]
    
    for remark in remark_examples:
        order_id = order_no_map.get(remark['order_no'])
        if not order_id:
            continue
        
        created_at = (now - timedelta(hours=remark['hours_ago'])).strftime('%Y-%m-%d %H:%M:%S')
        c.execute('''INSERT INTO audit_remarks 
            (order_id, remark, created_by, created_at)
            VALUES (?, ?, ?, ?)''',
            (order_id, remark['remark'], remark['created_by'], created_at))
    
    conn.commit()

@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

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
    'sign_complete': '签收完成'
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
            'content': '第二季度工作总结与第三季度规划',
            'deadline': (now + timedelta(days=3)).strftime('%Y-%m-%d %H:%M:%S'),
            'created_by': 'zhangsan',
            'handler': 'lisi',
            'current_role': 'audit'
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-002',
            'title': '产品需求评审会',
            'meeting_date': (now + timedelta(days=3)).strftime('%Y-%m-%d'),
            'start_time': '14:00',
            'end_time': '16:00',
            'room_name': '会议室302',
            'attendees': 12,
            'content': '新产品功能需求讨论与评审',
            'deadline': (now + timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S'),
            'created_by': 'zhangsan',
            'handler': 'lisi',
            'current_role': 'audit',
            'room_booking_evidence': '已确认302会议室'
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-003',
            'title': '技术架构讨论会',
            'meeting_date': (now + timedelta(days=7)).strftime('%Y-%m-%d'),
            'start_time': '10:00',
            'end_time': '12:00',
            'room_name': '会议室201',
            'attendees': 8,
            'content': '系统架构升级方案讨论',
            'deadline': (now + timedelta(days=5)).strftime('%Y-%m-%d %H:%M:%S'),
            'created_by': 'zhangsan',
            'status': 'exception_return',
            'handler': 'zhangsan',
            'current_role': 'register'
        },
        {
            'order_no': f'MEET-{now.strftime("%Y%m")}-004',
            'title': '新员工入职培训',
            'meeting_date': (now + timedelta(days=2)).strftime('%Y-%m-%d'),
            'start_time': '09:00',
            'end_time': '17:00',
            'room_name': '培训室',
            'attendees': 20,
            'content': '新员工入职培训',
            'deadline': (now - timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S'),
            'created_by': 'zhangsan',
            'handler': 'lisi',
            'current_role': 'audit',
            'is_overdue': 1
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
            'status': 'sign_complete',
            'room_booking_evidence': '已确认贵宾室',
            'equipment_evidence': '设备已准备',
            'usage_evidence': '使用确认签字'
        }
    ]
    
    for order in sample_orders:
        created_at = now.strftime('%Y-%m-%d %H:%M:%S')
        c.execute('''INSERT INTO meeting_orders 
            (order_no, title, meeting_date, start_time, end_time, room_name, 
             attendees, content, status, current_role, handler, deadline, 
             created_at, updated_at, created_by, room_booking_evidence, 
             equipment_evidence, usage_evidence, is_overdue)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (order['order_no'], order['title'], order['meeting_date'], 
             order['start_time'], order['end_time'], order.get('room_name'),
             order.get('attendees'), order.get('content'), order.get('status', 'pending_sign'),
             order['current_role'], order.get('handler'), order['deadline'],
             created_at, created_at, order['created_by'],
             order.get('room_booking_evidence'), order.get('equipment_evidence'),
             order.get('usage_evidence'), order.get('is_overdue', 0)))
    
    conn.commit()

@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

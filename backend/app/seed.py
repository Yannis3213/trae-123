from datetime import datetime, timedelta
from .database import get_conn
from .constants import (
    Role, OrderStatus, SourceModule, Action, ExceptionCode,
    ROLE_NAMES,
)
from .auth import DEMO_USERS


def seed_data():
    with get_conn() as conn:
        c = conn.cursor()

        c.execute("SELECT COUNT(*) as cnt FROM users")
        if c.fetchone()["cnt"] == 0:
            for key, u in DEMO_USERS.items():
                c.execute(
                    "INSERT INTO users (username, name, role) VALUES (?, ?, ?)",
                    (u["username"], u["name"], u["role"]),
                )

        c.execute("SELECT COUNT(*) as cnt FROM repair_orders")
        if c.fetchone()["cnt"] > 0:
            return

        now = datetime.now()

        orders = [
            {
                "order_no": "WX20260601001",
                "title": "1号楼3单元电梯异响",
                "owner_name": "赵先生",
                "owner_phone": "13800138001",
                "address": "阳光花园1号楼3单元1201",
                "repair_type": "公共设施",
                "description": "电梯运行时有异常金属摩擦声，影响正常使用",
                "status": OrderStatus.ARCHIVED,
                "priority": "high",
                "current_handler": None,
                "current_handler_role": None,
                "deadline": (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"),
                "source_module": SourceModule.OWNER_REPORT,
                "evidence_required": 1,
                "version": 5,
                "created_by": "李管家",
                "created_by_role": Role.REGISTRAR,
                "created_at": (now - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S"),
                "updated_at": (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"),
                "last_opinion": "复核通过，维修已完成，业主满意，同意归档",
                "is_overdue": 0,
                "is_near_deadline": 0,
            },
            {
                "order_no": "WX20260601002",
                "title": "2号楼5层走廊灯不亮",
                "owner_name": "",
                "owner_phone": "",
                "address": "",
                "repair_type": "公共照明",
                "description": "",
                "status": OrderStatus.RETURNED_FOR_CORRECTION,
                "priority": "normal",
                "current_handler": "李管家",
                "current_handler_role": Role.REGISTRAR,
                "deadline": (now - timedelta(hours=12)).strftime("%Y-%m-%d %H:%M:%S"),
                "source_module": SourceModule.DISPATCH,
                "evidence_required": 0,
                "version": 3,
                "created_by": "李管家",
                "created_by_role": Role.REGISTRAR,
                "created_at": (now - timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S"),
                "updated_at": (now - timedelta(hours=6)).strftime("%Y-%m-%d %H:%M:%S"),
                "last_opinion": "信息不全，退回补正：需补充业主信息、地址和报修描述",
                "is_overdue": 1,
                "is_near_deadline": 0,
            },
            {
                "order_no": "WX20260601003",
                "title": "3号楼201室卫生间漏水",
                "owner_name": "孙女士",
                "owner_phone": "13800138003",
                "address": "阳光花园3号楼2单元201",
                "repair_type": "室内维修",
                "description": "卫生间顶部渗水，怀疑是楼上防水问题",
                "status": OrderStatus.IN_PROGRESS,
                "priority": "urgent",
                "current_handler": "王主管",
                "current_handler_role": Role.SUPERVISOR,
                "deadline": (now - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"),
                "source_module": SourceModule.OWNER_REPORT,
                "evidence_required": 0,
                "version": 4,
                "created_by": "李管家",
                "created_by_role": Role.REGISTRAR,
                "created_at": (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"),
                "updated_at": (now - timedelta(hours=5)).strftime("%Y-%m-%d %H:%M:%S"),
                "last_opinion": "已上门检查，确认为楼上301防水问题，正在协调",
                "is_overdue": 1,
                "is_near_deadline": 0,
            },
            {
                "order_no": "WX20260601004",
                "title": "5号楼门禁系统故障",
                "owner_name": "周先生",
                "owner_phone": "13800138004",
                "address": "阳光花园5号楼1单元",
                "repair_type": "安防系统",
                "description": "单元门禁刷卡无反应，指纹识别也失效",
                "status": OrderStatus.VISITED,
                "priority": "high",
                "current_handler": "李管家",
                "current_handler_role": Role.REGISTRAR,
                "deadline": (now + timedelta(hours=12)).strftime("%Y-%m-%d %H:%M:%S"),
                "source_module": SourceModule.REGISTRATION,
                "evidence_required": 1,
                "version": 6,
                "created_by": "李管家",
                "created_by_role": Role.REGISTRAR,
                "created_at": (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"),
                "updated_at": (now - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"),
                "last_opinion": "维修完成，业主回访确认门禁已恢复正常使用",
                "is_overdue": 0,
                "is_near_deadline": 1,
            },
            {
                "order_no": "WX20260601005",
                "title": "地下车库B区照明灯损坏",
                "owner_name": "物业巡查",
                "owner_phone": "4008000000",
                "address": "阳光花园地下车库B区",
                "repair_type": "公共照明",
                "description": "B区3-5号车位上方灯管闪烁后熄灭",
                "status": OrderStatus.PENDING_DISPATCH,
                "priority": "normal",
                "current_handler": "李管家",
                "current_handler_role": Role.REGISTRAR,
                "deadline": (now + timedelta(hours=36)).strftime("%Y-%m-%d %H:%M:%S"),
                "source_module": SourceModule.DISPATCH,
                "evidence_required": 0,
                "version": 1,
                "created_by": "李管家",
                "created_by_role": Role.REGISTRAR,
                "created_at": (now - timedelta(hours=8)).strftime("%Y-%m-%d %H:%M:%S"),
                "updated_at": (now - timedelta(hours=8)).strftime("%Y-%m-%d %H:%M:%S"),
                "last_opinion": None,
                "is_overdue": 0,
                "is_near_deadline": 0,
            },
            {
                "order_no": "WX20260601006",
                "title": "4号楼1502室窗户密封条老化",
                "owner_name": "吴先生",
                "owner_phone": "13800138006",
                "address": "阳光花园4号楼1502",
                "repair_type": "门窗维修",
                "description": "主卧窗户密封条老化，雨天渗水",
                "status": OrderStatus.REVIEWING,
                "priority": "normal",
                "current_handler": "张经理",
                "current_handler_role": Role.REVIEWER,
                "deadline": (now + timedelta(hours=6)).strftime("%Y-%m-%d %H:%M:%S"),
                "source_module": SourceModule.OWNER_REPORT,
                "evidence_required": 1,
                "version": 7,
                "created_by": "李管家",
                "created_by_role": Role.REGISTRAR,
                "created_at": (now - timedelta(days=4)).strftime("%Y-%m-%d %H:%M:%S"),
                "updated_at": (now - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S"),
                "last_opinion": "已完成维修并回访，申请月底复核归档",
                "is_overdue": 0,
                "is_near_deadline": 1,
            },
            {
                "order_no": "WX20260601007",
                "title": "小区儿童游乐设施螺丝松动",
                "owner_name": "",
                "owner_phone": "",
                "address": "阳光花园中心花园",
                "repair_type": "公共设施",
                "description": "",
                "status": OrderStatus.CORRECTED,
                "priority": "high",
                "current_handler": "李管家",
                "current_handler_role": Role.REGISTRAR,
                "deadline": (now + timedelta(hours=20)).strftime("%Y-%m-%d %H:%M:%S"),
                "source_module": SourceModule.REGISTRATION,
                "evidence_required": 0,
                "version": 2,
                "created_by": "李管家",
                "created_by_role": Role.REGISTRAR,
                "created_at": (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"),
                "updated_at": (now - timedelta(hours=10)).strftime("%Y-%m-%d %H:%M:%S"),
                "last_opinion": "已补正报修描述：滑梯连接处螺丝松动，存在安全隐患",
                "is_overdue": 0,
                "is_near_deadline": 1,
            },
            {
                "order_no": "WX20260601008",
                "title": "6号楼305室空调外机噪音扰民",
                "owner_name": "郑女士",
                "owner_phone": "13800138008",
                "address": "阳光花园6号楼3单元305",
                "repair_type": "协调处理",
                "description": "楼下305室空调外机噪音过大，夜间无法休息",
                "status": OrderStatus.TRANSFERRED,
                "priority": "normal",
                "current_handler": "王主管",
                "current_handler_role": Role.SUPERVISOR,
                "deadline": (now + timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"),
                "source_module": SourceModule.OWNER_REPORT,
                "evidence_required": 0,
                "version": 3,
                "created_by": "李管家",
                "created_by_role": Role.REGISTRAR,
                "created_at": (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"),
                "updated_at": (now - timedelta(hours=4)).strftime("%Y-%m-%d %H:%M:%S"),
                "last_opinion": "已转办至环境协调组处理",
                "is_overdue": 0,
                "is_near_deadline": 0,
            },
        ]

        order_ids = []
        for o in orders:
            cur = c.execute(
                """
                INSERT INTO repair_orders (
                    order_no, title, owner_name, owner_phone, address, repair_type,
                    description, status, priority, current_handler, current_handler_role,
                    deadline, source_module, evidence_required, version, created_by,
                    created_by_role, created_at, updated_at, last_opinion, is_overdue, is_near_deadline
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    o["order_no"], o["title"], o["owner_name"], o["owner_phone"], o["address"],
                    o["repair_type"], o["description"], o["status"], o["priority"],
                    o["current_handler"], o["current_handler_role"], o["deadline"],
                    o["source_module"], o["evidence_required"], o["version"],
                    o["created_by"], o["created_by_role"], o["created_at"], o["updated_at"],
                    o["last_opinion"], o["is_overdue"], o["is_near_deadline"],
                ),
            )
            order_ids.append(cur.lastrowid)

        attachments = [
            {
                "order_idx": 0,
                "file_name": "电梯维修报告.pdf",
                "file_path": "/attachments/elevator_report.pdf",
                "uploaded_by": "王主管",
                "uploaded_by_role": Role.SUPERVISOR,
                "uploaded_at": (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"),
            },
            {
                "order_idx": 0,
                "file_name": "业主签字确认单.jpg",
                "file_path": "/attachments/owner_sign.jpg",
                "uploaded_by": "李管家",
                "uploaded_by_role": Role.REGISTRAR,
                "uploaded_at": (now - timedelta(days=1, hours=2)).strftime("%Y-%m-%d %H:%M:%S"),
            },
            {
                "order_idx": 3,
                "file_name": "门禁维修现场照片.jpg",
                "file_path": "/attachments/access_photo.jpg",
                "uploaded_by": "王主管",
                "uploaded_by_role": Role.SUPERVISOR,
                "uploaded_at": (now - timedelta(hours=6)).strftime("%Y-%m-%d %H:%M:%S"),
            },
        ]

        for a in attachments:
            c.execute(
                """
                INSERT INTO attachments (order_id, file_name, file_path, uploaded_by, uploaded_by_role, uploaded_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (order_ids[a["order_idx"]], a["file_name"], a["file_path"], a["uploaded_by"], a["uploaded_by_role"], a["uploaded_at"]),
            )

        records = [
            {
                "order_idx": 0,
                "action": Action.CREATE, "from_status": None, "to_status": OrderStatus.PENDING_DISPATCH,
                "handler": "李管家", "handler_role": Role.REGISTRAR, "opinion": "业主来电报修，已登记",
                "evidence_provided": 0, "version": 1, "created_at": (now - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S"),
            },
            {
                "order_idx": 0,
                "action": Action.DISPATCH, "from_status": OrderStatus.PENDING_DISPATCH, "to_status": OrderStatus.DISPATCHED,
                "handler": "李管家", "handler_role": Role.REGISTRAR, "opinion": "已派单给维修组王主管",
                "evidence_provided": 0, "version": 2, "created_at": (now - timedelta(days=6)).strftime("%Y-%m-%d %H:%M:%S"),
            },
            {
                "order_idx": 0,
                "action": Action.START_PROCESS, "from_status": OrderStatus.DISPATCHED, "to_status": OrderStatus.IN_PROGRESS,
                "handler": "王主管", "handler_role": Role.SUPERVISOR, "opinion": "已接单，安排工程师上门",
                "evidence_provided": 0, "version": 3, "created_at": (now - timedelta(days=5)).strftime("%Y-%m-%d %H:%M:%S"),
            },
            {
                "order_idx": 0,
                "action": Action.COMPLETE, "from_status": OrderStatus.IN_PROGRESS, "to_status": OrderStatus.COMPLETED,
                "handler": "王主管", "handler_role": Role.SUPERVISOR, "opinion": "电梯钢丝绳已更换，试运行正常",
                "evidence_provided": 1, "version": 4, "created_at": (now - timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S"),
            },
            {
                "order_idx": 0,
                "action": Action.VISIT, "from_status": OrderStatus.COMPLETED, "to_status": OrderStatus.VISITED,
                "handler": "王主管", "handler_role": Role.SUPERVISOR, "opinion": "业主电话回访确认无异常",
                "evidence_provided": 1, "version": 5, "created_at": (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"),
            },
            {
                "order_idx": 1,
                "action": Action.CREATE, "from_status": None, "to_status": OrderStatus.PENDING_DISPATCH,
                "handler": "李管家", "handler_role": Role.REGISTRAR, "opinion": "维修派单录入",
                "evidence_provided": 0, "version": 1, "created_at": (now - timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S"),
            },
            {
                "order_idx": 1,
                "action": Action.DISPATCH, "from_status": OrderStatus.PENDING_DISPATCH, "to_status": OrderStatus.DISPATCHED,
                "handler": "李管家", "handler_role": Role.REGISTRAR, "opinion": "派单给维修组",
                "evidence_provided": 0, "version": 2, "created_at": (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"),
            },
            {
                "order_idx": 1,
                "action": Action.RETURN_FOR_CORRECTION, "from_status": OrderStatus.DISPATCHED, "to_status": OrderStatus.RETURNED_FOR_CORRECTION,
                "handler": "王主管", "handler_role": Role.SUPERVISOR, "opinion": "信息不全，无法定位位置，退回补正",
                "evidence_provided": 0, "version": 3, "created_at": (now - timedelta(hours=6)).strftime("%Y-%m-%d %H:%M:%S"),
            },
            {
                "order_idx": 2,
                "action": Action.CREATE, "from_status": None, "to_status": OrderStatus.PENDING_DISPATCH,
                "handler": "李管家", "handler_role": Role.REGISTRAR, "opinion": "业主紧急报修，漏水严重",
                "evidence_provided": 0, "version": 1, "created_at": (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"),
            },
            {
                "order_idx": 2,
                "action": Action.DISPATCH, "from_status": OrderStatus.PENDING_DISPATCH, "to_status": OrderStatus.DISPATCHED,
                "handler": "李管家", "handler_role": Role.REGISTRAR, "opinion": "紧急派单",
                "evidence_provided": 0, "version": 2, "created_at": (now - timedelta(days=2, hours=1)).strftime("%Y-%m-%d %H:%M:%S"),
            },
            {
                "order_idx": 2,
                "action": Action.START_PROCESS, "from_status": OrderStatus.DISPATCHED, "to_status": OrderStatus.IN_PROGRESS,
                "handler": "王主管", "handler_role": Role.SUPERVISOR, "opinion": "已上门检查，情况复杂需协调楼上",
                "evidence_provided": 0, "version": 4, "created_at": (now - timedelta(hours=5)).strftime("%Y-%m-%d %H:%M:%S"),
            },
        ]

        for r in records:
            c.execute(
                """
                INSERT INTO processing_records (
                    order_id, action, from_status, to_status, handler, handler_role,
                    opinion, evidence_provided, version, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    order_ids[r["order_idx"]], r["action"], r["from_status"], r["to_status"],
                    r["handler"], r["handler_role"], r["opinion"], r["evidence_provided"],
                    r["version"], r["created_at"],
                ),
            )

        exceptions = [
            {
                "order_idx": 1,
                "reason_code": ExceptionCode.MISSING_OWNER_INFO,
                "reason_text": "缺少业主姓名或电话",
                "field_name": "owner_info",
                "detected_by": "王主管",
                "detected_by_role": Role.SUPERVISOR,
                "resolved": 0,
                "created_at": (now - timedelta(hours=6)).strftime("%Y-%m-%d %H:%M:%S"),
            },
            {
                "order_idx": 1,
                "reason_code": ExceptionCode.MISSING_ADDRESS,
                "reason_text": "缺少报修地址",
                "field_name": "address",
                "detected_by": "王主管",
                "detected_by_role": Role.SUPERVISOR,
                "resolved": 0,
                "created_at": (now - timedelta(hours=6)).strftime("%Y-%m-%d %H:%M:%S"),
            },
            {
                "order_idx": 1,
                "reason_code": ExceptionCode.MISSING_DESCRIPTION,
                "reason_text": "缺少报修描述",
                "field_name": "description",
                "detected_by": "王主管",
                "detected_by_role": Role.SUPERVISOR,
                "resolved": 0,
                "created_at": (now - timedelta(hours=6)).strftime("%Y-%m-%d %H:%M:%S"),
            },
            {
                "order_idx": 1,
                "reason_code": ExceptionCode.OVERDUE,
                "reason_text": "工单已超过处理期限",
                "field_name": "deadline",
                "detected_by": "系统",
                "detected_by_role": "system",
                "resolved": 0,
                "created_at": (now - timedelta(hours=12)).strftime("%Y-%m-%d %H:%M:%S"),
            },
            {
                "order_idx": 2,
                "reason_code": ExceptionCode.OVERDUE,
                "reason_text": "工单已超过处理期限，需加快协调",
                "field_name": "deadline",
                "detected_by": "系统",
                "detected_by_role": "system",
                "resolved": 0,
                "created_at": (now - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"),
            },
            {
                "order_idx": 6,
                "reason_code": ExceptionCode.MISSING_DESCRIPTION,
                "reason_text": "缺少报修描述",
                "field_name": "description",
                "detected_by": "王主管",
                "detected_by_role": Role.SUPERVISOR,
                "resolved": 1,
                "resolved_by": "李管家",
                "resolved_at": (now - timedelta(hours=10)).strftime("%Y-%m-%d %H:%M:%S"),
                "created_at": (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"),
            },
        ]

        for e in exceptions:
            c.execute(
                """
                INSERT INTO exception_reasons (
                    order_id, reason_code, reason_text, field_name, detected_by,
                    detected_by_role, resolved, resolved_by, resolved_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    order_ids[e["order_idx"]], e["reason_code"], e["reason_text"], e["field_name"],
                    e["detected_by"], e["detected_by_role"], e["resolved"],
                    e.get("resolved_by"), e.get("resolved_at"), e["created_at"],
                ),
            )

        audits = [
            {
                "order_idx": 1,
                "note_type": "exception",
                "content": "异常拦截：检测到缺少业主信息、地址、报修描述，退回补正",
                "operator": "王主管",
                "operator_role": Role.SUPERVISOR,
                "created_at": (now - timedelta(hours=6)).strftime("%Y-%m-%d %H:%M:%S"),
            },
            {
                "order_idx": 1,
                "note_type": "overdue",
                "content": "系统自动标记：工单已逾期12小时，责任处理人李管家",
                "operator": "系统",
                "operator_role": "system",
                "created_at": (now - timedelta(hours=12)).strftime("%Y-%m-%d %H:%M:%S"),
            },
            {
                "order_idx": 2,
                "note_type": "overdue",
                "content": "系统自动标记：工单已逾期，责任处理人王主管",
                "operator": "系统",
                "operator_role": "system",
                "created_at": (now - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"),
            },
            {
                "order_idx": 6,
                "note_type": "correction",
                "content": "补正记录：李管家补充报修描述，异常已解决",
                "operator": "李管家",
                "operator_role": Role.REGISTRAR,
                "created_at": (now - timedelta(hours=10)).strftime("%Y-%m-%d %H:%M:%S"),
            },
        ]

        for a in audits:
            c.execute(
                """
                INSERT INTO audit_notes (order_id, note_type, content, operator, operator_role, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (order_ids[a["order_idx"]], a["note_type"], a["content"], a["operator"], a["operator_role"], a["created_at"]),
            )

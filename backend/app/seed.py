from .database import get_connection

SEED_USERS = [
    {"id": "u1", "name": "企业客服张三", "role": "enterprise_service"},
    {"id": "u2", "name": "工程主管李四", "role": "engineering_supervisor"},
    {"id": "u3", "name": "园区经理王五", "role": "park_manager"},
]

SEED_REPAIR_ORDERS = [
    {
        "id": "ro1",
        "order_no": "RO20250601000001",
        "title": "A栋3楼空调故障",
        "description": "A栋3楼会议室空调无法制冷，温度持续升高，影响正常办公",
        "enterprise_name": "星辰科技有限公司",
        "contact_person": "张三",
        "contact_phone": "13800138001",
        "category": "hvac",
        "urgency": "high",
        "status": "pending_review",
        "current_handler_role": "park_manager",
        "current_handler_id": "",
        "current_handler_name": "",
        "created_by": "u1",
        "created_by_role": "enterprise_service",
        "version": 3,
        "deadline": "2026-12-31 23:59:59",
        "return_reason": None,
        "return_opinion": None,
        "correction_reason": None,
        "last_handler_id": "u2",
        "last_handler_result": "verify",
    },
    {
        "id": "ro2",
        "order_no": "RO20250602000001",
        "title": "B栋电梯异响",
        "description": "B栋2号电梯运行时出现异常响声，存在安全隐患",
        "enterprise_name": "瑞达制造集团",
        "contact_person": "张三",
        "contact_phone": "13800138002",
        "category": "elevator",
        "urgency": "urgent",
        "status": "processing",
        "current_handler_role": "engineering_supervisor",
        "current_handler_id": "u2",
        "current_handler_name": "工程主管李四",
        "created_by": "u1",
        "created_by_role": "enterprise_service",
        "version": 2,
        "deadline": "2026-08-31 23:59:59",
        "return_reason": None,
        "return_opinion": None,
        "correction_reason": None,
        "last_handler_id": "u2",
        "last_handler_result": "process",
    },
    {
        "id": "ro3",
        "order_no": "RO20250603000001",
        "title": "C栋停车场照明损坏",
        "description": "C栋地下停车场B区多盏照明灯损坏，光线昏暗影响通行安全",
        "enterprise_name": "星辰科技有限公司",
        "contact_person": "张三",
        "contact_phone": "13800138003",
        "category": "electrical",
        "urgency": "normal",
        "status": "pending_process",
        "current_handler_role": "engineering_supervisor",
        "current_handler_id": "",
        "current_handler_name": "",
        "created_by": "u1",
        "created_by_role": "enterprise_service",
        "version": 1,
        "deadline": "2024-12-31 23:59:59",
        "return_reason": None,
        "return_opinion": None,
        "correction_reason": None,
        "last_handler_id": "u1",
        "last_handler_result": "submit",
    },
    {
        "id": "ro4",
        "order_no": "RO20250604000001",
        "title": "D栋消防管道漏水",
        "description": "D栋5楼消防管道接口处漏水，已铺设临时接水容器但需尽快维修",
        "enterprise_name": "恒盛商贸有限公司",
        "contact_person": "张三",
        "contact_phone": "13800138004",
        "category": "plumbing",
        "urgency": "urgent",
        "status": "returned",
        "current_handler_role": "enterprise_service",
        "current_handler_id": "u1",
        "current_handler_name": "企业客服张三",
        "created_by": "u1",
        "created_by_role": "enterprise_service",
        "version": 3,
        "deadline": "2026-07-31 23:59:59",
        "return_reason": "描述不清晰",
        "return_opinion": "请补充漏水具体位置和影响范围",
        "correction_reason": None,
        "last_handler_id": "u2",
        "last_handler_result": "return",
    },
    {
        "id": "ro5",
        "order_no": "RO20250605000001",
        "title": "E栋门禁系统故障",
        "description": "E栋正门门禁系统无法识别门禁卡，需刷多次才能开门",
        "enterprise_name": "星辰科技有限公司",
        "contact_person": "张三",
        "contact_phone": "13800138005",
        "category": "fire",
        "urgency": "high",
        "status": "pending_archive",
        "current_handler_role": "park_manager",
        "current_handler_id": "u3",
        "current_handler_name": "园区经理王五",
        "created_by": "u1",
        "created_by_role": "enterprise_service",
        "version": 4,
        "deadline": "2026-09-30 23:59:59",
        "return_reason": None,
        "return_opinion": None,
        "correction_reason": None,
        "last_handler_id": "u3",
        "last_handler_result": "review",
    },
    {
        "id": "ro6",
        "order_no": "RO20250606000001",
        "title": "F栋屋顶防水层破损",
        "description": "F栋顶层屋顶防水层多处破损，雨天严重漏水影响办公",
        "enterprise_name": "瑞达制造集团",
        "contact_person": "张三",
        "contact_phone": "13800138006",
        "category": "decoration",
        "urgency": "high",
        "status": "pending_submit",
        "current_handler_role": "enterprise_service",
        "current_handler_id": "u1",
        "current_handler_name": "企业客服张三",
        "created_by": "u1",
        "created_by_role": "enterprise_service",
        "version": 1,
        "deadline": "2026-10-31 23:59:59",
        "return_reason": None,
        "return_opinion": None,
        "correction_reason": None,
        "last_handler_id": None,
        "last_handler_result": None,
    },
]

SEED_PROCESSING_RECORDS = [
    {
        "id": "pr1",
        "repair_id": "ro1",
        "action": "submit",
        "handler_id": "u1",
        "handler_name": "企业客服张三",
        "handler_role": "enterprise_service",
        "from_status": "pending_submit",
        "to_status": "pending_process",
        "opinion": "提交报修工单",
    },
    {
        "id": "pr2",
        "repair_id": "ro1",
        "action": "process",
        "handler_id": "u2",
        "handler_name": "工程主管李四",
        "handler_role": "engineering_supervisor",
        "from_status": "pending_process",
        "to_status": "processing",
        "opinion": "受理工单，安排维修人员",
    },
    {
        "id": "pr3",
        "repair_id": "ro1",
        "action": "verify",
        "handler_id": "u2",
        "handler_name": "工程主管李四",
        "handler_role": "engineering_supervisor",
        "from_status": "processing",
        "to_status": "pending_review",
        "opinion": "核验通过，已修复空调故障",
    },
    {
        "id": "pr4",
        "repair_id": "ro2",
        "action": "submit",
        "handler_id": "u1",
        "handler_name": "企业客服张三",
        "handler_role": "enterprise_service",
        "from_status": "pending_submit",
        "to_status": "pending_process",
        "opinion": "提交报修工单",
    },
    {
        "id": "pr5",
        "repair_id": "ro2",
        "action": "process",
        "handler_id": "u2",
        "handler_name": "工程主管李四",
        "handler_role": "engineering_supervisor",
        "from_status": "pending_process",
        "to_status": "processing",
        "opinion": "受理工单，联系电梯维保公司",
    },
    {
        "id": "pr6",
        "repair_id": "ro3",
        "action": "submit",
        "handler_id": "u1",
        "handler_name": "企业客服张三",
        "handler_role": "enterprise_service",
        "from_status": "pending_submit",
        "to_status": "pending_process",
        "opinion": "提交报修工单",
    },
    {
        "id": "pr7",
        "repair_id": "ro4",
        "action": "submit",
        "handler_id": "u1",
        "handler_name": "企业客服张三",
        "handler_role": "enterprise_service",
        "from_status": "pending_submit",
        "to_status": "pending_process",
        "opinion": "提交报修工单",
    },
    {
        "id": "pr8",
        "repair_id": "ro4",
        "action": "process",
        "handler_id": "u2",
        "handler_name": "工程主管李四",
        "handler_role": "engineering_supervisor",
        "from_status": "pending_process",
        "to_status": "processing",
        "opinion": "受理工单",
    },
    {
        "id": "pr9",
        "repair_id": "ro4",
        "action": "return",
        "handler_id": "u2",
        "handler_name": "工程主管李四",
        "handler_role": "engineering_supervisor",
        "from_status": "processing",
        "to_status": "returned",
        "opinion": "请补充漏水具体位置和影响范围",
    },
    {
        "id": "pr10",
        "repair_id": "ro5",
        "action": "submit",
        "handler_id": "u1",
        "handler_name": "企业客服张三",
        "handler_role": "enterprise_service",
        "from_status": "pending_submit",
        "to_status": "pending_process",
        "opinion": "提交报修工单",
    },
    {
        "id": "pr11",
        "repair_id": "ro5",
        "action": "process",
        "handler_id": "u2",
        "handler_name": "工程主管李四",
        "handler_role": "engineering_supervisor",
        "from_status": "pending_process",
        "to_status": "processing",
        "opinion": "受理工单，安排门禁检修",
    },
    {
        "id": "pr12",
        "repair_id": "ro5",
        "action": "verify",
        "handler_id": "u2",
        "handler_name": "工程主管李四",
        "handler_role": "engineering_supervisor",
        "from_status": "processing",
        "to_status": "pending_review",
        "opinion": "核验通过，门禁已修复",
    },
    {
        "id": "pr13",
        "repair_id": "ro5",
        "action": "review",
        "handler_id": "u3",
        "handler_name": "园区经理王五",
        "handler_role": "park_manager",
        "from_status": "pending_review",
        "to_status": "pending_archive",
        "opinion": "复核通过",
    },
]

SEED_ATTACHMENTS = [
    {
        "id": "att1",
        "repair_id": "ro1",
        "file_name": "空调故障照片.jpg",
        "file_path": "uploads/ro1/空调故障照片.jpg",
        "file_size": 204800,
        "uploaded_by": "u2",
    },
    {
        "id": "att2",
        "repair_id": "ro1",
        "file_name": "空调维修报告.pdf",
        "file_path": "uploads/ro1/空调维修报告.pdf",
        "file_size": 524288,
        "uploaded_by": "u2",
    },
    {
        "id": "att3",
        "repair_id": "ro5",
        "file_name": "门禁故障截图.png",
        "file_path": "uploads/ro5/门禁故障截图.png",
        "file_size": 102400,
        "uploaded_by": "u2",
    },
    {
        "id": "att4",
        "repair_id": "ro5",
        "file_name": "门禁维修记录.pdf",
        "file_path": "uploads/ro5/门禁维修记录.pdf",
        "file_size": 314572,
        "uploaded_by": "u2",
    },
    {
        "id": "att5",
        "repair_id": "ro5",
        "file_name": "复核确认书.pdf",
        "file_path": "uploads/ro5/复核确认书.pdf",
        "file_size": 204800,
        "uploaded_by": "u3",
    },
]

SEED_AUDIT_NOTES = [
    {
        "id": "an1",
        "repair_id": "ro1",
        "note_type": "verification",
        "content": "空调故障已修复，经现场测试制冷功能恢复正常",
        "created_by": "u2",
        "created_by_role": "engineering_supervisor",
    },
    {
        "id": "an2",
        "repair_id": "ro4",
        "note_type": "return",
        "content": "工单描述不够详细，需要补充具体漏水位置",
        "created_by": "u2",
        "created_by_role": "engineering_supervisor",
    },
]

SEED_EXCEPTION_REASONS = [
    {
        "id": "ex1",
        "repair_id": "ro3",
        "exception_type": "timeout",
        "reason": "工单已超过处理期限",
        "detail": "该工单截止日期为2024-12-31，至今未完成处理，已超时",
        "resolved": 0,
        "resolved_at": None,
    },
]


def seed_data():
    conn = get_connection()
    try:
        cursor = conn.cursor()
        existing = cursor.execute("SELECT COUNT(*) as cnt FROM users").fetchone()
        if existing["cnt"] > 0:
            return

        for user in SEED_USERS:
            cursor.execute(
                "INSERT OR IGNORE INTO users (id, name, role) VALUES (?, ?, ?)",
                (user["id"], user["name"], user["role"]),
            )

        for order in SEED_REPAIR_ORDERS:
            cursor.execute(
                """INSERT OR IGNORE INTO repair_orders
                (id, order_no, title, description, enterprise_name, contact_person,
                 contact_phone, category, urgency, status, current_handler_role,
                 current_handler_id, current_handler_name, created_by, created_by_role,
                 version, deadline, return_reason, return_opinion, correction_reason,
                 last_handler_id, last_handler_result)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    order["id"], order["order_no"], order["title"], order["description"],
                    order["enterprise_name"], order["contact_person"], order["contact_phone"],
                    order["category"], order["urgency"], order["status"],
                    order["current_handler_role"], order["current_handler_id"],
                    order["current_handler_name"], order["created_by"], order["created_by_role"],
                    order["version"], order["deadline"], order["return_reason"],
                    order["return_opinion"], order["correction_reason"],
                    order["last_handler_id"], order["last_handler_result"],
                ),
            )

        for record in SEED_PROCESSING_RECORDS:
            cursor.execute(
                """INSERT OR IGNORE INTO processing_records
                (id, repair_id, action, handler_id, handler_name, handler_role,
                 from_status, to_status, opinion)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    record["id"], record["repair_id"], record["action"],
                    record["handler_id"], record["handler_name"], record["handler_role"],
                    record["from_status"], record["to_status"], record["opinion"],
                ),
            )

        for attachment in SEED_ATTACHMENTS:
            cursor.execute(
                """INSERT OR IGNORE INTO attachments
                (id, repair_id, file_name, file_path, file_size, uploaded_by)
                VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    attachment["id"], attachment["repair_id"], attachment["file_name"],
                    attachment["file_path"], attachment["file_size"], attachment["uploaded_by"],
                ),
            )

        for note in SEED_AUDIT_NOTES:
            cursor.execute(
                """INSERT OR IGNORE INTO audit_notes
                (id, repair_id, note_type, content, created_by, created_by_role)
                VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    note["id"], note["repair_id"], note["note_type"],
                    note["content"], note["created_by"], note["created_by_role"],
                ),
            )

        for ex in SEED_EXCEPTION_REASONS:
            cursor.execute(
                """INSERT OR IGNORE INTO exception_reasons
                (id, repair_id, exception_type, reason, detail, resolved, resolved_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    ex["id"], ex["repair_id"], ex["exception_type"], ex["reason"],
                    ex["detail"], ex["resolved"], ex["resolved_at"],
                ),
            )

        conn.commit()
    finally:
        conn.close()

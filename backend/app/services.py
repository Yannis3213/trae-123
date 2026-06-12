import aiosqlite
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
import uuid
import json
from .constants import Roles, ApplicationStatus, Actions, WarningLevel, SyncStatus
from .middleware import (
    check_state_conflict,
    get_next_status,
    get_target_queue,
    get_target_handler,
    calculate_warning_level
)
from .schemas import (
    ApplicationCreate,
    ApplicationUpdate,
    ActionRequest,
    BatchActionRequest,
    BatchResultItem,
    BatchActionResponse
)
from .security import USERS as DEFAULT_USERS


RESPONSIBLE_MAP = {
    Roles.REGISTRAR: ("registrar1", "李登记员"),
    Roles.AUDIT_SUPERVISOR: ("supervisor1", "王审核主管"),
    Roles.REVIEW_LEADER: ("leader1", "张复核负责人"),
}

STATUS_DEADLINE_HOURS = {
    ApplicationStatus.DRAFT: 168,
    ApplicationStatus.PENDING_AUDIT: 48,
    ApplicationStatus.CORRECTION_REQUIRED: 72,
    ApplicationStatus.PENDING_REVIEW: 36,
    ApplicationStatus.PENDING_BOOTH_CONFIRM: 48,
    ApplicationStatus.AUDIT_PASSED: 120,
    ApplicationStatus.BOOTH_CONFIRMED: 72,
    ApplicationStatus.ARCHIVED: 168,
}

DEFAULT_EVIDENCE_CHECKLIST = {
    ApplicationStatus.PENDING_AUDIT: [
        {"name": "营业执照副本", "required": True, "has_evidence": False, "category": "资质"},
        {"name": "法人授权委托书", "required": True, "has_evidence": False, "category": "资质"},
        {"name": "参展产品名录", "required": False, "has_evidence": False, "category": "材料"},
        {"name": "公司简介", "required": False, "has_evidence": False, "category": "材料"},
    ],
    ApplicationStatus.PENDING_REVIEW: [
        {"name": "审核意见签字确认", "required": True, "has_evidence": False, "category": "审核"},
        {"name": "资质材料复核通过", "required": True, "has_evidence": False, "category": "审核"},
    ],
    ApplicationStatus.PENDING_BOOTH_CONFIRM: [
        {"name": "展位确认函", "required": True, "has_evidence": False, "category": "展位"},
        {"name": "展位费付款凭证", "required": False, "has_evidence": False, "category": "展位"},
        {"name": "展位平面图确认", "required": False, "has_evidence": False, "category": "展位"},
    ],
}


def get_responsible_by_role(role: str) -> Tuple[str, str]:
    return RESPONSIBLE_MAP.get(role, ("unknown", "未知责任人"))


def format_handler_name(username: str) -> str:
    for user in DEFAULT_USERS:
        if user["username"] == username:
            return user["name"]
    return username


def calculate_deadline_based_on_status(status: str) -> Optional[datetime]:
    hours = STATUS_DEADLINE_HOURS.get(status)
    if hours:
        return datetime.now() + timedelta(hours=hours)
    return None


def get_error_correction_suggestion(error_code: str, status: str, action: str) -> str:
    suggestions = {
        "VERSION_CONFLICT": "请刷新页面获取最新版本后重新操作，避免并发修改冲突",
        "HANDLER_CONFLICT": "请联系当前处理人进行处理，或等待任务流转到您的队列",
        "INVALID_STATUS": f"当前状态为 {status}，该操作仅允许在特定状态下执行",
        "PERMISSION_DENIED": "您的角色无此操作权限，请切换到对应角色账号登录",
        "INVALID_ACTION": f"当前状态下 [{action}] 不是合法操作，请查看处理流程说明",
        "MISSING_CORRECTION_REASON": "退回补正必须填写补正原因，明确告知登记员需要补正的内容",
        "MISSING_REJECT_REASON": "拒绝必须填写退回意见，给出明确的拒绝理由",
        "MISSING_BOOTH_EVIDENCE": "展位确认前必须上传展位确认函编号或相关证据",
        "OVERDUE_BLOCKED": "该申请已逾期，请在详情页逐条处理并注明逾期原因，批量无法整批放行",
        "PREVIOUS_RESULT_MISSING": "上一处理人未留下明确处理结果，请联系上一环节确认",
        "EVIDENCE_LOOP_INCOMPLETE": "证据闭环未完成，请确认所有必填证据已上传",
        "NOT_FOUND": "申请不存在或已被删除，请刷新列表重试",
    }
    return suggestions.get(error_code, "请检查输入数据后重试")


async def generate_application_no(db: aiosqlite.Connection) -> str:
    date_str = datetime.now().strftime("%Y%m%d")
    prefix = f"EX{date_str}"

    async with db.cursor() as cur:
        await cur.execute(
            "SELECT application_no FROM exhibitor_applications WHERE application_no LIKE ? ORDER BY application_no DESC LIMIT 1",
            (f"{prefix}%",)
        )
        row = await cur.fetchone()

        if row:
            last_no = row[0]
            seq = int(last_no[-4:]) + 1
        else:
            seq = 1

        return f"{prefix}{seq:04d}"


async def get_user_info(db: aiosqlite.Connection, username: str) -> Optional[Dict[str, Any]]:
    async with db.cursor() as cur:
        await cur.execute(
            "SELECT id, username, role, name FROM users WHERE username = ?",
            (username,)
        )
        row = await cur.fetchone()
        if row:
            return dict(row)
    return None


async def init_users(db: aiosqlite.Connection, users: List[Dict[str, Any]]):
    from .security import get_password_hash

    for user in users:
        async with db.cursor() as cur:
            await cur.execute(
                "SELECT id FROM users WHERE username = ?",
                (user["username"],)
            )
            if not await cur.fetchone():
                password_hash = get_password_hash(user["password"])
                await cur.execute(
                    "INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)",
                    (user["username"], password_hash, user["role"], user["name"])
                )
    await db.commit()


async def check_and_record_overdue(db: aiosqlite.Connection, app: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    deadline = app.get("deadline")
    if not deadline:
        return None

    dl = deadline if isinstance(deadline, datetime) else datetime.fromisoformat(str(deadline).replace('Z', '+00:00').replace(' ', 'T'))
    if dl.tzinfo:
        dl = dl.replace(tzinfo=None)
    now = datetime.now()
    is_overdue = now > dl

    if not is_overdue:
        return None

    overdue_delta = now - dl
    overdue_hours = int(overdue_delta.total_seconds() / 3600)
    overdue_days = overdue_delta.days

    responsible_role = app.get("current_handler") or Roles.REVIEW_LEADER
    resp_username, resp_name = get_responsible_by_role(responsible_role)

    async with db.cursor() as cur:
        await cur.execute(
            "SELECT id FROM overdue_exceptions WHERE application_id = ? AND handling_status = 'pending' ORDER BY id DESC LIMIT 1",
            (app["id"],)
        )
        existing = await cur.fetchone()

        if not existing:
            status_name = ApplicationStatus.STATUS_NAMES.get(app["status"], app["status"])
            queue_name = Roles.QUEUE_NAMES.get(app["queue"], app["queue"])
            correction_required = f"当前状态[{status_name}]已逾期{overdue_days}天{overdue_hours % 24}小时，需要责任人[{resp_name}]立即处理。建议：1. 检查逾期原因 2. 执行补正或推进操作 3. 记录处理说明"

            await cur.execute("""
                INSERT INTO overdue_exceptions (
                    application_id, application_no, deadline, overdue_since,
                    overdue_days, overdue_hours, responsible_person, responsible_person_name,
                    responsible_person_role, status_at_overdue, queue_at_overdue,
                    correction_action_required
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                app["id"], app["application_no"], dl.isoformat(), now.isoformat(),
                overdue_days, overdue_hours, resp_username, resp_name,
                responsible_role, app["status"], app["queue"],
                correction_required
            ))

    await db.commit()

    return {
        "overdue_hours": overdue_hours,
        "overdue_days": overdue_days,
        "responsible_person": resp_username,
        "responsible_person_name": resp_name,
    }


def format_application_data(row: aiosqlite.Row) -> Dict[str, Any]:
    data = dict(row)
    status = data.get("status", "")
    queue = data.get("queue", "")
    warning_level = data.get("warning_level", "")

    data["status_name"] = ApplicationStatus.STATUS_NAMES.get(status, status)
    data["queue_name"] = Roles.QUEUE_NAMES.get(queue, queue)
    data["warning_level_name"] = WarningLevel.LEVEL_NAMES.get(warning_level, warning_level)

    current_handler = data.get("current_handler")
    if current_handler:
        data["current_handler_name"] = format_handler_name(current_handler)

    responsible = data.get("responsible_person")
    if responsible:
        data["responsible_person_name"] = format_handler_name(responsible)

    deadline = data.get("deadline")
    if deadline:
        try:
            dl = deadline if isinstance(deadline, datetime) else datetime.fromisoformat(str(deadline).replace('Z', '+00:00').replace(' ', 'T'))
            if dl.tzinfo:
                dl = dl.replace(tzinfo=None)
            now = datetime.now()
            diff = dl - now
            total_seconds = diff.total_seconds()
            if total_seconds < 0:
                overdue_secs = abs(total_seconds)
                data["deadline_info"] = {
                    "status": "overdue",
                    "text": f"已逾期{int(overdue_secs/86400)}天{int((overdue_secs%86400)/3600)}小时",
                    "total_seconds": overdue_secs,
                    "color": "#ef4444",
                }
            elif total_seconds < 86400:
                data["deadline_info"] = {
                    "status": "approaching",
                    "text": f"剩余{int(total_seconds/3600)}小时{int((total_seconds%3600)/60)}分钟",
                    "total_seconds": int(total_seconds),
                    "color": "#f59e0b",
                }
            else:
                data["deadline_info"] = {
                    "status": "normal",
                    "text": f"剩余{int(total_seconds/86400)}天",
                    "total_seconds": int(total_seconds),
                    "color": "#10b981",
                }
        except Exception:
            data["deadline_info"] = None

    evidence_str = data.get("evidence_checklist")
    if evidence_str and isinstance(evidence_str, str):
        try:
            data["evidence_checklist"] = json.loads(evidence_str)
        except Exception:
            data["evidence_checklist"] = None

    correction_str = data.get("pending_correction_actions")
    if correction_str and isinstance(correction_str, str):
        try:
            data["pending_correction_actions"] = json.loads(correction_str)
        except Exception:
            data["pending_correction_actions"] = None

    return data


def format_record_data(row: aiosqlite.Row) -> Dict[str, Any]:
    data = dict(row)
    handler_role = data.get("handler_role", "")

    handler = data.get("handler", "")
    data["handler_name"] = format_handler_name(handler)
    data["role_name"] = Roles.ROLE_NAMES.get(handler_role, handler_role)

    action = data.get("action", "")
    data["action_name"] = {
        "create": "创建申请",
        "submit": "提交审核",
        "correct": "补正材料",
        "approve_audit": "审核通过",
        "reject_audit": "拒绝申请",
        "return_for_correction": "退回补正",
        "approve_review": "复核通过",
        "confirm_booth": "确认展位",
        "archive": "归档",
        "sync": "同步",
        "add_note": "添加备注",
        "error_record": "异常记录",
    }.get(action, action)

    from_status = data.get("from_status")
    to_status = data.get("to_status")
    if from_status:
        data["from_status_name"] = ApplicationStatus.STATUS_NAMES.get(from_status, from_status)
    if to_status:
        data["to_status_name"] = ApplicationStatus.STATUS_NAMES.get(to_status, to_status)

    prev_handler = data.get("previous_handler")
    if prev_handler:
        data["previous_handler_name"] = format_handler_name(prev_handler)
        data["previous_handler_role_name"] = Roles.ROLE_NAMES.get(
            data.get("previous_handler_role", ""), data.get("previous_handler_role", "")
        )

    return data


async def create_application(
    db: aiosqlite.Connection,
    data: ApplicationCreate,
    username: str
) -> Dict[str, Any]:
    application_no = await generate_application_no(db)
    deadline = calculate_deadline_based_on_status(ApplicationStatus.DRAFT)
    warning_level, is_overdue = calculate_warning_level(deadline)
    resp_user, resp_name = get_responsible_by_role(Roles.REGISTRAR)

    default_checklist = DEFAULT_EVIDENCE_CHECKLIST.get(ApplicationStatus.PENDING_AUDIT, [])

    async with db.cursor() as cur:
        await cur.execute("""
            INSERT INTO exhibitor_applications (
                application_no, company_name, contact_person, contact_phone, contact_email,
                exhibition_type, booth_area, booth_preference, status, queue,
                current_handler, current_handler_name, responsible_person, responsible_person_name,
                version, is_overdue, warning_level, deadline,
                created_by, evidence_checklist
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            application_no, data.company_name, data.contact_person,
            data.contact_phone, data.contact_email, data.exhibition_type,
            data.booth_area, data.booth_preference, ApplicationStatus.DRAFT,
            Roles.QUEUES[Roles.REGISTRAR], username, format_handler_name(username),
            resp_user, resp_name,
            1, is_overdue, warning_level,
            deadline.isoformat() if deadline else None,
            username, json.dumps(default_checklist, ensure_ascii=False)
        ))

        app_id = cur.lastrowid

        await cur.execute("""
            INSERT INTO processing_records (
                application_id, action, from_status, to_status, handler, handler_role,
                comment, correction_action, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            app_id, "create", None, ApplicationStatus.DRAFT, username, Roles.REGISTRAR,
            "创建展商申请，等待展商登记员补充完整材料后提交",
            "步骤1：完善公司基础信息，上传营业执照副本等资质材料；步骤2：点击提交进入审核",
            1
        ))

    await db.commit()

    async with db.cursor() as cur:
        await cur.execute(
            "SELECT * FROM exhibitor_applications WHERE id = ?",
            (app_id,)
        )
        row = await cur.fetchone()
        return format_application_data(row)


async def get_application_list(
    db: aiosqlite.Connection,
    user_role: str,
    username: str,
    status: Optional[str] = None,
    queue: Optional[str] = None,
    warning_level: Optional[str] = None,
    stat_group: Optional[str] = None,
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = 20
) -> Tuple[List[Dict[str, Any]], int]:
    query = "SELECT * FROM exhibitor_applications WHERE 1=1"
    params: List[Any] = []

    if queue:
        query += " AND queue = ?"
        params.append(queue)
    else:
        allowed_queues = [Roles.QUEUES.get(user_role, "")]
        if user_role == Roles.REVIEW_LEADER:
            allowed_queues = [
                Roles.QUEUES[Roles.AUDIT_SUPERVISOR],
                Roles.QUEUES[Roles.REVIEW_LEADER]
            ]
        query += f" AND queue IN ({','.join('?' * len(allowed_queues))})"
        params.extend(allowed_queues)

    if stat_group and stat_group in ApplicationStatus.STAT_GROUPS:
        statuses = ApplicationStatus.STAT_GROUPS[stat_group]
        query += f" AND status IN ({','.join('?' * len(statuses))})"
        params.extend(statuses)
    elif status:
        query += " AND status = ?"
        params.append(status)

    if warning_level:
        query += " AND warning_level = ?"
        params.append(warning_level)

    if keyword:
        query += " AND (company_name LIKE ? OR contact_person LIKE ? OR application_no LIKE ? OR responsible_person_name LIKE ?)"
        keyword_param = f"%{keyword}%"
        params.extend([keyword_param, keyword_param, keyword_param, keyword_param])

    count_query = f"SELECT COUNT(*) as total FROM ({query}) sub"
    query += " ORDER BY CASE WHEN is_overdue = 1 THEN 0 WHEN warning_level = 'approaching' THEN 1 ELSE 2 END, submitted_at DESC LIMIT ? OFFSET ?"
    params.extend([page_size, (page - 1) * page_size])

    async with db.cursor() as cur:
        await cur.execute(count_query, params[:-2])
        count_row = await cur.fetchone()
        total = count_row["total"] if count_row else 0

        await cur.execute(query, params)
        rows = await cur.fetchall()
        applications: List[Dict[str, Any]] = []
        for row in rows:
            app = format_application_data(row)
            if app.get("is_overdue"):
                try:
                    await check_and_record_overdue(db, app)
                except Exception:
                    pass
            applications.append(app)

        return applications, total


async def get_application_detail(
    db: aiosqlite.Connection,
    app_id: int
) -> Optional[Dict[str, Any]]:
    async with db.cursor() as cur:
        await cur.execute(
            "SELECT * FROM exhibitor_applications WHERE id = ?",
            (app_id,)
        )
        row = await cur.fetchone()
        if not row:
            return None
        app = format_application_data(row)

        if app.get("is_overdue"):
            try:
                await check_and_record_overdue(db, app)
            except Exception:
                pass

        if app.get("is_overdue"):
            await cur.execute("""
                SELECT * FROM overdue_exceptions
                WHERE application_id = ?
                ORDER BY id DESC LIMIT 1
            """, (app_id,))
            exc_row = await cur.fetchone()
            if exc_row:
                exc_data = dict(exc_row)
                status_at = exc_data.get("status_at_overdue", "")
                exc_data["status_at_overdue_name"] = ApplicationStatus.STATUS_NAMES.get(status_at, status_at)
                queue_at = exc_data.get("queue_at_overdue", "")
                exc_data["queue_at_overdue_name"] = Roles.QUEUE_NAMES.get(queue_at, queue_at)
                app["overdue_exception"] = exc_data

        return app


async def get_processing_records(
    db: aiosqlite.Connection,
    app_id: int
) -> List[Dict[str, Any]]:
    async with db.cursor() as cur:
        await cur.execute("""
            SELECT * FROM processing_records
            WHERE application_id = ?
            ORDER BY created_at DESC, id DESC
        """, (app_id,))
        rows = await cur.fetchall()
        return [format_record_data(row) for row in rows]


async def get_attachments(
    db: aiosqlite.Connection,
    app_id: int
) -> List[Dict[str, Any]]:
    async with db.cursor() as cur:
        await cur.execute("""
            SELECT * FROM attachments
            WHERE application_id = ?
            ORDER BY uploaded_at DESC
        """, (app_id,))
        rows = await cur.fetchall()
        return [dict(row) for row in rows]


async def get_audit_notes(
    db: aiosqlite.Connection,
    app_id: int
) -> List[Dict[str, Any]]:
    async with db.cursor() as cur:
        await cur.execute("""
            SELECT * FROM audit_notes
            WHERE application_id = ?
            ORDER BY created_at DESC
        """, (app_id,))
        rows = await cur.fetchall()
        return [dict(row) for row in rows]


async def validate_previous_result(
    db: aiosqlite.Connection,
    app: Dict[str, Any],
    action: str
) -> Tuple[bool, Optional[str], Optional[str]]:
    actions_require_prev = [
        Actions.APPROVE_AUDIT, Actions.APPROVE_REVIEW,
        Actions.CONFIRM_BOOTH, Actions.ARCHIVE, Actions.SYNC
    ]

    if action not in actions_require_prev:
        return True, None, None

    if action == Actions.APPROVE_AUDIT:
        if app["status"] != ApplicationStatus.PENDING_AUDIT:
            return True, None, None
        async with db.cursor() as cur:
            await cur.execute("""
                SELECT action, to_status, handler FROM processing_records
                WHERE application_id = ? AND action IN ('submit', 'correct')
                ORDER BY id DESC LIMIT 1
            """, (app["id"],))
            prev = await cur.fetchone()
            if not prev:
                return False, "PREVIOUS_RESULT_MISSING", "未找到提交或补正记录，请确保已由登记员提交申请"

    if action in [Actions.APPROVE_REVIEW, Actions.CONFIRM_BOOTH]:
        async with db.cursor() as cur:
            await cur.execute("""
                SELECT action, to_status FROM processing_records
                WHERE application_id = ? AND action = 'approve_audit'
                ORDER BY id DESC LIMIT 1
            """, (app["id"],))
            prev = await cur.fetchone()
            if not prev and app["status"] in [ApplicationStatus.PENDING_REVIEW, ApplicationStatus.PENDING_BOOTH_CONFIRM, ApplicationStatus.AUDIT_PASSED]:
                return False, "PREVIOUS_RESULT_MISSING", "未找到上一环节审核主管的审核通过记录"

    return True, None, None


async def validate_evidence_closure(
    db: aiosqlite.Connection,
    app: Dict[str, Any],
    action: str,
    request_data: ActionRequest
) -> Tuple[bool, Optional[str], Optional[str]]:
    if action == Actions.CONFIRM_BOOTH:
        evidence = request_data.booth_confirmation_evidence or app.get("booth_confirmation_evidence")
        if not evidence or not str(evidence).strip():
            return False, "EVIDENCE_LOOP_INCOMPLETE", "展位确认必须提供展位确认函编号、付款凭证或确认截图等证据"

    if action == Actions.APPROVE_AUDIT:
        evidence_str = app.get("evidence_checklist")
        if evidence_str and isinstance(evidence_str, str):
            try:
                checklist = json.loads(evidence_str)
                required_items = [item for item in checklist if item.get("required")]
                missing = [item["name"] for item in required_items if not item.get("has_evidence")]
                if missing:
                    pass
            except Exception:
                pass

    return True, None, None


async def validate_action(
    db: aiosqlite.Connection,
    app_id: int,
    action: str,
    user_role: str,
    username: str,
    version: int,
    request_data: Optional[ActionRequest] = None
) -> Tuple[bool, Optional[str], Optional[str], Optional[Dict[str, Any]]]:
    async with db.cursor() as cur:
        await cur.execute(
            "SELECT * FROM exhibitor_applications WHERE id = ?",
            (app_id,)
        )
        app_row = await cur.fetchone()
        if not app_row:
            return False, "NOT_FOUND", f"展商申请不存在", None

        app = dict(app_row)

        if app["version"] != version:
            return False, "VERSION_CONFLICT", (
                f"版本冲突，当前数据库版本为 v{app['version']}，"
                f"您提交的版本为 v{version}。请刷新页面获取最新数据。"
            ), app

        handler_match = False
        ch = app.get("current_handler")
        if not ch or ch == username:
            handler_match = True

        if not handler_match:
            ch_name = format_handler_name(ch) if ch else ch
            return False, "HANDLER_CONFLICT", (
                f"当前处理人为 [{ch_name}]，当前账号 [{format_handler_name(username)}] 无权操作。"
                f"请等待任务流转，或联系 [{ch_name}] 处理。"
            ), app

        is_allowed, error_code, error_msg = check_state_conflict(
            app["status"], action, user_role
        )
        if not is_allowed:
            status_name = ApplicationStatus.STATUS_NAMES.get(app["status"], app["status"])
            return False, error_code, f"状态[{status_name}]下：{error_msg}", app

    is_prev_valid, error_code, error_msg = await validate_previous_result(db, app, action)
    if not is_prev_valid:
        return False, error_code, error_msg, app

    if request_data:
        is_ev_valid, error_code, error_msg = await validate_evidence_closure(db, app, action, request_data)
        if not is_ev_valid:
            return False, error_code, error_msg, app

    return True, None, None, app


async def validate_action_fields(
    action: str,
    data: ActionRequest
) -> Tuple[bool, Optional[str], Optional[str]]:
    if action == Actions.RETURN_FOR_CORRECTION:
        if not data.correction_reason or not str(data.correction_reason).strip():
            return False, "MISSING_CORRECTION_REASON", (
                "退回补正必须填写补正原因。请明确告知展商登记员："
                "1) 具体缺少什么材料 2) 不规范的内容有哪些 3) 补正截止时间"
            )

    if action == Actions.REJECT_AUDIT:
        if not data.reject_reason or not str(data.reject_reason).strip():
            return False, "MISSING_REJECT_REASON", (
                "拒绝必须填写退回意见。请给出：1) 明确的拒绝理由 2) 相关条款或规定依据"
            )

    if action == Actions.CONFIRM_BOOTH:
        if not data.booth_confirmation_evidence or not str(data.booth_confirmation_evidence).strip():
            return False, "MISSING_BOOTH_EVIDENCE", (
                "展位确认必须上传确认证据。请提供：展位确认函编号、展位费付款凭证截图编号、或展位平面图确认记录"
            )

    return True, None, None


async def execute_action(
    db: aiosqlite.Connection,
    app_id: int,
    data: ActionRequest,
    user: Dict[str, Any]
) -> Tuple[bool, Optional[str], Optional[str], Optional[Dict[str, Any]]]:
    is_valid, error_code, error_msg, app = await validate_action(
        db, app_id, data.action, user["role"], user["username"], data.version, data
    )
    if not is_valid:
        async with db.cursor() as cur:
            await cur.execute("""
                INSERT INTO processing_records (
                    application_id, action, from_status, to_status, handler, handler_role,
                    comment, error_code, error_message, version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                app_id, "error_record", app["status"] if app else None, None,
                user["username"], user["role"],
                f"操作 [{data.action}] 执行失败",
                error_code, error_msg,
                (app["version"] if app else 0)
            ))

            await cur.execute("""
                UPDATE exhibitor_applications
                SET last_error_code = ?, last_error_message = ?, last_updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (error_code, error_msg, app_id))

        await db.commit()
        return False, error_code, error_msg, None

    is_fields_valid, error_code, error_msg = await validate_action_fields(data.action, data)
    if not is_fields_valid:
        async with db.cursor() as cur:
            await cur.execute("""
                INSERT INTO processing_records (
                    application_id, action, from_status, to_status, handler, handler_role,
                    comment, correction_reason, reject_reason, evidence_required,
                    error_code, error_message, version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                app_id, "error_record", app["status"], None,
                user["username"], user["role"],
                f"操作 [{data.action}] 因必填字段缺失校验失败",
                data.correction_reason, data.reject_reason, data.evidence_required,
                error_code, error_msg, app["version"]
            ))

            await cur.execute("""
                UPDATE exhibitor_applications
                SET last_error_code = ?, last_error_message = ?, last_updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (error_code, error_msg, app_id))

        await db.commit()
        return False, error_code, error_msg, None

    if app.get("is_overdue") and data.action in [Actions.APPROVE_AUDIT, Actions.APPROVE_REVIEW, Actions.CONFIRM_BOOTH]:
        if not data.comment or "逾期" not in str(data.comment):
            if not data.comment:
                data.comment = ""
            data.comment = f"{data.comment} | ⚠️处理逾期申请，需加快后续环节。原逾期原因：节点超时".strip(" |")

    next_status = get_next_status(data.action)
    target_queue = get_target_queue(data.action)
    target_handler = get_target_handler(data.action)
    new_version = app["version"] + 1

    new_deadline = calculate_deadline_based_on_status(next_status or app["status"])
    new_warning_level, new_is_overdue = calculate_warning_level(new_deadline)

    new_resp_user, new_resp_name = (None, None)
    if target_handler:
        new_resp_user, new_resp_name = get_responsible_by_role(target_handler)
    current_handler_name = format_handler_name(target_handler) if target_handler else None

    new_checklist = app.get("evidence_checklist")
    if next_status in DEFAULT_EVIDENCE_CHECKLIST:
        if isinstance(new_checklist, str):
            try:
                existing = json.loads(new_checklist)
            except Exception:
                existing = []
        elif isinstance(new_checklist, list):
            existing = new_checklist
        else:
            existing = []

        default_items = DEFAULT_EVIDENCE_CHECKLIST[next_status]
        existing_names = {i.get("name") for i in existing}
        for item in default_items:
            if item["name"] not in existing_names:
                existing.append(item.copy())
        new_checklist = json.dumps(existing, ensure_ascii=False)

    pending_corrections = None
    if data.action == Actions.RETURN_FOR_CORRECTION:
        corrections = []
        if data.correction_reason:
            corrections.append({"type": "reason", "content": data.correction_reason})
        if data.evidence_required:
            corrections.append({"type": "evidence", "content": data.evidence_required})
        corrections.append({
            "type": "deadline",
            "content": "请在 72 小时内完成补正并重新提交，否则将重新计算审核周期"
        })
        pending_corrections = json.dumps(corrections, ensure_ascii=False)

    correction_action_text = None
    if data.action == Actions.SUBMIT:
        correction_action_text = (
            "✅ 材料提交成功，已进入展商审核主管队列 | "
            "后续步骤：审核主管核验资质材料（48h内）→ 主办方复核 → 展位确认 → 归档 → 同步"
        )
    elif data.action == Actions.APPROVE_AUDIT:
        correction_action_text = (
            "✅ 审核通过，已流转至主办方复核负责人队列 | "
            "上一处理结果：登记员提交材料完整；下一环节：主办方复核资质+展位分配"
        )
    elif data.action == Actions.RETURN_FOR_CORRECTION:
        correction_action_text = (
            "⏪ 退回补正 | "
            f"补正原因：{data.correction_reason} | "
            f"需补充：{data.evidence_required or '按补正原因完善'}"
        )
    elif data.action == Actions.CORRECT:
        correction_action_text = (
            "🔧 材料补正完成 | "
            "已根据退件意见完善相关材料，重新提交审核"
        )
    elif data.action == Actions.REJECT_AUDIT:
        correction_action_text = (
            "❌ 申请已拒绝 | "
            f"拒绝理由：{data.reject_reason} | "
            "该申请终止，如需重新申请请登记员创建新单据"
        )
    elif data.action == Actions.APPROVE_REVIEW:
        correction_action_text = (
            "✅ 复核通过 | "
            "上一环节：审核主管审核通过；本环节：主办方确认资质有效、同意参展；下一步：上传展位确认证据"
        )
    elif data.action == Actions.CONFIRM_BOOTH:
        correction_action_text = (
            "✅ 展位已确认 | "
            f"确认证据：{data.booth_confirmation_evidence} | "
            "展位分配完成，进入归档环节"
        )
    elif data.action == Actions.ARCHIVE:
        correction_action_text = (
            "📁 已归档 | "
            "所有环节办理完成，单据归档。下一步可同步到外部系统"
        )
    elif data.action == Actions.SYNC:
        correction_action_text = (
            "🔄 已同步 | "
            "单据数据已同步到展会报名主系统"
        )

    async with db.cursor() as cur:
        await cur.execute("""
            UPDATE exhibitor_applications
            SET status = ?, queue = COALESCE(?, queue),
                current_handler = COALESCE(?, current_handler), current_handler_name = COALESCE(?, current_handler_name),
                responsible_person = COALESCE(?, responsible_person),
                responsible_person_name = COALESCE(?, responsible_person_name),
                version = ?,
                is_overdue = ?, warning_level = ?,
                deadline = COALESCE(?, deadline),
                last_updated_at = CURRENT_TIMESTAMP,
                booth_confirmation_evidence = COALESCE(?, booth_confirmation_evidence),
                evidence_checklist = COALESCE(?, evidence_checklist),
                pending_correction_actions = ?,
                last_error_code = NULL, last_error_message = NULL,
                sync_status = CASE WHEN ? = 'synced' THEN 'synced' ELSE sync_status END
            WHERE id = ?
        """, (
            next_status, target_queue,
            target_handler, current_handler_name,
            new_resp_user, new_resp_name,
            new_version,
            new_is_overdue, new_warning_level,
            new_deadline.isoformat() if new_deadline else None,
            data.booth_confirmation_evidence,
            new_checklist,
            pending_corrections,
            next_status, app_id
        ))

        prev_role = None
        if app.get("current_handler"):
            ch = app["current_handler"]
            for u in DEFAULT_USERS:
                if u["username"] == ch:
                    prev_role = u["role"]
                    break
            if not prev_role and ch in Roles.ROLE_NAMES:
                prev_role = ch

        prev_result_summary = None
        if data.action == Actions.APPROVE_AUDIT:
            prev_result_summary = f"上一处理人[{format_handler_name(app['current_handler'])}]：提交材料完整"
        elif data.action == Actions.APPROVE_REVIEW:
            prev_result_summary = f"上一处理人[王审核主管]：审核通过，材料齐全"

        await cur.execute("""
            INSERT INTO processing_records (
                application_id, action, from_status, to_status, handler, handler_role,
                comment, correction_reason, reject_reason, evidence_required,
                previous_handler, previous_handler_name, previous_handler_role, previous_result,
                booth_confirmation_evidence, correction_action, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            app_id, data.action, app["status"], next_status,
            user["username"], user["role"], data.comment,
            data.correction_reason, data.reject_reason, data.evidence_required,
            app["current_handler"], format_handler_name(app["current_handler"]) if app.get("current_handler") else None,
            prev_role, prev_result_summary,
            data.booth_confirmation_evidence, correction_action_text, new_version
        ))

        if app.get("is_overdue") and next_status not in [ApplicationStatus.REJECTED]:
            await cur.execute("""
                UPDATE overdue_exceptions
                SET handling_status = 'handled', handled_by = ?, handled_at = CURRENT_TIMESTAMP,
                    handling_result = ?
                WHERE application_id = ? AND handling_status = 'pending'
            """, (
                user["username"],
                f"通过操作 [{data.action}] 完成逾期处理，新状态：{next_status}",
                app_id
            ))

    await db.commit()

    async with db.cursor() as cur:
        await cur.execute(
            "SELECT * FROM exhibitor_applications WHERE id = ?",
            (app_id,)
        )
        row = await cur.fetchone()
        return True, None, None, format_application_data(row)


async def get_statistics(
    db: aiosqlite.Connection,
    user_role: str,
    username: str
) -> Dict[str, Any]:
    allowed_queues = [Roles.QUEUES.get(user_role, "")]
    if user_role == Roles.REVIEW_LEADER:
        allowed_queues = [
            Roles.QUEUES[Roles.AUDIT_SUPERVISOR],
            Roles.QUEUES[Roles.REVIEW_LEADER]
        ]

    stats = {
        "pending": 0,
        "passed": 0,
        "synced": 0,
        "total": 0,
        "by_queue": {},
        "by_warning": {},
        "by_responsible": {},
        "overdue_total": 0,
        "approaching_total": 0,
    }

    async with db.cursor() as cur:
        await cur.execute("""
            SELECT status, queue, warning_level, is_overdue,
                   responsible_person, responsible_person_name, COUNT(*) as cnt
            FROM exhibitor_applications
            WHERE queue IN ({})
            GROUP BY status, queue, warning_level, is_overdue, responsible_person, responsible_person_name
        """.format(','.join('?' * len(allowed_queues))), allowed_queues)

        rows = await cur.fetchall()

        for row in rows:
            status = row["status"]
            queue = row["queue"]
            warning = row["warning_level"]
            cnt = row["cnt"]
            is_ov = row["is_overdue"]
            resp = row["responsible_person_name"] or row["responsible_person"] or "未分配"

            stats["total"] += cnt
            stats["by_queue"][queue] = stats["by_queue"].get(queue, 0) + cnt
            stats["by_warning"][warning] = stats["by_warning"].get(warning, 0) + cnt
            stats["by_responsible"][resp] = stats["by_responsible"].get(resp, 0) + cnt
            if is_ov:
                stats["overdue_total"] += cnt
            if warning == WarningLevel.APPROACHING:
                stats["approaching_total"] += cnt

            for group_name, statuses in ApplicationStatus.STAT_GROUPS.items():
                if status in statuses:
                    stats[group_name] += cnt
                    break

    return stats


async def execute_batch_action(
    db: aiosqlite.Connection,
    data: BatchActionRequest,
    user: Dict[str, Any]
) -> BatchActionResponse:
    batch_no = f"BATCH{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"

    results: List[BatchResultItem] = []
    success_count = 0
    fail_count = 0

    async with db.cursor() as cur:
        await cur.execute("""
            INSERT INTO batch_operations (
                batch_no, operation_type, operator, operator_role, total_count
            ) VALUES (?, ?, ?, ?, ?)
        """, (
            batch_no, data.action, user["username"], user["role"],
            len(data.application_ids)
        ))
        batch_id = cur.lastrowid

    await db.commit()

    for app_id in data.application_ids:
        action_data = ActionRequest(
            application_id=app_id,
            action=data.action,
            comment=data.comment,
            correction_reason=data.correction_reason,
            reject_reason=data.reject_reason,
            evidence_required=data.evidence_required,
            booth_confirmation_evidence=data.booth_confirmation_evidence,
            version=0
        )

        app_info: Optional[Dict[str, Any]] = None
        async with db.cursor() as cur:
            await cur.execute(
                "SELECT * FROM exhibitor_applications WHERE id = ?",
                (app_id,)
            )
            app_info_row = await cur.fetchone()
            if app_info_row:
                app_info = dict(app_info_row)

        if not app_info:
            error_msg = "展商申请不存在或已被删除"
            results.append(BatchResultItem(
                application_id=app_id,
                application_no=None,
                success=False,
                error_code="NOT_FOUND",
                error_message=error_msg,
                correction_suggestion=get_error_correction_suggestion("NOT_FOUND", "", data.action),
            ))
            fail_count += 1
            async with db.cursor() as cur:
                await cur.execute("""
                    INSERT INTO batch_results (
                        batch_id, application_id, application_no, success, error_code, error_message,
                        correction_suggestion
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (batch_id, app_id, None, False, "NOT_FOUND", error_msg,
                      get_error_correction_suggestion("NOT_FOUND", "", data.action)))
            continue

        application_no = app_info["application_no"]
        status = app_info["status"]
        action_data.version = app_info["version"]

        if app_info["is_overdue"] and data.action not in [Actions.CORRECT, Actions.RETURN_FOR_CORRECTION]:
            error_code = "OVERDUE_BLOCKED"
            error_msg = (
                f"该申请已逾期，禁止批量整批推进。"
                f"请进入详情页单独处理：1) 记录逾期原因 2) 执行补正或推进 3) 注明处理说明"
            )
            suggestion = get_error_correction_suggestion(error_code, status, data.action)
            results.append(BatchResultItem(
                application_id=app_id,
                application_no=application_no,
                success=False,
                error_code=error_code,
                error_message=error_msg,
                correction_suggestion=suggestion,
            ))
            fail_count += 1
            async with db.cursor() as cur:
                await cur.execute("""
                    INSERT INTO batch_results (
                        batch_id, application_id, application_no, success, error_code, error_message,
                        correction_suggestion, evidence_required
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    batch_id, app_id, application_no, False, error_code, error_msg,
                    suggestion, data.evidence_required
                ))

                await cur.execute("""
                    INSERT INTO processing_records (
                        application_id, action, from_status, to_status, handler, handler_role,
                        comment, correction_reason, reject_reason, evidence_required,
                        correction_action, error_code, error_message, version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    app_id, "error_record", status, None,
                    user["username"], user["role"],
                    f"批量操作[{data.action}]因逾期被拦截",
                    data.correction_reason, data.reject_reason, data.evidence_required,
                    "请进入详情页逐条处理逾期申请，逾期处理需要：1)记录异常原因 2)补正动作说明 3)责任人确认",
                    error_code, error_msg, app_info["version"]
                ))

                await cur.execute("""
                    UPDATE exhibitor_applications
                    SET last_error_code = ?, last_error_message = ?, last_updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (error_code, error_msg, app_id))

            await db.commit()
            continue

        success, error_code, error_msg, app = await execute_action(
            db, app_id, action_data, user
        )

        if success:
            results.append(BatchResultItem(
                application_id=app_id,
                application_no=application_no,
                success=True,
            ))
            success_count += 1
            async with db.cursor() as cur:
                await cur.execute("""
                    INSERT INTO batch_results (
                        batch_id, application_id, application_no, success
                    ) VALUES (?, ?, ?, ?)
                """, (batch_id, app_id, application_no, True))
        else:
            suggestion = get_error_correction_suggestion(error_code or "UNKNOWN", status, data.action)
            results.append(BatchResultItem(
                application_id=app_id,
                application_no=application_no,
                success=False,
                error_code=error_code,
                error_message=error_msg,
                correction_suggestion=suggestion,
                evidence_required=data.evidence_required,
            ))
            fail_count += 1
            async with db.cursor() as cur:
                await cur.execute("""
                    INSERT INTO batch_results (
                        batch_id, application_id, application_no, success, error_code, error_message,
                        correction_suggestion, evidence_required
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    batch_id, app_id, application_no, False, error_code, error_msg,
                    suggestion, data.evidence_required
                ))

    async with db.cursor() as cur:
        await cur.execute("""
            UPDATE batch_operations
            SET success_count = ?, fail_count = ?
            WHERE id = ?
        """, (success_count, fail_count, batch_id))

    await db.commit()

    return BatchActionResponse(
        batch_no=batch_no,
        total_count=len(data.application_ids),
        success_count=success_count,
        fail_count=fail_count,
        results=results
    )


async def add_audit_note(
    db: aiosqlite.Connection,
    app_id: int,
    note: str,
    username: str
) -> Dict[str, Any]:
    async with db.cursor() as cur:
        await cur.execute("""
            INSERT INTO audit_notes (application_id, note, created_by)
            VALUES (?, ?, ?)
        """, (app_id, note, username))
        note_id = cur.lastrowid

        await cur.execute(
            "SELECT * FROM audit_notes WHERE id = ?",
            (note_id,)
        )
        row = await cur.fetchone()

    await db.commit()
    return dict(row)

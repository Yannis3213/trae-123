import aiosqlite
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
import uuid
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


def format_application_data(row: aiosqlite.Row) -> Dict[str, Any]:
    data = dict(row)
    status = data.get("status", "")
    queue = data.get("queue", "")
    warning_level = data.get("warning_level", "")

    data["status_name"] = ApplicationStatus.STATUS_NAMES.get(status, status)
    data["queue_name"] = Roles.QUEUE_NAMES.get(queue, queue)
    data["warning_level_name"] = WarningLevel.LEVEL_NAMES.get(warning_level, warning_level)

    return data


def format_record_data(row: aiosqlite.Row) -> Dict[str, Any]:
    data = dict(row)
    handler_role = data.get("handler_role", "")

    data["handler_name"] = data.get("handler", "")
    data["role_name"] = Roles.ROLE_NAMES.get(handler_role, handler_role)

    return data


async def create_application(
    db: aiosqlite.Connection,
    data: ApplicationCreate,
    username: str
) -> Dict[str, Any]:
    application_no = await generate_application_no(db)
    deadline = datetime.now() + timedelta(days=7)
    warning_level, is_overdue = calculate_warning_level(deadline)

    async with db.cursor() as cur:
        await cur.execute("""
            INSERT INTO exhibitor_applications (
                application_no, company_name, contact_person, contact_phone, contact_email,
                exhibition_type, booth_area, booth_preference, status, queue,
                current_handler, version, is_overdue, warning_level, deadline,
                created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            application_no, data.company_name, data.contact_person,
            data.contact_phone, data.contact_email, data.exhibition_type,
            data.booth_area, data.booth_preference, ApplicationStatus.DRAFT,
            Roles.QUEUES[Roles.REGISTRAR], username, 1, is_overdue,
            warning_level, deadline, username
        ))

        app_id = cur.lastrowid

        await cur.execute("""
            INSERT INTO processing_records (
                application_id, action, from_status, to_status, handler, handler_role,
                comment, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            app_id, "create", None, ApplicationStatus.DRAFT, username, Roles.REGISTRAR,
            "创建展商申请", 1
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
        query += " AND (company_name LIKE ? OR contact_person LIKE ? OR application_no LIKE ?)"
        keyword_param = f"%{keyword}%"
        params.extend([keyword_param, keyword_param, keyword_param])

    count_query = f"SELECT COUNT(*) as total FROM ({query}) sub"
    query += " ORDER BY submitted_at DESC LIMIT ? OFFSET ?"
    params.extend([page_size, (page - 1) * page_size])

    async with db.cursor() as cur:
        await cur.execute(count_query, params[:-2])
        count_row = await cur.fetchone()
        total = count_row["total"] if count_row else 0

        await cur.execute(query, params)
        rows = await cur.fetchall()
        applications = [format_application_data(row) for row in rows]

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
        return format_application_data(row)


async def get_processing_records(
    db: aiosqlite.Connection,
    app_id: int
) -> List[Dict[str, Any]]:
    async with db.cursor() as cur:
        await cur.execute("""
            SELECT * FROM processing_records
            WHERE application_id = ?
            ORDER BY created_at DESC
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


async def validate_action(
    db: aiosqlite.Connection,
    app_id: int,
    action: str,
    user_role: str,
    username: str,
    version: int
) -> Tuple[bool, Optional[str], Optional[str], Optional[Dict[str, Any]]]:
    async with db.cursor() as cur:
        await cur.execute(
            "SELECT * FROM exhibitor_applications WHERE id = ?",
            (app_id,)
        )
        app = await cur.fetchone()
        if not app:
            return False, "NOT_FOUND", f"展商申请不存在", None

        if app["version"] != version:
            return False, "VERSION_CONFLICT", f"版本冲突，当前版本为 {app['version']}，您的版本为 {version}", None

        if app["current_handler"] and app["current_handler"] != username and app["current_handler"] != user_role:
            return False, "HANDLER_CONFLICT", f"当前处理人为 {app['current_handler']}，您无权操作", None

        is_allowed, error_code, error_msg = check_state_conflict(
            app["status"], action, user_role
        )
        if not is_allowed:
            return False, error_code, error_msg, None

        if action == Actions.RETURN_FOR_CORRECTION and not app.get("correction_reason"):
            pass

        return True, None, None, dict(app)


async def validate_action_fields(
    action: str,
    data: ActionRequest
) -> Tuple[bool, Optional[str], Optional[str]]:
    if action == Actions.RETURN_FOR_CORRECTION:
        if not data.correction_reason:
            return False, "MISSING_CORRECTION_REASON", "退回补正必须填写补正原因"

    if action == Actions.REJECT_AUDIT:
        if not data.reject_reason:
            return False, "MISSING_REJECT_REASON", "拒绝必须填写退回意见"

    if action == Actions.CONFIRM_BOOTH:
        if not data.booth_confirmation_evidence:
            return False, "MISSING_BOOTH_EVIDENCE", "展位确认必须上传确认证据"

    return True, None, None


async def execute_action(
    db: aiosqlite.Connection,
    app_id: int,
    data: ActionRequest,
    user: Dict[str, Any]
) -> Tuple[bool, Optional[str], Optional[str], Optional[Dict[str, Any]]]:
    is_valid, error_code, error_msg, app = await validate_action(
        db, app_id, data.action, user["role"], user["username"], data.version
    )
    if not is_valid:
        return False, error_code, error_msg, None

    is_fields_valid, error_code, error_msg = await validate_action_fields(data.action, data)
    if not is_fields_valid:
        return False, error_code, error_msg, None

    next_status = get_next_status(data.action)
    target_queue = get_target_queue(data.action)
    target_handler = get_target_handler(data.action)
    new_version = app["version"] + 1

    async with db.cursor() as cur:
        await cur.execute("""
            UPDATE exhibitor_applications
            SET status = ?, queue = ?, current_handler = ?, version = ?,
                last_updated_at = CURRENT_TIMESTAMP,
                booth_confirmation_evidence = COALESCE(?, booth_confirmation_evidence),
                sync_status = CASE WHEN ? = 'synced' THEN 'synced' ELSE sync_status END
            WHERE id = ?
        """, (
            next_status, target_queue, target_handler, new_version,
            data.booth_confirmation_evidence,
            next_status, app_id
        ))

        await cur.execute("""
            INSERT INTO processing_records (
                application_id, action, from_status, to_status, handler, handler_role,
                comment, correction_reason, reject_reason, evidence_required,
                previous_handler, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            app_id, data.action, app["status"], next_status,
            user["username"], user["role"], data.comment,
            data.correction_reason, data.reject_reason, data.evidence_required,
            app["current_handler"], new_version
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
        "by_warning": {}
    }

    async with db.cursor() as cur:
        await cur.execute("""
            SELECT status, queue, warning_level, COUNT(*) as cnt
            FROM exhibitor_applications
            WHERE queue IN ({})
            GROUP BY status, queue, warning_level
        """.format(','.join('?' * len(allowed_queues))), allowed_queues)

        rows = await cur.fetchall()

        for row in rows:
            status = row["status"]
            queue = row["queue"]
            warning = row["warning_level"]
            cnt = row["cnt"]

            stats["total"] += cnt
            stats["by_queue"][queue] = stats["by_queue"].get(queue, 0) + cnt
            stats["by_warning"][warning] = stats["by_warning"].get(warning, 0) + cnt

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

        async with db.cursor() as cur:
            await cur.execute(
                "SELECT application_no, version FROM exhibitor_applications WHERE id = ?",
                (app_id,)
            )
            app_info = await cur.fetchone()

        if not app_info:
            results.append(BatchResultItem(
                application_id=app_id,
                application_no=None,
                success=False,
                error_code="NOT_FOUND",
                error_message="展商申请不存在"
            ))
            fail_count += 1
            continue

        action_data.version = app_info["version"]

        success, error_code, error_msg, app = await execute_action(
            db, app_id, action_data, user
        )

        if success:
            results.append(BatchResultItem(
                application_id=app_id,
                application_no=app["application_no"],
                success=True
            ))
            success_count += 1
        else:
            results.append(BatchResultItem(
                application_id=app_id,
                application_no=app_info["application_no"],
                success=False,
                error_code=error_code,
                error_message=error_msg
            ))
            fail_count += 1

        async with db.cursor() as cur:
            await cur.execute("""
                INSERT INTO batch_results (
                    batch_id, application_id, success, error_code, error_message
                ) VALUES (?, ?, ?, ?, ?)
            """, (
                batch_id, app_id, success, error_code, error_msg
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

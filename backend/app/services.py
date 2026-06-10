import sqlite3
from datetime import datetime, timedelta
from typing import Optional
from .database import get_conn
from .constants import (
    Role, OrderStatus, Action, ExceptionCode,
    ROLE_ALLOWED_ACTIONS, STATUS_TRANSITIONS, REQUIRED_EVIDENCE_STATUSES,
    STATUS_NAMES, EXCEPTION_NAMES, ACTION_NAMES, ROLE_NAMES,
)


class ValidationError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


def validate_role_action(user: dict, action: Action):
    role = user["role"]
    if action not in ROLE_ALLOWED_ACTIONS.get(role, set()):
        raise ValidationError(
            ExceptionCode.ROLE_VIOLATION,
            f"角色[{ROLE_NAMES.get(role, role)}]无权执行操作[{ACTION_NAMES.get(action, action)}]",
        )


def validate_status_transition(from_status: OrderStatus, to_status: Optional[OrderStatus]):
    if to_status is None or from_status == to_status:
        return
    allowed = STATUS_TRANSITIONS.get(from_status, [])
    if to_status not in allowed:
        raise ValidationError(
            ExceptionCode.INVALID_TRANSITION,
            f"非法状态流转：{STATUS_NAMES.get(from_status, from_status)} → {STATUS_NAMES.get(to_status, to_status)}",
        )


def validate_version(current_version: int, submitted_version: int):
    if current_version != submitted_version:
        raise ValidationError(
            ExceptionCode.VERSION_CONFLICT,
            f"版本冲突：当前版本v{current_version}，提交版本v{submitted_version}，请刷新后重试",
        )


def validate_evidence(order_id: int, to_status: Optional[OrderStatus], conn: sqlite3.Connection,
                       uploaded_attachment_ids: Optional[list[int]] = None):
    if to_status is None:
        return
    if to_status in REQUIRED_EVIDENCE_STATUSES:
        existing_cur = conn.execute(
            "SELECT COUNT(*) as cnt FROM attachments WHERE order_id = ?",
            (order_id,),
        )
        existing_cnt = existing_cur.fetchone()["cnt"]
        new_cnt = len(uploaded_attachment_ids or [])
        total = existing_cnt + new_cnt
        if total == 0:
            raise ValidationError(
                ExceptionCode.MISSING_EVIDENCE,
                f"提交到[{STATUS_NAMES.get(to_status, to_status)}]必须上传真实证据附件（共检测到 0 份）",
            )


def validate_handler(user: dict, order: dict):
    role = user["role"]
    if order["status"] == OrderStatus.ARCHIVED:
        raise ValidationError(
            ExceptionCode.STATUS_CONFLICT,
            "工单已归档，不可再操作",
        )
    current_handler_role = order.get("current_handler_role")
    current_handler = order.get("current_handler")

    if role == Role.REGISTRAR:
        allowed_statuses = [
            OrderStatus.PENDING_DISPATCH,
            OrderStatus.RETURNED_FOR_CORRECTION,
            OrderStatus.CORRECTED,
            OrderStatus.VISITED,
        ]
        if order["status"] not in allowed_statuses:
            raise ValidationError(
                ExceptionCode.ROLE_VIOLATION,
                f"报修登记员不可处理当前[{STATUS_NAMES.get(order['status'])}]状态的工单",
            )

    if role == Role.SUPERVISOR:
        forbidden = [OrderStatus.PENDING_DISPATCH, OrderStatus.RETURNED_FOR_CORRECTION,
                     OrderStatus.CORRECTED, OrderStatus.VISITED, OrderStatus.REVIEWING, OrderStatus.ARCHIVED]
        if order["status"] in forbidden:
            raise ValidationError(
                ExceptionCode.ROLE_VIOLATION,
                f"维修主管不可处理当前[{STATUS_NAMES.get(order['status'])}]状态的工单，请等待登记员派单或提交复核",
            )

    if role == Role.REVIEWER:
        if order["status"] != OrderStatus.REVIEWING:
            raise ValidationError(
                ExceptionCode.ROLE_VIOLATION,
                f"复核负责人仅可处理[复核中]状态工单，当前状态为[{STATUS_NAMES.get(order['status'])}]",
            )


def validate_duplicate_submit(conn: sqlite3.Connection, order_id: int, action: Action,
                              version: int, window_seconds: int = 30):
    threshold = (datetime.now() - timedelta(seconds=window_seconds)).strftime("%Y-%m-%d %H:%M:%S")
    cur = conn.execute(
        """
        SELECT COUNT(*) as cnt FROM processing_records
        WHERE order_id = ? AND action = ? AND version = ? AND created_at >= ?
        """,
        (order_id, action, version, threshold),
    )
    if cur.fetchone()["cnt"] > 0:
        raise ValidationError(
            ExceptionCode.DUPLICATE_SUBMIT,
            f"检测到重复提交：{ACTION_NAMES.get(action, action)} 在 {window_seconds}秒 内已提交过，请不要重复点击",
        )


def validate_all(conn: sqlite3.Connection, user: dict, order: dict, action: Action,
                 submitted_version: int, to_status: Optional[OrderStatus],
                 uploaded_attachment_ids: Optional[list[int]] = None,
                 check_duplicate: bool = True):
    validate_role_action(user, action)
    validate_version(order["version"], submitted_version)
    validate_handler(user, order)
    validate_status_transition(OrderStatus(order["status"]), to_status)
    validate_evidence(order["id"], to_status, conn, uploaded_attachment_ids)
    if check_duplicate:
        validate_duplicate_submit(conn, order["id"], action, submitted_version)


def check_overdue_and_near(conn: sqlite3.Connection):
    now = datetime.now()
    near_threshold = now + timedelta(hours=24)
    conn.execute(
        """
        UPDATE repair_orders
        SET
            is_overdue = CASE WHEN deadline IS NOT NULL AND deadline < ? THEN 1 ELSE 0 END,
            is_near_deadline = CASE WHEN deadline IS NOT NULL AND deadline >= ? AND deadline <= ? THEN 1 ELSE 0 END
        """,
        (now.strftime("%Y-%m-%d %H:%M:%S"), now.strftime("%Y-%m-%d %H:%M:%S"), near_threshold.strftime("%Y-%m-%d %H:%M:%S")),
    )


def add_audit_note(conn: sqlite3.Connection, order_id: int, note_type: str, content: str, operator: str, operator_role: str):
    conn.execute(
        """
        INSERT INTO audit_notes (order_id, note_type, content, operator, operator_role)
        VALUES (?, ?, ?, ?, ?)
        """,
        (order_id, note_type, content, operator, operator_role),
    )


def add_exception(conn: sqlite3.Connection, order_id: int, code: ExceptionCode, text: str, field_name: Optional[str], detected_by: str, detected_by_role: str):
    cur = conn.execute(
        "SELECT COUNT(*) as cnt FROM exception_reasons WHERE order_id = ? AND reason_code = ? AND resolved = 0",
        (order_id, code),
    )
    if cur.fetchone()["cnt"] > 0:
        return
    conn.execute(
        """
        INSERT INTO exception_reasons (order_id, reason_code, reason_text, field_name, detected_by, detected_by_role)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (order_id, code, text, field_name, detected_by, detected_by_role),
    )


def add_processing_record(
    conn: sqlite3.Connection, order_id: int, action: Action,
    from_status: Optional[str], to_status: Optional[str],
    handler: str, handler_role: str, opinion: Optional[str],
    evidence_provided: int, version: int,
    intercept_type: Optional[str] = None,
):
    conn.execute(
        """
        INSERT INTO processing_records (order_id, action, from_status, to_status, handler, handler_role, opinion, evidence_provided, version, intercept_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (order_id, action, from_status, to_status, handler, handler_role, opinion, evidence_provided, version, intercept_type),
    )


def add_attachment(conn: sqlite3.Connection, order_id: int, file_name: str, file_path: str,
                   uploaded_by: str, uploaded_by_role: str,
                   submitted_version: Optional[int] = None,
                   intercept_type: Optional[str] = None) -> int:
    cur = conn.execute(
        """
        INSERT INTO attachments (order_id, file_name, file_path, uploaded_by, uploaded_by_role, submitted_version, intercept_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (order_id, file_name, file_path, uploaded_by, uploaded_by_role, submitted_version, intercept_type),
    )
    return cur.lastrowid


def count_attachments(conn: sqlite3.Connection, order_id: int) -> int:
    cur = conn.execute("SELECT COUNT(*) as cnt FROM attachments WHERE order_id = ?", (order_id,))
    return cur.fetchone()["cnt"]


def detect_field_exceptions(conn: sqlite3.Connection, order_id: int, order: dict, user: dict):
    exceptions = []
    if not order.get("owner_name") or not order.get("owner_phone"):
        exceptions.append((ExceptionCode.MISSING_OWNER_INFO, "缺少业主姓名或电话", "owner_info"))
    if not order.get("address"):
        exceptions.append((ExceptionCode.MISSING_ADDRESS, "缺少报修地址", "address"))
    if not order.get("description"):
        exceptions.append((ExceptionCode.MISSING_DESCRIPTION, "缺少报修描述", "description"))
    for code, text, field in exceptions:
        add_exception(conn, order_id, code, text, field, user["name"], user["role"])
    return exceptions


def resolve_field_exceptions(conn: sqlite3.Connection, order_id: int, order: dict, resolver: dict):
    resolved = []
    if order.get("owner_name") and order.get("owner_phone"):
        conn.execute(
            "UPDATE exception_reasons SET resolved=1, resolved_by=?, resolved_at=? WHERE order_id=? AND reason_code=? AND resolved=0",
            (resolver["name"], datetime.now().strftime("%Y-%m-%d %H:%M:%S"), order_id, ExceptionCode.MISSING_OWNER_INFO),
        )
        resolved.append("业主信息")
    if order.get("address"):
        conn.execute(
            "UPDATE exception_reasons SET resolved=1, resolved_by=?, resolved_at=? WHERE order_id=? AND reason_code=? AND resolved=0",
            (resolver["name"], datetime.now().strftime("%Y-%m-%d %H:%M:%S"), order_id, ExceptionCode.MISSING_ADDRESS),
        )
        resolved.append("地址信息")
    if order.get("description"):
        conn.execute(
            "UPDATE exception_reasons SET resolved=1, resolved_by=?, resolved_at=? WHERE order_id=? AND reason_code=? AND resolved=0",
            (resolver["name"], datetime.now().strftime("%Y-%m-%d %H:%M:%S"), order_id, ExceptionCode.MISSING_DESCRIPTION),
        )
        resolved.append("报修描述")
    return resolved


def action_to_status(action: Action, current_status: OrderStatus) -> Optional[OrderStatus]:
    mapping = {
        Action.DISPATCH: OrderStatus.DISPATCHED,
        Action.START_PROCESS: OrderStatus.IN_PROGRESS,
        Action.TRANSFER: OrderStatus.TRANSFERRED,
        Action.RETURN_FOR_CORRECTION: OrderStatus.RETURNED_FOR_CORRECTION,
        Action.CORRECT: OrderStatus.CORRECTED,
        Action.COMPLETE: OrderStatus.COMPLETED,
        Action.VISIT: OrderStatus.VISITED,
        Action.SUBMIT_REVIEW: OrderStatus.REVIEWING,
        Action.REVIEW_APPROVE: OrderStatus.ARCHIVED,
        Action.REVIEW_REJECT: OrderStatus.RETURNED_FOR_CORRECTION,
        Action.ARCHIVE: OrderStatus.ARCHIVED,
    }
    return mapping.get(action)


def get_next_handler_role(to_status: OrderStatus) -> Optional[Role]:
    if to_status in [OrderStatus.PENDING_DISPATCH, OrderStatus.RETURNED_FOR_CORRECTION, OrderStatus.CORRECTED, OrderStatus.VISITED]:
        return Role.REGISTRAR
    if to_status in [OrderStatus.DISPATCHED, OrderStatus.IN_PROGRESS, OrderStatus.TRANSFERRED, OrderStatus.COMPLETED]:
        return Role.SUPERVISOR
    if to_status == OrderStatus.REVIEWING:
        return Role.REVIEWER
    if to_status == OrderStatus.ARCHIVED:
        return None
    return None

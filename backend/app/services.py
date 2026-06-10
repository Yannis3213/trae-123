import sqlite3
from datetime import datetime, timedelta
from typing import Optional
from .database import get_conn
from .constants import (
    Role, OrderStatus, Action, ExceptionCode,
    ROLE_ALLOWED_ACTIONS, STATUS_TRANSITIONS, REQUIRED_EVIDENCE_STATUSES,
    STATUS_NAMES, EXCEPTION_NAMES, ACTION_NAMES,
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
            f"角色[{role}]无权执行操作[{ACTION_NAMES.get(action, action)}]",
        )


def validate_status_transition(from_status: OrderStatus, to_status: OrderStatus):
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


def validate_evidence(order_id: int, to_status: OrderStatus, has_evidence: bool, conn: sqlite3.Connection):
    if to_status in REQUIRED_EVIDENCE_STATUSES:
        if not has_evidence:
            cur = conn.execute(
                "SELECT COUNT(*) as cnt FROM attachments WHERE order_id = ?",
                (order_id,),
            )
            cnt = cur.fetchone()["cnt"]
            if cnt == 0:
                raise ValidationError(
                    ExceptionCode.MISSING_EVIDENCE,
                    f"状态[{STATUS_NAMES.get(to_status, to_status)}]需要上传证据附件",
                )


def validate_handler(user: dict, order: dict):
    role = user["role"]
    current_handler_role = order.get("current_handler_role")
    if order["status"] == OrderStatus.ARCHIVED:
        raise ValidationError(
            ExceptionCode.STATUS_CONFLICT,
            "工单已归档，不可再操作",
        )
    if role == Role.SUPERVISOR:
        if order["status"] in [OrderStatus.PENDING_DISPATCH, OrderStatus.RETURNED_FOR_CORRECTION, OrderStatus.CORRECTED]:
            raise ValidationError(
                ExceptionCode.ROLE_VIOLATION,
                "当前状态不属于维修主管处理范围，请等待登记员派单",
            )
    if role == Role.REVIEWER:
        if order["status"] != OrderStatus.REVIEWING:
            raise ValidationError(
                ExceptionCode.ROLE_VIOLATION,
                "仅复核中状态可由复核负责人处理",
            )
    if role == Role.REGISTRAR:
        if order["status"] not in [
            OrderStatus.PENDING_DISPATCH,
            OrderStatus.RETURNED_FOR_CORRECTION,
            OrderStatus.CORRECTED,
            OrderStatus.VISITED,
        ]:
            if order["status"] != OrderStatus.VISITED:
                raise ValidationError(
                    ExceptionCode.ROLE_VIOLATION,
                    "当前状态不属于报修登记员处理范围",
                )


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
):
    conn.execute(
        """
        INSERT INTO processing_records (order_id, action, from_status, to_status, handler, handler_role, opinion, evidence_provided, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (order_id, action, from_status, to_status, handler, handler_role, opinion, evidence_provided, version),
    )


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

import uuid
from datetime import datetime, timedelta

from . import repository, validator
from .schemas import (
    STATUS_ACTION_MAP, DISPATCH_STATUS_MAP, CONFIRMATION_STATUS_MAP,
    REPAIR_ORDER_UPDATE_FIELDS,
)


def _generate_id():
    return str(uuid.uuid4())


def _generate_order_no():
    now = datetime.now()
    return f"RO{now.strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"


def _is_overdue(deadline_str):
    try:
        deadline = datetime.fromisoformat(deadline_str)
        return deadline <= datetime.now()
    except (ValueError, TypeError):
        return False


def _create_record(repair_id, action, handler_id, handler_name, handler_role,
                   from_status, to_status, opinion=""):
    repository.create_processing_record({
        "id": _generate_id(),
        "repair_id": repair_id,
        "action": action,
        "handler_id": handler_id,
        "handler_name": handler_name,
        "handler_role": handler_role,
        "from_status": from_status,
        "to_status": to_status,
        "opinion": opinion,
    })


def _get_user_info(user_id):
    user = repository.get_user_by_id(user_id)
    if not user:
        raise validator.ValidationError("用户不存在")
    return user


# ── Users ──

def get_all_users():
    return repository.get_all_users()


def get_user_by_id(user_id):
    return repository.get_user_by_id(user_id)


# ── Repair Orders CRUD ──

def list_repair_orders(status=None, handler_role=None, handler_id=None,
                       created_by=None, keyword=None, deadline_group=None,
                       page=1, page_size=20):
    offset = (page - 1) * page_size
    orders, total = repository.get_repair_orders(
        status=status, handler_role=handler_role, handler_id=handler_id,
        created_by=created_by, keyword=keyword, deadline_group=deadline_group,
        offset=offset, limit=page_size,
    )
    for order in orders:
        order["attachments"] = repository.get_attachments(order["id"])
    return orders, total


def get_repair_order_detail(order_id):
    order = repository.get_repair_order_by_id(order_id)
    if not order:
        raise validator.ValidationError("工单不存在")
    order["attachments"] = repository.get_attachments(order_id)
    order["processing_records"] = repository.get_processing_records(order_id)
    order["audit_notes"] = repository.get_audit_notes(order_id)
    order["exception_reasons"] = repository.get_exception_reasons(order_id)
    return order


def create_repair_order(data):
    validator.validate_role(data.get("created_by_role"))
    user = _get_user_info(data["created_by"])
    order_id = _generate_id()
    order_no = _generate_order_no()
    order_data = {
        "id": order_id,
        "order_no": order_no,
        "title": data["title"],
        "description": data["description"],
        "enterprise_name": data["enterprise_name"],
        "contact_person": data["contact_person"],
        "contact_phone": data["contact_phone"],
        "category": data["category"],
        "urgency": data.get("urgency", "normal"),
        "status": "pending_submit",
        "current_handler_role": "enterprise_service",
        "current_handler_id": data["created_by"],
        "current_handler_name": user["name"],
        "created_by": data["created_by"],
        "created_by_role": data["created_by_role"],
        "version": 1,
        "deadline": data["deadline"],
    }
    repository.create_repair_order(order_data)
    return repository.get_repair_order_by_id(order_id)


def update_repair_order(order_id, data):
    order = repository.get_repair_order_by_id(order_id)
    if not order:
        raise validator.ValidationError("工单不存在")
    validator.validate_update(order, data.get("updated_by", ""), data.get("updated_by_role", ""))
    update_data = {}
    for field in REPAIR_ORDER_UPDATE_FIELDS:
        if field in data:
            update_data[field] = data[field]
    update_data["version"] = order["version"] + 1
    repository.update_repair_order(order_id, update_data)
    return repository.get_repair_order_by_id(order_id)


# ── Status Transitions ──

def submit_repair_order(order_id, data):
    order = repository.get_repair_order_by_id(order_id)
    if not order:
        raise validator.ValidationError("工单不存在")
    handler_role = data.get("handler_role", "enterprise_service")
    validator.validate_action_permission(handler_role, "submit")
    validator.validate_status_transition("submit", order["status"])
    validator.validate_version(order["version"], data.get("version", 0))
    user = _get_user_info(data.get("handler_id", order["created_by"]))
    update_data = {
        "status": "pending_process",
        "current_handler_role": "engineering_supervisor",
        "current_handler_id": "",
        "current_handler_name": "",
        "version": order["version"] + 1,
        "last_handler_id": data.get("handler_id", order["created_by"]),
        "last_handler_result": "submit",
    }
    repository.update_repair_order(order_id, update_data)
    _create_record(order_id, "submit", data.get("handler_id", order["created_by"]),
                   user["name"], handler_role, "pending_submit", "pending_process", "提交报修单")
    return repository.get_repair_order_by_id(order_id)


def process_repair_order(order_id, data):
    order = repository.get_repair_order_by_id(order_id)
    if not order:
        raise validator.ValidationError("工单不存在")
    handler_role = data.get("handler_role", "engineering_supervisor")
    handler_id = data.get("handler_id", "")
    validator.validate_action_permission(handler_role, "process")
    validator.validate_status_transition("process", order["status"])
    validator.validate_handler("process", order, handler_id)
    validator.validate_version(order["version"], data.get("version", 0))
    user = _get_user_info(handler_id)
    update_data = {
        "status": "processing",
        "current_handler_role": "engineering_supervisor",
        "current_handler_id": handler_id,
        "current_handler_name": user["name"],
        "version": order["version"] + 1,
        "last_handler_id": handler_id,
        "last_handler_result": "process",
    }
    repository.update_repair_order(order_id, update_data)
    _create_record(order_id, "process", handler_id, user["name"], handler_role,
                   "pending_process", "processing", data.get("opinion", "受理工单"))
    return repository.get_repair_order_by_id(order_id)


def verify_repair_order(order_id, data):
    order = repository.get_repair_order_by_id(order_id)
    if not order:
        raise validator.ValidationError("工单不存在")
    handler_role = data.get("handler_role", "engineering_supervisor")
    handler_id = data.get("handler_id", "")
    validator.validate_action_permission(handler_role, "verify")
    validator.validate_status_transition("verify", order["status"])
    validator.validate_handler("verify", order, handler_id)
    validator.validate_version(order["version"], data.get("version", 0))
    attachments = repository.get_attachments(order_id)
    validator.validate_evidence(attachments)
    user = _get_user_info(handler_id)
    update_data = {
        "status": "pending_review",
        "current_handler_role": "park_manager",
        "current_handler_id": "",
        "current_handler_name": "",
        "version": order["version"] + 1,
        "last_handler_id": handler_id,
        "last_handler_result": "verify",
    }
    repository.update_repair_order(order_id, update_data)
    _create_record(order_id, "verify", handler_id, user["name"], handler_role,
                   "processing", "pending_review", data.get("opinion", "核验通过"))
    return repository.get_repair_order_by_id(order_id)


def review_repair_order(order_id, data):
    order = repository.get_repair_order_by_id(order_id)
    if not order:
        raise validator.ValidationError("工单不存在")
    handler_role = data.get("handler_role", "park_manager")
    handler_id = data.get("handler_id", "")
    validator.validate_action_permission(handler_role, "review")
    validator.validate_status_transition("review", order["status"])
    validator.validate_handler("review", order, handler_id)
    validator.validate_version(order["version"], data.get("version", 0))
    attachments = repository.get_attachments(order_id)
    validator.validate_evidence(attachments)
    user = _get_user_info(handler_id)
    update_data = {
        "status": "pending_archive",
        "current_handler_role": "park_manager",
        "current_handler_id": handler_id,
        "current_handler_name": user["name"],
        "version": order["version"] + 1,
        "last_handler_id": handler_id,
        "last_handler_result": "review",
    }
    repository.update_repair_order(order_id, update_data)
    _create_record(order_id, "review", handler_id, user["name"], handler_role,
                   "pending_review", "pending_archive", data.get("opinion", "复核通过"))
    return repository.get_repair_order_by_id(order_id)


def archive_repair_order(order_id, data):
    order = repository.get_repair_order_by_id(order_id)
    if not order:
        raise validator.ValidationError("工单不存在")
    handler_role = data.get("handler_role", "park_manager")
    handler_id = data.get("handler_id", "")
    validator.validate_action_permission(handler_role, "archive")
    validator.validate_status_transition("archive", order["status"])
    validator.validate_handler("archive", order, handler_id)
    validator.validate_version(order["version"], data.get("version", 0))
    attachments = repository.get_attachments(order_id)
    validator.validate_evidence(attachments)
    user = _get_user_info(handler_id)
    update_data = {
        "status": "archived",
        "current_handler_role": "park_manager",
        "current_handler_id": handler_id,
        "current_handler_name": user["name"],
        "version": order["version"] + 1,
        "last_handler_id": handler_id,
        "last_handler_result": "archive",
    }
    repository.update_repair_order(order_id, update_data)
    _create_record(order_id, "archive", handler_id, user["name"], handler_role,
                   "pending_archive", "archived", data.get("opinion", "归档"))
    return repository.get_repair_order_by_id(order_id)


def return_repair_order(order_id, data):
    order = repository.get_repair_order_by_id(order_id)
    if not order:
        raise validator.ValidationError("工单不存在")
    handler_role = data.get("handler_role", "")
    handler_id = data.get("handler_id", "")
    return_reason = data.get("return_reason", "")
    return_opinion = data.get("return_opinion", "")
    validator.validate_action_permission(handler_role, "return")
    validator.validate_status_transition("return", order["status"])
    validator.validate_version(order["version"], data.get("version", 0))
    validator.validate_return_reason(return_reason, return_opinion)
    user = _get_user_info(handler_id)
    creator = _get_user_info(order["created_by"])
    new_handler_role = "enterprise_service"
    new_handler_id = order["created_by"]
    new_handler_name = creator["name"]
    update_data = {
        "status": "returned",
        "current_handler_role": new_handler_role,
        "current_handler_id": new_handler_id,
        "current_handler_name": new_handler_name,
        "version": order["version"] + 1,
        "return_reason": return_reason,
        "return_opinion": return_opinion,
        "last_handler_id": handler_id,
        "last_handler_result": "return",
    }
    repository.update_repair_order(order_id, update_data)
    _create_record(order_id, "return", handler_id, user["name"], handler_role,
                   order["status"], "returned", return_opinion)
    return repository.get_repair_order_by_id(order_id)


def resubmit_repair_order(order_id, data):
    order = repository.get_repair_order_by_id(order_id)
    if not order:
        raise validator.ValidationError("工单不存在")
    correction_reason = data.get("correction_reason", "")
    handler_role = data.get("handler_role", "enterprise_service")
    validator.validate_action_permission(handler_role, "resubmit")
    validator.validate_resubmit(order, correction_reason)
    validator.validate_version(order["version"], data.get("version", 0))
    user = _get_user_info(data.get("handler_id", order["created_by"]))
    update_data = {
        "status": "pending_process",
        "current_handler_role": "engineering_supervisor",
        "current_handler_id": "",
        "current_handler_name": "",
        "version": order["version"] + 1,
        "correction_reason": correction_reason,
        "return_reason": None,
        "return_opinion": None,
        "last_handler_id": data.get("handler_id", order["created_by"]),
        "last_handler_result": "resubmit",
    }
    repository.update_repair_order(order_id, update_data)
    _create_record(order_id, "resubmit", data.get("handler_id", order["created_by"]),
                   user["name"], handler_role, "returned", "pending_process", correction_reason)
    return repository.get_repair_order_by_id(order_id)


# ── Batch Operations ──

def batch_advance(items):
    results = []
    for item in items:
        try:
            order = repository.get_repair_order_by_id(item["id"])
            if not order:
                results.append({"id": item["id"], "success": False, "message": "工单不存在"})
                continue
            action = STATUS_ACTION_MAP.get(order["status"])
            if not action:
                results.append({"id": item["id"], "success": False, "message": f"状态 {order['status']} 无法推进"})
                continue
            if _is_overdue(order["deadline"]):
                results.append({"id": item["id"], "success": False, "message": "报修单已逾期，请先补正"})
                continue
            handler_id = item.get("handler_id", "")
            handler_role = item.get("handler_role", "")
            user = repository.get_user_by_id(handler_id)
            handler_name = user["name"] if user else ""
            action_data = {
                "handler_id": handler_id,
                "handler_role": handler_role,
                "handler_name": handler_name,
                "version": item.get("version", order["version"]),
                "opinion": "",
            }
            action_func = _ACTION_FUNCS.get(action)
            if action_func:
                action_func(item["id"], action_data)
                results.append({"id": item["id"], "success": True, "message": "操作成功"})
            else:
                results.append({"id": item["id"], "success": False, "message": f"未知操作: {action}"})
        except validator.ValidationError as e:
            results.append({"id": item["id"], "success": False, "message": e.message})
        except Exception as e:
            results.append({"id": item["id"], "success": False, "message": str(e)})
    return results


def batch_return(items):
    results = []
    for item in items:
        try:
            return_data = {
                "handler_id": item.get("handler_id", ""),
                "handler_role": item.get("handler_role", ""),
                "return_reason": item.get("return_reason", ""),
                "return_opinion": item.get("return_opinion", ""),
                "version": item.get("version", 0),
            }
            return_repair_order(item["id"], return_data)
            results.append({"id": item["id"], "success": True, "message": "退回成功"})
        except validator.ValidationError as e:
            results.append({"id": item["id"], "success": False, "message": e.message})
        except Exception as e:
            results.append({"id": item["id"], "success": False, "message": str(e)})
    return results


_ACTION_FUNCS = {
    "submit": submit_repair_order,
    "process": process_repair_order,
    "verify": verify_repair_order,
    "review": review_repair_order,
    "archive": archive_repair_order,
}


# ── Warnings ──

def get_warnings():
    orders = repository.get_all_non_archived_orders()
    now = datetime.now()
    normal, approaching, overdue = [], [], []
    for order in orders:
        entry = {
            "id": order["id"],
            "order_no": order["order_no"],
            "title": order["title"],
            "deadline": order["deadline"],
            "status": order["status"],
            "current_handler_role": order["current_handler_role"],
            "current_handler_id": order["current_handler_id"],
            "current_handler_name": order["current_handler_name"],
        }
        try:
            deadline = datetime.fromisoformat(order["deadline"])
            if deadline <= now:
                overdue.append(entry)
            elif deadline <= now + timedelta(days=3):
                approaching.append(entry)
            else:
                normal.append(entry)
        except (ValueError, TypeError):
            overdue.append(entry)
    return {"normal": normal, "approaching": approaching, "overdue": overdue}


# ── Ledger ──

def get_ledger(status=None, handler_role=None, keyword=None, page=1, page_size=20):
    offset = (page - 1) * page_size
    orders, total = repository.get_repair_orders(
        status=status, handler_role=handler_role, keyword=keyword,
        offset=offset, limit=page_size,
    )
    for order in orders:
        order["dispatch_status"] = DISPATCH_STATUS_MAP.get(order["status"], "未派单")
        order["confirmation_status"] = CONFIRMATION_STATUS_MAP.get(order["status"], "未确认")
    return orders, total


# ── Attachments ──

def upload_attachment(data):
    attachment_data = {
        "id": _generate_id(),
        "repair_id": data["repair_id"],
        "file_name": data["file_name"],
        "file_path": data["file_path"],
        "file_size": data["file_size"],
        "uploaded_by": data["uploaded_by"],
    }
    repository.create_attachment(attachment_data)
    return attachment_data


def get_attachment_by_id(attachment_id):
    return repository.get_attachment_by_id(attachment_id)


def get_attachments_for_order(repair_id):
    return repository.get_attachments(repair_id)


# ── Processing Records ──

def get_processing_records(repair_id):
    return repository.get_processing_records(repair_id)


# ── Audit Notes ──

def add_audit_note(data):
    note_data = {
        "id": _generate_id(),
        "repair_id": data["repair_id"],
        "note_type": data["note_type"],
        "content": data["content"],
        "created_by": data["created_by"],
        "created_by_role": data["created_by_role"],
    }
    repository.create_audit_note(note_data)
    return note_data


def get_audit_notes_for_order(repair_id):
    return repository.get_audit_notes(repair_id)


# ── Exception Reasons ──

def add_exception_reason(data):
    reason_data = {
        "id": _generate_id(),
        "repair_id": data["repair_id"],
        "exception_type": data["exception_type"],
        "reason": data["reason"],
        "detail": data["detail"],
    }
    repository.create_exception_reason(reason_data)
    return reason_data


def get_exception_reasons_for_order(repair_id):
    return repository.get_exception_reasons(repair_id)

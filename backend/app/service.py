import uuid
from datetime import datetime, timedelta

from . import repository, validator
from .schemas import (
    STATUS_ACTION_MAP, DISPATCH_STATUS_MAP, CONFIRMATION_STATUS_MAP,
    REPAIR_ORDER_UPDATE_FIELDS, CATEGORY_MAP,
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


def _log_exception(repair_id, exception_type, reason, detail):
    exception_data = {
        "id": _generate_id(),
        "repair_id": repair_id,
        "exception_type": exception_type,
        "reason": reason,
        "detail": detail,
        "resolved": 0,
    }
    repository.create_exception_reason(exception_data)


def _classify_exception_type(message):
    if "权限" in message or "无权" in message:
        return "permission_denied"
    if "状态" in message and ("不能" in message or "要求" in message):
        return "status_conflict"
    if "版本冲突" in message:
        return "version_conflict"
    if "缺少佐证" in message or "附件" in message:
        return "missing_evidence"
    if "缺少" in message or "不能为空" in message:
        return "missing_argument"
    return "other"


def _enrich_order_with_computed(order):
    order["attachment_count"] = repository.count_attachments(order["id"])
    order["processing_record_count"] = repository.count_processing_records(order["id"])
    order["dispatch_status"] = DISPATCH_STATUS_MAP.get(order["status"], "未派单")
    order["confirmation_status"] = CONFIRMATION_STATUS_MAP.get(order["status"], "未确认")
    order["category_label"] = CATEGORY_MAP.get(order.get("category", ""), order.get("category", ""))
    return order


def _enriched_get(order_id):
    order = repository.get_repair_order_by_id(order_id)
    if order:
        _enrich_order_with_computed(order)
    return order


# ── Users ──

def get_all_users():
    return repository.get_all_users()


def get_user_by_id(user_id):
    return repository.get_user_by_id(user_id)


# ── Repair Orders CRUD ──

def list_repair_orders(status=None, handler_role=None, handler_id=None,
                       created_by=None, keyword=None, deadline_group=None,
                       category=None, enterprise_name=None,
                       page=1, page_size=20):
    offset = (page - 1) * page_size
    orders, total = repository.get_repair_orders(
        status=status, handler_role=handler_role, handler_id=handler_id,
        created_by=created_by, keyword=keyword, deadline_group=deadline_group,
        category=category, enterprise_name=enterprise_name,
        offset=offset, limit=page_size,
    )
    for order in orders:
        order["attachments"] = repository.get_attachments(order["id"])
        _enrich_order_with_computed(order)
    return orders, total


def get_repair_order_detail(order_id):
    order = repository.get_repair_order_by_id(order_id)
    if not order:
        raise validator.ValidationError("工单不存在")
    order["attachments"] = repository.get_attachments(order_id)
    order["processing_records"] = repository.get_processing_records(order_id)
    order["audit_notes"] = repository.get_audit_notes(order_id)
    order["exception_reasons"] = repository.get_exception_reasons(order_id)
    _enrich_order_with_computed(order)
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
    order = repository.get_repair_order_by_id(order_id)
    _enrich_order_with_computed(order)
    return order


def update_repair_order(order_id, data):
    updated_by = data.get("updated_by", "")
    action = "update"
    try:
        order = repository.get_repair_order_by_id(order_id)
        if not order:
            raise validator.ValidationError("工单不存在")
        user = _get_user_info(updated_by)
        user_role = user["role"]
        validator.validate_update(order, updated_by, user_role)
        update_data = {}
        for field in REPAIR_ORDER_UPDATE_FIELDS:
            if field in data:
                update_data[field] = data[field]
        update_data["version"] = order["version"] + 1
        repository.update_repair_order(order_id, update_data)
        return _enriched_get(order_id)
    except validator.ValidationError as e:
        exc_type = _classify_exception_type(e.message)
        detail = f"action={action}, handler_id={updated_by}"
        _log_exception(order_id, exc_type, e.message, detail)
        raise


def create_and_submit_repair_order(data):
    order = create_repair_order(data)
    submit_data = {
        "handler_id": data["created_by"],
        "version": order["version"],
    }
    return submit_repair_order(order["id"], submit_data)


# ── Status Transitions ──

def submit_repair_order(order_id, data):
    handler_id = data.get("handler_id", "")
    action = "submit"
    try:
        order = repository.get_repair_order_by_id(order_id)
        if not order:
            raise validator.ValidationError("工单不存在")
        user = _get_user_info(handler_id or order["created_by"])
        handler_role = user["role"]
        validator.validate_action_permission(handler_role, action)
        validator.validate_status_transition(action, order["status"])
        validator.validate_version(order["version"], data.get("version", 0))
        actual_handler_id = handler_id or order["created_by"]
        update_data = {
            "status": "pending_process",
            "current_handler_role": "engineering_supervisor",
            "current_handler_id": "",
            "current_handler_name": "",
            "version": order["version"] + 1,
            "last_handler_id": actual_handler_id,
            "last_handler_result": "submit",
        }
        repository.update_repair_order(order_id, update_data)
        _create_record(order_id, action, actual_handler_id,
                       user["name"], handler_role, "pending_submit", "pending_process", "提交报修单")
        return _enriched_get(order_id)
    except validator.ValidationError as e:
        exc_type = _classify_exception_type(e.message)
        detail = f"action={action}, handler_id={handler_id}"
        _log_exception(order_id, exc_type, e.message, detail)
        raise


def process_repair_order(order_id, data):
    handler_id = data.get("handler_id", "")
    action = "process"
    try:
        order = repository.get_repair_order_by_id(order_id)
        if not order:
            raise validator.ValidationError("工单不存在")
        user = _get_user_info(handler_id)
        handler_role = user["role"]
        validator.validate_action_permission(handler_role, action)
        validator.validate_status_transition(action, order["status"])
        validator.validate_handler(action, order, handler_id)
        validator.validate_version(order["version"], data.get("version", 0))
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
        _create_record(order_id, action, handler_id, user["name"], handler_role,
                       "pending_process", "processing", data.get("opinion", "受理工单"))
        return _enriched_get(order_id)
    except validator.ValidationError as e:
        exc_type = _classify_exception_type(e.message)
        detail = f"action={action}, handler_id={handler_id}"
        _log_exception(order_id, exc_type, e.message, detail)
        raise


def verify_repair_order(order_id, data):
    handler_id = data.get("handler_id", "")
    action = "verify"
    try:
        order = repository.get_repair_order_by_id(order_id)
        if not order:
            raise validator.ValidationError("工单不存在")
        user = _get_user_info(handler_id)
        handler_role = user["role"]
        validator.validate_action_permission(handler_role, action)
        validator.validate_status_transition(action, order["status"])
        validator.validate_handler(action, order, handler_id)
        validator.validate_version(order["version"], data.get("version", 0))
        attachments = repository.get_attachments(order_id)
        validator.validate_evidence(attachments)
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
        _create_record(order_id, action, handler_id, user["name"], handler_role,
                       "processing", "pending_review", data.get("opinion", "核验通过"))
        return _enriched_get(order_id)
    except validator.ValidationError as e:
        exc_type = _classify_exception_type(e.message)
        detail = f"action={action}, handler_id={handler_id}"
        _log_exception(order_id, exc_type, e.message, detail)
        raise


def review_repair_order(order_id, data):
    handler_id = data.get("handler_id", "")
    action = "review"
    try:
        order = repository.get_repair_order_by_id(order_id)
        if not order:
            raise validator.ValidationError("工单不存在")
        user = _get_user_info(handler_id)
        handler_role = user["role"]
        validator.validate_action_permission(handler_role, action)
        validator.validate_status_transition(action, order["status"])
        validator.validate_handler(action, order, handler_id)
        validator.validate_version(order["version"], data.get("version", 0))
        attachments = repository.get_attachments(order_id)
        validator.validate_evidence(attachments)
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
        _create_record(order_id, action, handler_id, user["name"], handler_role,
                       "pending_review", "pending_archive", data.get("opinion", "复核通过"))
        return _enriched_get(order_id)
    except validator.ValidationError as e:
        exc_type = _classify_exception_type(e.message)
        detail = f"action={action}, handler_id={handler_id}"
        _log_exception(order_id, exc_type, e.message, detail)
        raise


def archive_repair_order(order_id, data):
    handler_id = data.get("handler_id", "")
    action = "archive"
    try:
        order = repository.get_repair_order_by_id(order_id)
        if not order:
            raise validator.ValidationError("工单不存在")
        user = _get_user_info(handler_id)
        handler_role = user["role"]
        validator.validate_action_permission(handler_role, action)
        validator.validate_status_transition(action, order["status"])
        validator.validate_handler(action, order, handler_id)
        validator.validate_version(order["version"], data.get("version", 0))
        attachments = repository.get_attachments(order_id)
        validator.validate_evidence(attachments)
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
        _create_record(order_id, action, handler_id, user["name"], handler_role,
                       "pending_archive", "archived", data.get("opinion", "归档"))
        return _enriched_get(order_id)
    except validator.ValidationError as e:
        exc_type = _classify_exception_type(e.message)
        detail = f"action={action}, handler_id={handler_id}"
        _log_exception(order_id, exc_type, e.message, detail)
        raise


def return_repair_order(order_id, data):
    handler_id = data.get("handler_id", "")
    action = "return"
    try:
        order = repository.get_repair_order_by_id(order_id)
        if not order:
            raise validator.ValidationError("工单不存在")
        user = _get_user_info(handler_id)
        handler_role = user["role"]
        return_reason = data.get("return_reason", "")
        return_opinion = data.get("return_opinion", "")
        validator.validate_action_permission(handler_role, action)
        validator.validate_status_transition(action, order["status"])
        validator.validate_version(order["version"], data.get("version", 0))
        validator.validate_return_reason(return_reason, return_opinion)
        creator = _get_user_info(order["created_by"])
        new_handler_role = "enterprise_service"
        new_handler_id = order["created_by"]
        new_handler_name = creator["name"]
        from_status = order["status"]
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
        _create_record(order_id, action, handler_id, user["name"], handler_role,
                       from_status, "returned", return_opinion)
        return _enriched_get(order_id)
    except validator.ValidationError as e:
        exc_type = _classify_exception_type(e.message)
        detail = f"action={action}, handler_id={handler_id}"
        _log_exception(order_id, exc_type, e.message, detail)
        raise


def resubmit_repair_order(order_id, data):
    handler_id = data.get("handler_id", "")
    action = "resubmit"
    try:
        order = repository.get_repair_order_by_id(order_id)
        if not order:
            raise validator.ValidationError("工单不存在")
        correction_reason = data.get("correction_reason", "")
        user = _get_user_info(handler_id or order["created_by"])
        handler_role = user["role"]
        validator.validate_action_permission(handler_role, action)
        validator.validate_resubmit(order, correction_reason)
        validator.validate_version(order["version"], data.get("version", 0))
        actual_handler_id = handler_id or order["created_by"]
        update_data = {
            "status": "pending_process",
            "current_handler_role": "engineering_supervisor",
            "current_handler_id": "",
            "current_handler_name": "",
            "version": order["version"] + 1,
            "correction_reason": correction_reason,
            "return_reason": None,
            "return_opinion": None,
            "last_handler_id": actual_handler_id,
            "last_handler_result": "resubmit",
        }
        repository.update_repair_order(order_id, update_data)
        _create_record(order_id, action, actual_handler_id,
                       user["name"], handler_role, "returned", "pending_process", correction_reason)
        return _enriched_get(order_id)
    except validator.ValidationError as e:
        exc_type = _classify_exception_type(e.message)
        detail = f"action={action}, handler_id={handler_id}"
        _log_exception(order_id, exc_type, e.message, detail)
        raise


# ── Batch Operations ──

def batch_advance(items):
    results = []
    for item in items:
        repair_id = item.get("id", "")
        try:
            order = repository.get_repair_order_by_id(repair_id)
            if not order:
                results.append({"id": repair_id, "success": False, "message": "工单不存在"})
                continue
            action = STATUS_ACTION_MAP.get(order["status"])
            if not action:
                msg = f"状态 {order['status']} 无法推进"
                _log_exception(repair_id, "status_conflict", msg, f"action=batch_advance, handler_id={item.get('handler_id', '')}")
                results.append({"id": repair_id, "success": False, "message": msg})
                continue
            if _is_overdue(order["deadline"]):
                msg = "报修单已逾期，请先补正"
                _log_exception(repair_id, "other", msg, f"action=batch_advance, handler_id={item.get('handler_id', '')}")
                results.append({"id": repair_id, "success": False, "message": msg})
                continue
            handler_id = item.get("handler_id", "")
            action_data = {
                "handler_id": handler_id,
                "version": item.get("version", order["version"]),
                "opinion": "",
            }
            action_func = _ACTION_FUNCS.get(action)
            if action_func:
                action_func(repair_id, action_data)
                results.append({"id": repair_id, "success": True, "message": "操作成功"})
            else:
                msg = f"未知操作: {action}"
                _log_exception(repair_id, "other", msg, f"action=batch_advance, handler_id={handler_id}")
                results.append({"id": repair_id, "success": False, "message": msg})
        except validator.ValidationError as e:
            results.append({"id": repair_id, "success": False, "message": e.message})
        except Exception as e:
            results.append({"id": repair_id, "success": False, "message": str(e)})
    return results


def batch_return(items):
    results = []
    for item in items:
        repair_id = item.get("id", "")
        try:
            return_data = {
                "handler_id": item.get("handler_id", ""),
                "return_reason": item.get("return_reason", ""),
                "return_opinion": item.get("return_opinion", ""),
                "version": item.get("version", 0),
            }
            return_repair_order(repair_id, return_data)
            results.append({"id": repair_id, "success": True, "message": "退回成功"})
        except validator.ValidationError as e:
            results.append({"id": repair_id, "success": False, "message": e.message})
        except Exception as e:
            results.append({"id": repair_id, "success": False, "message": str(e)})
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
            "enterprise_name": order.get("enterprise_name", ""),
            "category": order.get("category", ""),
        }
        _enrich_order_with_computed(entry)
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

def get_ledger(status=None, handler_role=None, keyword=None,
               deadline_group=None, category=None, enterprise_name=None,
               page=1, page_size=20):
    offset = (page - 1) * page_size
    orders, total = repository.get_repair_orders(
        status=status, handler_role=handler_role, keyword=keyword,
        deadline_group=deadline_group,
        category=category, enterprise_name=enterprise_name,
        offset=offset, limit=page_size,
    )
    for order in orders:
        _enrich_order_with_computed(order)
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

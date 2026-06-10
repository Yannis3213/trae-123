import json
from datetime import datetime
from typing import Optional
from .db import get_connection
from .workflow import (
    check_role_access,
    check_status_transition,
    check_handler_match,
    check_version,
    check_evidence,
    check_customer_complete,
    check_pricing_complete,
    check_deadline,
    check_deadline_not_overdue,
    next_stage_after,
    next_stage_and_status,
    WorkflowException,
)
from .schemas import (
    ProcessAction,
    BatchProcessRequest,
    BatchProcessResult,
    ContractCreate,
)


def row_to_dict(row) -> dict:
    return {k: row[k] for k in row.keys()} if row else {}


def get_handler_for_stage(conn, stage: str, prefer_user_id: Optional[int] = None) -> Optional[int]:
    role_stage_map = {
        "customer_manager": "customer_manager",
        "trade_specialist": "trade_specialist",
        "risk_manager": "risk_manager",
    }
    role = role_stage_map.get(stage)
    if not role:
        return None
    if prefer_user_id:
        row = conn.execute(
            "SELECT id FROM users WHERE id = ? AND role = ? LIMIT 1",
            (prefer_user_id, role),
        ).fetchone()
        if row:
            return row["id"]
    row = conn.execute(
        "SELECT id FROM users WHERE role = ? ORDER BY id LIMIT 1",
        (role,),
    ).fetchone()
    return row["id"] if row else None


def log_exception(conn, contract_id: int, exc: WorkflowException, stage: str, triggered_by: int):
    conn.execute(
        "INSERT INTO exception_records (contract_id, exception_type, exception_code, message, detail_json, stage, triggered_by) VALUES (?,?,?,?,?,?,?)",
        (
            contract_id,
            exc.exc_type,
            exc.code,
            str(exc),
            json.dumps(exc.detail, ensure_ascii=False),
            stage,
            triggered_by,
        ),
    )


def persist_exception(contract_id: int, exc: WorkflowException, stage: str, triggered_by: int):
    with get_connection() as conn:
        log_exception(conn, contract_id, exc, stage, triggered_by)


def _validate_process(conn, contract: dict, action: ProcessAction, user: dict) -> tuple[str, str, str, int, Optional[int]]:
    stage_ = contract["current_stage"]

    check_role_access(user["role"], contract["current_stage"], action.action)

    if action.action not in ("return", "reject"):
        check_handler_match(user["id"], contract.get("current_handler_id"))

    check_version(action.version, contract["version"])

    from_status, to_status = check_status_transition(contract["status"], action.action)

    check_evidence(stage_, action.action, action.evidence)

    if action.customer_patch and not contract.get("customer_id"):
        raise WorkflowException("合同未关联用电客户，无法补正", "E_NO_CUSTOMER", "材料问题")

    effective_pricing_id = action.pricing_id if action.pricing_id else contract.get("pricing_id")
    if action.pricing_patch and not effective_pricing_id:
        raise WorkflowException("合同未关联报价测算，无法补正报价字段", "E_NO_PRICING", "材料问题")

    merged_customer = {**(contract.get("customer") or {}), **(action.customer_patch or {})}
    merged_pricing = None
    if effective_pricing_id:
        pricing_data = get_pricing(conn, effective_pricing_id)
        if pricing_data:
            merged_pricing = {**pricing_data, **(action.pricing_patch or {})}

    missing_customer = check_customer_complete(merged_customer)
    missing_pricing = check_pricing_complete(merged_pricing)
    if action.action in ("submit", "resubmit") and (missing_customer or missing_pricing):
        all_missing = {}
        if missing_customer:
            all_missing["customer"] = missing_customer
        if missing_pricing:
            all_missing["pricing"] = missing_pricing
        raise WorkflowException(
            "提交前请补全：用电客户/报价测算缺项",
            "E_MISSING_MATERIAL",
            "材料问题",
            all_missing,
        )

    if action.action in ("approve",) and user.get("role") != "trade_specialist":
        raise WorkflowException(
            "进入下一步前确认交易专员是否已处理：当前用户不是交易专员",
            "E_TRADE_UNHANDLED",
            "权限问题",
        )

    if action.action in ("finalize",) and user.get("role") != "risk_manager":
        raise WorkflowException(
            "风控经理需具备复核权限：当前角色不具备",
            "E_RISK_NO_PERMISSION",
            "权限问题",
        )

    if action.action in ("submit", "resubmit", "approve", "finalize"):
        check_deadline_not_overdue(contract["deadline"], strict=False)

    new_stage, to_status = next_stage_and_status(action.action, contract["status"])
    new_version = contract["version"] + 1
    next_handler_id = get_handler_for_stage(conn, new_stage, prefer_user_id=user["id"])

    if action.action in ("reject", "return") and contract.get("previous_handler_id"):
        row = conn.execute(
            "SELECT id, role FROM users WHERE id = ?",
            (contract["previous_handler_id"],),
        ).fetchone()
        if row and row["role"] == new_stage:
            next_handler_id = row["id"]

    return stage_, from_status, to_status, new_version, next_handler_id


def get_current_user(conn, user_id: int) -> Optional[dict]:
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return row_to_dict(row) if row else None


def get_user_by_username(conn, username: str) -> Optional[dict]:
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    return row_to_dict(row) if row else None


def list_customers(conn, keyword: str = ""):
    sql = "SELECT * FROM customers"
    params: list = []
    if keyword:
        sql += " WHERE customer_name LIKE ? OR customer_code LIKE ?"
        like = f"%{keyword}%"
        params = [like, like]
    sql += " ORDER BY id DESC"
    return [row_to_dict(r) for r in conn.execute(sql, params).fetchall()]


def get_customer(conn, customer_id: int) -> Optional[dict]:
    row = conn.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
    return row_to_dict(row) if row else None


def update_customer(conn, customer_id: int, patch: dict) -> Optional[dict]:
    if not patch:
        return get_customer(conn, customer_id)
    fields = []
    values = []
    for k, v in patch.items():
        if k == "id":
            continue
        fields.append(f"{k} = ?")
        values.append(v)
    values.append(customer_id)
    conn.execute(f"UPDATE customers SET {', '.join(fields)} WHERE id = ?", values)
    return get_customer(conn, customer_id)


def list_pricing(conn, keyword: str = ""):
    sql = "SELECT p.*, c.customer_name FROM pricing_calculations p LEFT JOIN customers c ON c.id = p.customer_id"
    params: list = []
    if keyword:
        sql += " WHERE p.calculation_code LIKE ?"
        params.append(f"%{keyword}%")
    sql += " ORDER BY p.id DESC"
    return [row_to_dict(r) for r in conn.execute(sql, params).fetchall()]


def get_pricing(conn, pricing_id: int) -> Optional[dict]:
    row = conn.execute("SELECT * FROM pricing_calculations WHERE id = ?", (pricing_id,)).fetchone()
    return row_to_dict(row) if row else None


def update_pricing(conn, pricing_id: int, patch: dict) -> Optional[dict]:
    if not patch:
        return get_pricing(conn, pricing_id)
    fields = []
    values = []
    for k, v in patch.items():
        if k == "id":
            continue
        fields.append(f"{k} = ?")
        values.append(v)
    values.append(pricing_id)
    conn.execute(f"UPDATE pricing_calculations SET {', '.join(fields)} WHERE id = ?", values)
    return get_pricing(conn, pricing_id)


def _build_contract_base(row) -> dict:
    d = row_to_dict(row)
    level, days = check_deadline(d.get("deadline", ""))
    d["warning_level"] = level
    d["overdue_days"] = days if level == "overdue" else None
    return d


def list_contracts(
    conn,
    status: str = "",
    stage: str = "",
    warning_level: str = "",
    keyword: str = "",
    current_user_id: Optional[int] = None,
):
    sql = """
        SELECT s.*, c.customer_name
        FROM sale_contracts s
        LEFT JOIN customers c ON c.id = s.customer_id
        WHERE 1=1
    """
    params: list = []
    if status:
        sql += " AND s.status = ?"
        params.append(status)
    if stage:
        sql += " AND s.current_stage = ?"
        params.append(stage)
    if keyword:
        sql += " AND (s.contract_no LIKE ? OR s.contract_name LIKE ? OR c.customer_name LIKE ?)"
        like = f"%{keyword}%"
        params.extend([like, like, like])
    if current_user_id:
        sql += " AND (s.current_handler_id = ? OR s.current_handler_id IS NULL)"
        params.append(current_user_id)
    sql += " ORDER BY s.updated_at DESC"
    rows = conn.execute(sql, params).fetchall()
    items = [_build_contract_base(r) for r in rows]
    if warning_level:
        items = [i for i in items if i.get("warning_level") == warning_level]
    return items


def get_contract(conn, contract_id: int) -> Optional[dict]:
    row = conn.execute(
        """
        SELECT s.*, c.customer_name
        FROM sale_contracts s
        LEFT JOIN customers c ON c.id = s.customer_id
        WHERE s.id = ?
        """,
        (contract_id,),
    ).fetchone()
    if not row:
        return None
    d = _build_contract_base(row)
    d["customer"] = get_customer(conn, d["customer_id"])
    d["pricing"] = get_pricing(conn, d["pricing_id"]) if d.get("pricing_id") else None
    d["attachments"] = [
        row_to_dict(r)
        for r in conn.execute(
            """
            SELECT a.*, u.real_name AS uploaded_by_name
            FROM attachments a LEFT JOIN users u ON u.id = a.uploaded_by
            WHERE a.contract_id = ? ORDER BY a.id
            """,
            (contract_id,),
        ).fetchall()
    ]
    d["records"] = [
        row_to_dict(r)
        for r in conn.execute(
            "SELECT * FROM processing_records WHERE contract_id = ? ORDER BY id DESC",
            (contract_id,),
        ).fetchall()
    ]
    d["audit_notes"] = [
        row_to_dict(r)
        for r in conn.execute(
            "SELECT * FROM audit_notes WHERE contract_id = ? ORDER BY id DESC",
            (contract_id,),
        ).fetchall()
    ]
    d["exceptions"] = [
        row_to_dict(r)
        for r in conn.execute(
            "SELECT * FROM exception_records WHERE contract_id = ? ORDER BY id DESC",
            (contract_id,),
        ).fetchall()
    ]
    missing = {}
    if d["customer"]:
        cm = check_customer_complete(d["customer"])
        if cm:
            missing["customer"] = cm
    pm = check_pricing_complete(d["pricing"])
    if pm:
        missing["pricing"] = pm
    d["missing_fields"] = missing
    return d


def create_contract(conn, data: ContractCreate, created_by: int) -> dict:
    import random
    contract_no = f"HT{datetime.now().strftime('%Y%m%d')}{random.randint(1000,9999)}"
    cur = conn.execute(
        """
        INSERT INTO sale_contracts
        (contract_no, contract_name, customer_id, pricing_id, contract_amount,
         term_start_date, term_end_date, sign_date, deadline, current_stage, status,
         version, current_handler_id, created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            contract_no,
            data.contract_name,
            data.customer_id,
            data.pricing_id,
            data.contract_amount,
            data.term_start_date,
            data.term_end_date,
            data.sign_date,
            data.deadline,
            "customer_manager",
            "待提交",
            1,
            created_by,
            created_by,
        ),
    )
    cid = cur.lastrowid
    return get_contract(conn, cid)


def process_contract(conn, action: ProcessAction, user: dict) -> dict:
    contract = get_contract(conn, action.contract_id)
    if not contract:
        raise WorkflowException(f"合同单不存在：id={action.contract_id}", "E_NOT_FOUND", "状态问题")

    stage_ = contract["current_stage"]
    try:
        stage_, from_status, to_status, new_version, next_handler_id = _validate_process(
            conn, contract, action, user
        )
    except WorkflowException as e:
        persist_exception(contract["id"], e, stage_, user["id"])
        raise

    new_stage = next_stage_after(action.action, to_status)

    if action.customer_patch and contract.get("customer_id"):
        update_customer(conn, contract["customer_id"], action.customer_patch)

    effective_pricing_id = action.pricing_id if action.pricing_id else contract.get("pricing_id")

    if effective_pricing_id and action.pricing_patch:
        update_pricing(conn, effective_pricing_id, action.pricing_patch)

    if action.pricing_id and not contract.get("pricing_id"):
        conn.execute(
            "UPDATE sale_contracts SET pricing_id = ? WHERE id = ?",
            (action.pricing_id, contract["id"]),
        )

    conn.execute(
        """
        UPDATE sale_contracts
        SET status = ?, current_stage = ?, version = ?,
            previous_handler_id = current_handler_id,
            previous_opinion = ?,
            audit_remark = COALESCE(?, audit_remark),
            current_handler_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (
            to_status,
            new_stage,
            new_version,
            action.opinion or "",
            action.audit_remark,
            None if new_stage in ("completed", "closed") else next_handler_id,
            contract["id"],
        ),
    )

    if action.audit_remark:
        conn.execute(
            "INSERT INTO audit_notes (contract_id, note, noted_by, noted_by_name) VALUES (?,?,?,?)",
            (contract["id"], action.audit_remark, user["id"], user["real_name"]),
        )

    conn.execute(
        """
        INSERT INTO processing_records
        (contract_id, stage, action, from_status, to_status, handler_id, handler_name,
         handler_role, opinion, evidence_json, version)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            contract["id"],
            stage_,
            action.action,
            from_status,
            to_status,
            user["id"],
            user["real_name"],
            user["role"],
            action.opinion,
            json.dumps(action.evidence or {}, ensure_ascii=False),
            new_version,
        ),
    )

    return get_contract(conn, contract["id"])


def batch_process(conn, req: BatchProcessRequest, user: dict) -> list[BatchProcessResult]:
    results: list[BatchProcessResult] = []
    for item in req.items:
        row = conn.execute(
            "SELECT id, contract_no, status, current_stage, version, current_handler_id FROM sale_contracts WHERE id = ?",
            (item.contract_id,),
        ).fetchone()
        if not row:
            results.append(BatchProcessResult(
                contract_id=item.contract_id,
                contract_no="N/A",
                success=False,
                reason="合同单不存在",
            ))
            continue
        try:
            inner = ProcessAction(
                contract_id=item.contract_id,
                action=req.action,
                version=item.version,
                opinion=req.opinion,
                evidence=req.evidence,
            )
            processed = process_contract(conn, inner, user)
            results.append(BatchProcessResult(
                contract_id=item.contract_id,
                contract_no=processed["contract_no"],
                success=True,
                reason=f"{row['status']} -> {processed['status']}",
            ))
        except WorkflowException as e:
            results.append(BatchProcessResult(
                contract_id=item.contract_id,
                contract_no=row["contract_no"],
                success=False,
                reason=f"[{e.exc_type}|{e.code}] {e}",
            ))
        except Exception as e:
            results.append(BatchProcessResult(
                contract_id=item.contract_id,
                contract_no=row["contract_no"],
                success=False,
                reason=f"[系统错误] {e}",
            ))
    return results


def get_overdue_responsibles(conn):
    overdue = [
        r for r in conn.execute(
            """
            SELECT s.*, c.customer_name, u.real_name AS handler_name, u.role
            FROM sale_contracts s
            LEFT JOIN customers c ON c.id = s.customer_id
            LEFT JOIN users u ON u.id = s.current_handler_id
            WHERE s.status NOT IN ('已完成')
            """
        ).fetchall()
    ]
    result = []
    for r in overdue:
        d = _build_contract_base(r)
        if d.get("warning_level") in ("warning", "overdue"):
            d["customer_name"] = r["customer_name"]
            d["handler_name"] = r["handler_name"]
            d["handler_role"] = r["role"]
            result.append(d)
    result.sort(key=lambda x: (x.get("warning_level") != "overdue", -(x.get("overdue_days") or 0)))
    return result


def list_attachments(conn, contract_id: int):
    return [
        row_to_dict(r)
        for r in conn.execute(
            """
            SELECT a.*, u.real_name AS uploaded_by_name
            FROM attachments a LEFT JOIN users u ON u.id = a.uploaded_by
            WHERE a.contract_id = ? ORDER BY a.id DESC
            """,
            (contract_id,),
        ).fetchall()
    ]


def add_attachment(conn, contract_id: int, file_name: str, file_type: str, file_size: int, user: dict):
    c = conn.execute(
        "SELECT current_stage FROM sale_contracts WHERE id = ?",
        (contract_id,),
    ).fetchone()
    stage = c["current_stage"] if c else None
    conn.execute(
        """
        INSERT INTO attachments (contract_id, file_name, file_type, file_size, uploaded_by, stage)
        VALUES (?,?,?,?,?,?)
        """,
        (contract_id, file_name, file_type, file_size, user["id"], stage),
    )
    return list_attachments(conn, contract_id)

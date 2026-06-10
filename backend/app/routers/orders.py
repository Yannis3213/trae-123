from datetime import datetime
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route, Mount
from starlette.endpoints import HTTPEndpoint
from ..database import get_conn
from ..schemas import (
    OrderCreate, OrderUpdate, OrderAction, BatchAction,
    OrderOut, ProcessingRecordOut, AttachmentOut,
    AuditNoteOut, ExceptionReasonOut, BatchResult, BatchResultItem,
)
from ..constants import (
    Role, OrderStatus, Action, SourceModule, ExceptionCode,
    STATUS_NAMES, ACTION_NAMES, ROLE_NAMES, SOURCE_MODULE_NAMES,
    STATUS_LIST_GROUPS, EXCEPTION_NAMES,
)
from ..services import (
    ValidationError, validate_role_action, validate_status_transition,
    validate_version, validate_evidence, validate_handler,
    check_overdue_and_near, add_audit_note, add_exception,
    add_processing_record, detect_field_exceptions, action_to_status,
    get_next_handler_role,
)
from ..auth import DEMO_USERS
import json


async def list_orders(request: Request):
    user = request.state.user
    role = user["role"]
    params = request.query_params
    status_filter = params.get("status")
    source_filter = params.get("source_module")
    group_filter = params.get("group")
    search = params.get("search", "")

    with get_conn() as conn:
        check_overdue_and_near(conn)
        sql = "SELECT * FROM repair_orders WHERE 1=1"
        args = []

        if role == Role.REGISTRAR:
            sql += " AND status IN ('pending_dispatch','returned_for_correction','corrected','visited')"
        elif role == Role.SUPERVISOR:
            sql += " AND status IN ('dispatched','in_progress','transferred','completed')"
        elif role == Role.REVIEWER:
            sql += " AND status IN ('reviewing','archived')"

        if group_filter and group_filter in STATUS_LIST_GROUPS:
            placeholders = ",".join(["?"] * len(STATUS_LIST_GROUPS[group_filter]))
            sql += f" AND status IN ({placeholders})"
            args.extend([s.value for s in STATUS_LIST_GROUPS[group_filter]])

        if status_filter:
            sql += " AND status = ?"
            args.append(status_filter)

        if source_filter:
            sql += " AND source_module = ?"
            args.append(source_filter)

        if search:
            sql += " AND (title LIKE ? OR order_no LIKE ? OR owner_name LIKE ?)"
            like = f"%{search}%"
            args.extend([like, like, like])

        sql += " ORDER BY is_overdue DESC, is_near_deadline DESC, created_at DESC"
        cur = conn.execute(sql, args)
        rows = cur.fetchall()
        orders = [dict(r) for r in rows]

        stat_sql = "SELECT status, COUNT(*) as cnt FROM repair_orders WHERE 1=1"
        stat_args = []
        if role == Role.REGISTRAR:
            stat_sql += " AND status IN ('pending_dispatch','returned_for_correction','corrected','visited')"
        elif role == Role.SUPERVISOR:
            stat_sql += " AND status IN ('dispatched','in_progress','transferred','completed')"
        elif role == Role.REVIEWER:
            stat_sql += " AND status IN ('reviewing','archived')"
        stat_sql += " GROUP BY status"
        stat_rows = conn.execute(stat_sql, stat_args).fetchall()

        stats = {"待分派": 0, "已转办": 0, "已回访": 0, "正常": 0, "临期": 0, "逾期": 0}
        for sr in stat_rows:
            s = sr["status"]
            for g_name, g_statuses in STATUS_LIST_GROUPS.items():
                if s in [st.value for st in g_statuses]:
                    stats[g_name] += sr["cnt"]

        for o in orders:
            if o["is_overdue"]:
                stats["逾期"] += 1
            elif o["is_near_deadline"]:
                stats["临期"] += 1
            else:
                stats["正常"] += 1

    return JSONResponse({
        "orders": orders,
        "stats": stats,
        "constants": {
            "statuses": STATUS_NAMES,
            "actions": ACTION_NAMES,
            "roles": ROLE_NAMES,
            "sources": SOURCE_MODULE_NAMES,
            "exceptions": EXCEPTION_NAMES,
        },
    })


async def get_order(request: Request):
    order_id = int(request.path_params["order_id"])
    with get_conn() as conn:
        check_overdue_and_near(conn)
        row = conn.execute("SELECT * FROM repair_orders WHERE id = ?", (order_id,)).fetchone()
        if not row:
            return JSONResponse({"detail": "工单不存在"}, status_code=404)
        order = dict(row)

        records = [dict(r) for r in conn.execute(
            "SELECT * FROM processing_records WHERE order_id = ? ORDER BY created_at DESC, id DESC",
            (order_id,),
        ).fetchall()]

        attachments = [dict(r) for r in conn.execute(
            "SELECT * FROM attachments WHERE order_id = ? ORDER BY created_at DESC",
            (order_id,),
        ).fetchall()]

        audits = [dict(r) for r in conn.execute(
            "SELECT * FROM audit_notes WHERE order_id = ? ORDER BY created_at DESC",
            (order_id,),
        ).fetchall()]

        exceptions = [dict(r) for r in conn.execute(
            "SELECT * FROM exception_reasons WHERE order_id = ? ORDER BY created_at DESC",
            (order_id,),
        ).fetchall()]

    return JSONResponse({
        "order": order,
        "records": records,
        "attachments": attachments,
        "audits": audits,
        "exceptions": exceptions,
    })


async def create_order(request: Request):
    user = request.state.user
    body = await request.json()
    data = OrderCreate(**body)

    with get_conn() as conn:
        check_overdue_and_near(conn)
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        order_no = f"WX{datetime.now().strftime('%Y%m%d%H%M%S')}"

        cur = conn.execute(
            """
            INSERT INTO repair_orders (
                order_no, title, owner_name, owner_phone, address, repair_type,
                description, status, priority, source_module, deadline,
                current_handler, current_handler_role, created_by, created_by_role,
                version, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                order_no, data.title, data.owner_name, data.owner_phone, data.address,
                data.repair_type, data.description, OrderStatus.PENDING_DISPATCH,
                data.priority, data.source_module, data.deadline,
                user["name"], Role.REGISTRAR,
                user["name"], user["role"], 1, now_str, now_str,
            ),
        )
        order_id = cur.lastrowid

        add_processing_record(
            conn, order_id, Action.CREATE, None, OrderStatus.PENDING_DISPATCH,
            user["name"], user["role"], "创建工单", 0, 1,
        )

        exceptions = detect_field_exceptions(conn, order_id, {
            "owner_name": data.owner_name,
            "owner_phone": data.owner_phone,
            "address": data.address,
            "description": data.description,
        }, user)
        if exceptions:
            msgs = "; ".join([e[1] for e in exceptions])
            add_audit_note(conn, order_id, "exception", f"创建时检测异常：{msgs}", user["name"], user["role"])

        row = conn.execute("SELECT * FROM repair_orders WHERE id = ?", (order_id,)).fetchone()

    return JSONResponse({"order": dict(row)}, status_code=201)


async def update_order(request: Request):
    order_id = int(request.path_params["order_id"])
    user = request.state.user
    body = await request.json()
    data = OrderUpdate(**body)

    with get_conn() as conn:
        check_overdue_and_near(conn)
        row = conn.execute("SELECT * FROM repair_orders WHERE id = ?", (order_id,)).fetchone()
        if not row:
            return JSONResponse({"detail": "工单不存在"}, status_code=404)
        order = dict(row)

        if order["status"] in [OrderStatus.ARCHIVED]:
            return JSONResponse({"detail": "已归档工单不可修改"}, status_code=400)

        new_data = {
            "title": data.title if data.title is not None else order["title"],
            "owner_name": data.owner_name if data.owner_name is not None else order["owner_name"],
            "owner_phone": data.owner_phone if data.owner_phone is not None else order["owner_phone"],
            "address": data.address if data.address is not None else order["address"],
            "repair_type": data.repair_type if data.repair_type is not None else order["repair_type"],
            "description": data.description if data.description is not None else order["description"],
            "priority": data.priority if data.priority is not None else order["priority"],
            "deadline": data.deadline if data.deadline is not None else order["deadline"],
        }

        conn.execute(
            """
            UPDATE repair_orders SET
                title = ?, owner_name = ?, owner_phone = ?, address = ?,
                repair_type = ?, description = ?, priority = ?, deadline = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                new_data["title"], new_data["owner_name"], new_data["owner_phone"],
                new_data["address"], new_data["repair_type"], new_data["description"],
                new_data["priority"], new_data["deadline"],
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"), order_id,
            ),
        )

        if order["status"] == OrderStatus.RETURNED_FOR_CORRECTION:
            conn.execute(
                "UPDATE exception_reasons SET resolved = 1, resolved_by = ?, resolved_at = ? WHERE order_id = ? AND resolved = 0",
                (user["name"], datetime.now().strftime("%Y-%m-%d %H:%M:%S"), order_id),
            )
            add_audit_note(conn, order_id, "correction", f"补正记录：{user['name']}更新了工单信息", user["name"], user["role"])

        row = conn.execute("SELECT * FROM repair_orders WHERE id = ?", (order_id,)).fetchone()

    return JSONResponse({"order": dict(row)})


async def process_action(request: Request):
    order_id = int(request.path_params["order_id"])
    user = request.state.user
    body = await request.json()
    data = OrderAction(**body)

    try:
        action = Action(data.action)
    except ValueError:
        return JSONResponse({"detail": f"无效操作: {data.action}"}, status_code=400)

    with get_conn() as conn:
        check_overdue_and_near(conn)
        row = conn.execute("SELECT * FROM repair_orders WHERE id = ?", (order_id,)).fetchone()
        if not row:
            return JSONResponse({"detail": "工单不存在"}, status_code=404)
        order = dict(row)
        order_no = order["order_no"]

        try:
            validate_role_action(user, action)
            validate_version(order["version"], data.version)
            validate_handler(user, order)

            to_status = action_to_status(action, order["status"])
            if to_status and to_status != order["status"]:
                validate_status_transition(OrderStatus(order["status"]), to_status)

            validate_evidence(order_id, to_status, data.has_evidence, conn) if to_status else None

            if to_status:
                next_role = get_next_handler_role(to_status)
                next_handler = DEMO_USERS.get(next_role, {}).get("name") if next_role else None
                conn.execute(
                    """
                    UPDATE repair_orders SET
                        status = ?, current_handler = ?, current_handler_role = ?,
                        last_opinion = ?, version = version + 1, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        to_status.value, next_handler, next_role.value if next_role else None,
                        data.opinion, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), order_id,
                    ),
                )
            else:
                conn.execute(
                    "UPDATE repair_orders SET version = version + 1, updated_at = ? WHERE id = ?",
                    (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), order_id),
                )

            add_processing_record(
                conn, order_id, action, order["status"],
                to_status.value if to_status else None,
                user["name"], user["role"], data.opinion,
                1 if data.has_evidence else 0, order["version"] + 1,
            )

            if action in [Action.REVIEW_APPROVE, Action.ARCHIVE]:
                add_audit_note(conn, order_id, "review", f"复核通过/归档：{data.opinion or '无意见'}", user["name"], user["role"])
            elif action == Action.REVIEW_REJECT:
                add_audit_note(conn, order_id, "review", f"复核驳回：{data.opinion or '无意见'}", user["name"], user["role"])
            elif action == Action.RETURN_FOR_CORRECTION:
                detect_field_exceptions(conn, order_id, order, user)

            row = conn.execute("SELECT * FROM repair_orders WHERE id = ?", (order_id,)).fetchone()

        except ValidationError as e:
            add_audit_note(
                conn, order_id, "intercept",
                f"操作拦截[{ACTION_NAMES.get(action, action)}]：{e.message}",
                user["name"], user["role"],
            )
            return JSONResponse(
                {"detail": e.message, "error_code": e.code, "order_no": order_no},
                status_code=400,
            )

    return JSONResponse({"order": dict(row), "message": "操作成功"})


async def batch_process(request: Request):
    user = request.state.user
    body = await request.json()
    data = BatchAction(**body)

    try:
        action = Action(data.action)
    except ValueError:
        return JSONResponse({"detail": f"无效操作: {data.action}"}, status_code=400)

    results = []
    success_count = 0
    failed_count = 0

    with get_conn() as conn:
        check_overdue_and_near(conn)
        for order_id in data.order_ids:
            row = conn.execute("SELECT id, order_no, status, version FROM repair_orders WHERE id = ?", (order_id,)).fetchone()
            if not row:
                failed_count += 1
                results.append(BatchResultItem(
                    order_id=order_id, order_no="UNKNOWN", success=False,
                    message="工单不存在", error_code="not_found",
                ))
                continue
            order_info = dict(row)

            try:
                validate_role_action(user, action)

                full_row = conn.execute("SELECT * FROM repair_orders WHERE id = ?", (order_id,)).fetchone()
                order = dict(full_row)

                pass
                validate_handler(user, order)

                to_status = action_to_status(action, order["status"])
                if to_status and to_status != order["status"]:
                    validate_status_transition(OrderStatus(order["status"]), to_status)

                if to_status:
                    validate_evidence(order_id, to_status, data.has_evidence, conn)

                if to_status:
                    next_role = get_next_handler_role(to_status)
                    next_handler = DEMO_USERS.get(next_role, {}).get("name") if next_role else None
                    conn.execute(
                        """
                        UPDATE repair_orders SET
                            status = ?, current_handler = ?, current_handler_role = ?,
                            last_opinion = ?, version = version + 1, updated_at = ?
                        WHERE id = ?
                        """,
                        (
                            to_status.value, next_handler, next_role.value if next_role else None,
                            data.opinion, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), order_id,
                        ),
                    )
                else:
                    conn.execute(
                        "UPDATE repair_orders SET version = version + 1, updated_at = ? WHERE id = ?",
                        (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), order_id),
                    )

                add_processing_record(
                    conn, order_id, action, order["status"],
                    to_status.value if to_status else None,
                    user["name"], user["role"], data.opinion,
                    1 if data.has_evidence else 0, order["version"] + 1,
                )

                success_count += 1
                results.append(BatchResultItem(
                    order_id=order_id, order_no=order_info["order_no"],
                    success=True, message="操作成功",
                ))

            except ValidationError as e:
                failed_count += 1
                add_audit_note(
                    conn, order_id, "intercept",
                    f"批量操作拦截[{ACTION_NAMES.get(action, action)}]：{e.message}",
                    user["name"], user["role"],
                )
                results.append(BatchResultItem(
                    order_id=order_id, order_no=order_info["order_no"],
                    success=False, message=e.message, error_code=e.code,
                ))
            except Exception as e:
                failed_count += 1
                results.append(BatchResultItem(
                    order_id=order_id, order_no=order_info["order_no"],
                    success=False, message=str(e), error_code="unknown",
                ))

    result = BatchResult(
        total=len(data.order_ids),
        success_count=success_count,
        failed_count=failed_count,
        items=results,
    )
    return JSONResponse(json.loads(result.model_dump_json()))


routes = [
    Route("/api/orders", list_orders, methods=["GET"]),
    Route("/api/orders", create_order, methods=["POST"]),
    Route("/api/orders/{order_id:int}", get_order, methods=["GET"]),
    Route("/api/orders/{order_id:int}", update_order, methods=["PUT"]),
    Route("/api/orders/{order_id:int}/action", process_action, methods=["POST"]),
    Route("/api/orders/batch", batch_process, methods=["POST"]),
]

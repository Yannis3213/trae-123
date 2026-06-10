import os
import json
import uuid
import aiofiles
from datetime import datetime
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.datastructures import UploadFile
from ..database import get_conn
from ..schemas import (
    OrderCreate, OrderCorrection, OrderAction, BatchAction,
    BatchResult, BatchResultItem,
)
from ..constants import (
    Role, OrderStatus, Action, ExceptionCode,
    STATUS_NAMES, ACTION_NAMES, ROLE_NAMES, SOURCE_MODULE_NAMES,
    STATUS_LIST_GROUPS, EXCEPTION_NAMES,
)
from ..services import (
    ValidationError, validate_all, validate_role_action, validate_version,
    validate_handler, validate_status_transition, validate_evidence,
    check_overdue_and_near, add_audit_note, add_exception,
    add_processing_record, add_attachment, count_attachments,
    detect_field_exceptions, resolve_field_exceptions, action_to_status,
    get_next_handler_role,
)
from ..auth import DEMO_USERS


UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


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
    user = request.state.user

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

        add_audit_note(
            conn, order_id, "view",
            f"[{ROLE_NAMES.get(user['role'], user['role'])}] {user['name']} 查看工单详情",
            user["name"], user["role"],
        )

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

    try:
        validate_role_action(user, Action.CREATE)
    except ValidationError as e:
        return JSONResponse({"detail": e.message, "error_code": e.code}, status_code=403)

    with get_conn() as conn:
        check_overdue_and_near(conn)
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        order_no = f"WX{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"

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
            add_audit_note(
                conn, order_id, "exception",
                f"创建工单时检测到字段缺项：{msgs}",
                user["name"], user["role"],
            )
        else:
            add_audit_note(
                conn, order_id, "create",
                f"工单创建成功，来源：{data.source_module}",
                user["name"], user["role"],
            )

        row = conn.execute("SELECT * FROM repair_orders WHERE id = ?", (order_id,)).fetchone()

    return JSONResponse({"order": dict(row)}, status_code=201)


async def correct_order(request: Request):
    order_id = int(request.path_params["order_id"])
    user = request.state.user
    body = await request.json()
    data = OrderCorrection(**body)

    with get_conn() as conn:
        check_overdue_and_near(conn)
        row = conn.execute("SELECT * FROM repair_orders WHERE id = ?", (order_id,)).fetchone()
        if not row:
            return JSONResponse({"detail": "工单不存在"}, status_code=404)
        order = dict(row)
        order_no = order["order_no"]

        try:
            if user["role"] != Role.REGISTRAR:
                raise ValidationError(
                    ExceptionCode.ROLE_VIOLATION,
                    "仅报修登记员可执行补正操作",
                )

            validate_version(order["version"], data.version)

            if order["status"] == OrderStatus.ARCHIVED:
                raise ValidationError(
                    ExceptionCode.STATUS_CONFLICT,
                    "已归档工单不可补正",
                )

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
                    version = version + 1, updated_at = ?
                WHERE id = ?
                """,
                (
                    new_data["title"], new_data["owner_name"], new_data["owner_phone"],
                    new_data["address"], new_data["repair_type"], new_data["description"],
                    new_data["priority"], new_data["deadline"],
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S"), order_id,
                ),
            )

            resolved = resolve_field_exceptions(conn, order_id, new_data, user)

            if order["status"] == OrderStatus.RETURNED_FOR_CORRECTION:
                add_processing_record(
                    conn, order_id, Action.CORRECT,
                    OrderStatus.RETURNED_FOR_CORRECTION, OrderStatus.CORRECTED,
                    user["name"], user["role"],
                    data.correction_opinion or "已补正缺项信息",
                    count_attachments(conn, order_id), order["version"] + 1,
                )
                conn.execute(
                    """
                    UPDATE repair_orders SET status = ?, current_handler_role = ?, current_handler = ?,
                        last_opinion = ? WHERE id = ?
                    """,
                    (OrderStatus.CORRECTED, Role.REGISTRAR, user["name"],
                     data.correction_opinion or "已补正", order_id),
                )
                add_audit_note(
                    conn, order_id, "correction",
                    f"补正完成，已解决字段：{', '.join(resolved) if resolved else '无'}；补正意见：{data.correction_opinion or '无'}",
                    user["name"], user["role"],
                )
            else:
                add_processing_record(
                    conn, order_id, Action.CORRECT,
                    order["status"], order["status"],
                    user["name"], user["role"],
                    data.correction_opinion or "更新工单信息",
                    count_attachments(conn, order_id), order["version"] + 1,
                )
                add_audit_note(
                    conn, order_id, "correction",
                    f"工单信息补正（非退回状态），已解决：{', '.join(resolved) if resolved else '无'}",
                    user["name"], user["role"],
                )

            row = conn.execute("SELECT * FROM repair_orders WHERE id = ?", (order_id,)).fetchone()

        except ValidationError as e:
            add_audit_note(
                conn, order_id, "intercept",
                f"补正操作拦截：{e.message}",
                user["name"], user["role"],
            )
            return JSONResponse(
                {"detail": e.message, "error_code": e.code, "order_no": order_no},
                status_code=400,
            )

    return JSONResponse({"order": dict(row), "message": "补正成功"})


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
            to_status = action_to_status(action, order["status"])
            validate_all(
                conn, user, order, action, data.version, to_status,
                uploaded_attachment_ids=None, check_duplicate=True,
            )

            ev_attachments = count_attachments(conn, order_id)

            if to_status and to_status != order["status"]:
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
                ev_attachments, order["version"] + 1,
            )

            if action in [Action.REVIEW_APPROVE, Action.ARCHIVE]:
                add_audit_note(
                    conn, order_id, "review",
                    f"复核通过/归档：{data.opinion or '无意见'}",
                    user["name"], user["role"],
                )
            elif action == Action.REVIEW_REJECT:
                add_audit_note(
                    conn, order_id, "review",
                    f"复核驳回，退回补正：{data.opinion or '无意见'}",
                    user["name"], user["role"],
                )
            elif action == Action.RETURN_FOR_CORRECTION:
                detect_field_exceptions(conn, order_id, order, user)
                add_audit_note(
                    conn, order_id, "review",
                    f"退回补正：{data.opinion or '缺项或不合规'}",
                    user["name"], user["role"],
                )
            else:
                add_audit_note(
                    conn, order_id, "action",
                    f"执行[{ACTION_NAMES.get(action, action)}]：{data.opinion or '无意见'}",
                    user["name"], user["role"],
                )

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


async def upload_attachment(request: Request):
    order_id = int(request.path_params["order_id"])
    user = request.state.user

    form = await request.form()
    files = form.getlist("file")
    if not files:
        return JSONResponse({"detail": "未上传文件"}, status_code=400)

    saved = []
    with get_conn() as conn:
        row = conn.execute("SELECT id, order_no, status FROM repair_orders WHERE id = ?", (order_id,)).fetchone()
        if not row:
            return JSONResponse({"detail": "工单不存在"}, status_code=404)

        for f in files:
            if not isinstance(f, UploadFile):
                continue
            ext = os.path.splitext(f.filename or "file")[1] or ".bin"
            safe_name = f"{uuid.uuid4().hex}{ext}"
            file_path = os.path.join(UPLOAD_DIR, safe_name)

            async with aiofiles.open(file_path, "wb") as out:
                while True:
                    chunk = await f.read(65536)
                    if not chunk:
                        break
                    await out.write(chunk)

            aid = add_attachment(conn, order_id, f.filename or safe_name, file_path, user["name"], user["role"])
            saved.append({"id": aid, "file_name": f.filename or safe_name})

        add_audit_note(
            conn, order_id, "evidence",
            f"上传证据附件 {len(saved)} 份：{', '.join([s['file_name'] for s in saved])}",
            user["name"], user["role"],
        )

    return JSONResponse({"attachments": saved, "message": f"成功上传 {len(saved)} 个附件"})


async def batch_process(request: Request):
    user = request.state.user
    body = await request.json()
    data = BatchAction(**body)
    order_versions = data.order_versions or {}

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

            submitted_version = order_versions.get(str(order_id)) or order_versions.get(order_id)
            if submitted_version is None:
                failed_count += 1
                add_audit_note(
                    conn, order_id, "intercept",
                    f"批量操作拦截[{ACTION_NAMES.get(action, action)}]：缺少版本号参数，请刷新列表后重试",
                    user["name"], user["role"],
                )
                results.append(BatchResultItem(
                    order_id=order_id, order_no=order_info["order_no"],
                    from_status=order_info["status"],
                    success=False,
                    message="缺少版本号参数，请刷新列表后重试",
                    error_code=ExceptionCode.VERSION_CONFLICT,
                ))
                continue

            try:
                full_row = conn.execute("SELECT * FROM repair_orders WHERE id = ?", (order_id,)).fetchone()
                order = dict(full_row)
                to_status = action_to_status(action, order["status"])

                validate_all(
                    conn, user, order, action, submitted_version, to_status,
                    uploaded_attachment_ids=None, check_duplicate=True,
                )

                ev_attachments = count_attachments(conn, order_id)

                if to_status and to_status != order["status"]:
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
                    ev_attachments, order["version"] + 1,
                )

                add_audit_note(
                    conn, order_id, "action",
                    f"批量执行[{ACTION_NAMES.get(action, action)}]：{data.opinion or '无意见'}",
                    user["name"], user["role"],
                )

                success_count += 1
                results.append(BatchResultItem(
                    order_id=order_id, order_no=order_info["order_no"],
                    from_status=order["status"],
                    to_status=to_status.value if to_status else order["status"],
                    success=True, message="操作成功",
                ))

            except ValidationError as e:
                failed_count += 1
                add_audit_note(
                    conn, order_id, "intercept",
                    f"批量操作拦截[{ACTION_NAMES.get(action, action)}][v{submitted_version}→v{order_info['version']}]：{e.message}",
                    user["name"], user["role"],
                )
                results.append(BatchResultItem(
                    order_id=order_id, order_no=order_info["order_no"],
                    from_status=order_info["status"],
                    success=False, message=e.message, error_code=e.code,
                ))
            except Exception as e:
                failed_count += 1
                add_audit_note(
                    conn, order_id, "intercept",
                    f"批量操作未知错误[{ACTION_NAMES.get(action, action)}]：{str(e)}",
                    user["name"], user["role"],
                )
                results.append(BatchResultItem(
                    order_id=order_id, order_no=order_info["order_no"],
                    from_status=order_info.get("status"),
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
    Route("/api/orders/{order_id:int}", correct_order, methods=["PUT"]),
    Route("/api/orders/{order_id:int}/action", process_action, methods=["POST"]),
    Route("/api/orders/{order_id:int}/attachments", upload_attachment, methods=["POST"]),
    Route("/api/orders/batch", batch_process, methods=["POST"]),
]

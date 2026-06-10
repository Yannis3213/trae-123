import json
from datetime import date, datetime
from starlette.applications import Starlette
from starlette.routing import Route, Mount
from starlette.responses import JSONResponse
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request

from database import get_db
from auth import verify_password, create_access_token, get_current_user, require_role
from schemas import (
    LoginRequest, ProcessRequest, BatchProcessRequest,
)


def get_due_status(due_date_str: str) -> str:
    today = date.today()
    due = date.fromisoformat(due_date_str)
    delta = (due - today).days
    if delta < 0:
        return "逾期"
    elif delta <= 3:
        return "临期"
    else:
        return "正常"


def row_to_dict(row):
    return {k: row[k] for k in row.keys()}


def app_to_list_item(app_row):
    d = row_to_dict(app_row)
    d["due_status"] = get_due_status(d["due_date"])
    return d


async def login(request: Request):
    body = await request.json()
    try:
        data = LoginRequest(**body)
    except Exception as e:
        return JSONResponse({"detail": "请求参数错误"}, status_code=400)

    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM users WHERE username = ?", (data.username,)
        )
        user = await cursor.fetchone()
        if not user or not verify_password(data.password, user["password_hash"]):
            return JSONResponse({"detail": "用户名或密码错误"}, status_code=401)

        token = create_access_token({
            "sub": user["username"],
            "role": user["role"],
            "real_name": user["real_name"],
            "branch": user["branch"],
        })
        return JSONResponse({
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "username": user["username"],
                "real_name": user["real_name"],
                "role": user["role"],
                "branch": user["branch"],
            },
        })
    finally:
        await db.close()


@require_role(["客户经理", "运营主管", "支行行长"])
async def me(request: Request):
    return JSONResponse(request.state.user)


@require_role(["客户经理", "运营主管", "支行行长"])
async def list_applications(request: Request):
    user = request.state.user
    status = request.query_params.get("status", "")
    due_status = request.query_params.get("due_status", "")
    keyword = request.query_params.get("keyword", "")
    queue = request.query_params.get("queue", "")

    db = await get_db()
    try:
        query = "SELECT * FROM account_applications WHERE 1=1"
        params = []

        if user["role"] == "客户经理":
            if queue == "my":
                query += " AND customer_manager = ?"
                params.append(user["real_name"])
            else:
                query += " AND customer_manager = ?"
                params.append(user["real_name"])

        elif user["role"] == "运营主管":
            if queue == "my":
                query += " AND current_handler = ? AND current_role = '运营主管'"
                params.append(user["real_name"])
            elif queue == "returned":
                query += " AND status = '异常回传'"
            else:
                query += " AND ((status = '待签收' AND current_role = '运营主管') OR status = '异常回传')"

        elif user["role"] == "支行行长":
            if queue == "my":
                query += " AND current_handler = ? AND current_role = '支行行长'"
                params.append(user["real_name"])
            elif queue == "completed":
                query += " AND status = '签收完成'"
            else:
                query += " AND ((status = '待签收' AND current_role = '支行行长') OR status = '签收完成')"

        if status:
            query += " AND status = ?"
            params.append(status)

        if keyword:
            query += " AND (customer_name LIKE ? OR application_no LIKE ? OR phone LIKE ?)"
            params.extend([f"%{keyword}%", f"%{keyword}%", f"%{keyword}%"])

        query += " ORDER BY created_at DESC"

        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        items = [app_to_list_item(r) for r in rows]

        if due_status:
            items = [i for i in items if i["due_status"] == due_status]

        return JSONResponse({"items": items, "total": len(items)})
    finally:
        await db.close()


@require_role(["客户经理", "运营主管", "支行行长"])
async def get_application(request: Request):
    app_id = request.path_params["id"]
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM account_applications WHERE id = ?", (app_id,)
        )
        app = await cursor.fetchone()
        if not app:
            return JSONResponse({"detail": "开户申请不存在"}, status_code=404)

        detail = app_to_list_item(app)

        cursor = await db.execute(
            "SELECT * FROM attachments WHERE application_id = ? ORDER BY uploaded_at",
            (app_id,),
        )
        attachments = [row_to_dict(r) for r in await cursor.fetchall()]

        cursor = await db.execute(
            "SELECT * FROM processing_records WHERE application_id = ? ORDER BY created_at DESC",
            (app_id,),
        )
        records = [row_to_dict(r) for r in await cursor.fetchall()]

        cursor = await db.execute(
            "SELECT * FROM exception_reasons WHERE application_id = ? ORDER BY created_at DESC",
            (app_id,),
        )
        exceptions = [row_to_dict(r) for r in await cursor.fetchall()]

        cursor = await db.execute(
            "SELECT * FROM audit_notes WHERE application_id = ? ORDER BY created_at DESC",
            (app_id,),
        )
        audit_notes = [row_to_dict(r) for r in await cursor.fetchall()]

        return JSONResponse({
            "application": detail,
            "attachments": attachments,
            "processing_records": records,
            "exception_reasons": exceptions,
            "audit_notes": audit_notes,
        })
    finally:
        await db.close()


@require_role(["客户经理", "运营主管", "支行行长"])
async def get_stats(request: Request):
    user = request.state.user
    db = await get_db()
    try:
        query = "SELECT * FROM account_applications WHERE 1=1"
        params = []

        if user["role"] == "客户经理":
            query += " AND customer_manager = ?"
            params.append(user["real_name"])

        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        items = [app_to_list_item(r) for r in rows]

        total = len(items)
        pending = len([i for i in items if i["status"] == "待签收"])
        normal = len([i for i in items if i["due_status"] == "正常" and i["status"] != "签收完成"])
        approaching = len([i for i in items if i["due_status"] == "临期" and i["status"] != "签收完成"])
        overdue = len([i for i in items if i["due_status"] == "逾期" and i["status"] != "签收完成"])
        exception = len([i for i in items if i["status"] == "异常回传"])
        completed = len([i for i in items if i["status"] == "签收完成"])

        return JSONResponse({
            "total": total,
            "pending": pending,
            "normal": normal,
            "approaching": approaching,
            "overdue": overdue,
            "exception": exception,
            "completed": completed,
        })
    finally:
        await db.close()


async def _validate_and_process(db, app_id, action, version, user, remark="", evidence="",
                                 exception_type="", exception_reason=""):
    cursor = await db.execute(
        "SELECT * FROM account_applications WHERE id = ?", (app_id,)
    )
    app = await cursor.fetchone()
    if not app:
        return None, "开户申请不存在", 404

    if app["version"] != version:
        return None, f"版本冲突：当前版本为 {app['version']}，您提交的版本为 {version}，请刷新后重试", 409

    current_status = app["status"]
    current_role = user["role"]
    current_handler = app["current_handler"]
    customer_manager = app["customer_manager"]

    valid_actions = {
        "客户经理": {
            "提交申请": {"from": [None], "to": "待签收"},
            "补正重提": {"from": ["异常回传"], "to": "待签收", "handler_check": "self_cm"},
        },
        "运营主管": {
            "签收": {"from": ["待签收"], "to": "待签收", "handler_check": "none_or_self"},
            "审核通过": {"from": ["待签收"], "to": "待签收", "handler_check": "self", "require_evidence": True},
            "退回补正": {"from": ["待签收"], "to": "异常回传", "handler_check": "self"},
        },
        "支行行长": {
            "签收": {"from": ["待签收"], "to": "待签收", "handler_check": "none_or_self"},
            "复核通过": {"from": ["待签收"], "to": "签收完成", "handler_check": "self"},
            "退回补正": {"from": ["待签收"], "to": "异常回传", "handler_check": "self"},
        },
    }

    if action not in valid_actions.get(current_role, {}):
        return None, f"角色 {current_role} 无权执行操作 {action}", 403

    rule = valid_actions[current_role][action]

    if rule.get("from") and current_status not in rule["from"]:
        return None, f"状态不匹配：当前状态为 {current_status}，无法执行 {action}", 400

    handler_check = rule.get("handler_check")
    if handler_check == "self" and current_handler != user["real_name"]:
        return None, f"当前处理人为 {current_handler}，您无权处理此申请", 403
    if handler_check == "none_or_self":
        if current_handler and current_handler != user["real_name"]:
            return None, f"申请已被 {current_handler} 签收处理中", 409
        if not current_handler and app["current_role"] != current_role:
            return None, f"该申请当前阶段为 {app['current_role']}，您（{current_role}）无权签收", 403
    if handler_check == "self_cm" and customer_manager != user["real_name"]:
        return None, "只能处理自己名下的退回申请", 403

    if action in ["审核通过", "退回补正", "复核通过"] and current_handler != user["real_name"]:
        return None, f"当前处理人为 {current_handler}，您无权执行此操作", 403

    if action in ["审核通过", "退回补正"] and app["current_role"] != "运营主管":
        return None, f"当前阶段为 {app['current_role']}，运营主管无法执行此操作", 403

    if action in ["复核通过", "退回补正"] and app["current_role"] == "支行行长" and current_role == "支行行长":
        pass
    elif action == "复核通过" and app["current_role"] != "支行行长":
        return None, f"当前阶段为 {app['current_role']}，尚未到支行行长复核阶段", 403

    if rule.get("require_evidence") and not evidence:
        return None, "审核通过必须提供审核证据（已核查的材料清单）", 400

    new_status = rule["to"]
    new_handler = user["real_name"]
    new_handler_role = current_role

    if action == "签收":
        new_handler = user["real_name"]
        new_handler_role = current_role
    elif action == "审核通过":
        new_handler = None
        new_handler_role = "支行行长"
    elif action == "退回补正":
        new_handler = customer_manager
        new_handler_role = "客户经理"
    elif action == "补正重提":
        new_handler = None
        new_handler_role = "运营主管"
    elif action == "复核通过":
        new_handler = None
        new_handler_role = None

    new_version = app["version"] + 1

    await db.execute(
        """UPDATE account_applications
           SET status = ?, current_handler = ?, current_role = ?, version = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND version = ?""",
        (new_status, new_handler, new_handler_role, new_version, app_id, version),
    )

    await db.execute(
        """INSERT INTO processing_records
           (application_id, action, from_status, to_status, operator, operator_role,
            remark, evidence_required, evidence_provided, version_before, version_after)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            app_id, action, current_status, new_status,
            user["real_name"], current_role, remark,
            None, evidence if evidence else None,
            version, new_version,
        ),
    )

    if action == "退回补正" and exception_reason:
        await db.execute(
            """INSERT INTO exception_reasons
               (application_id, reason_type, description, reported_by, reported_by_role)
               VALUES (?, ?, ?, ?, ?)""",
            (app_id, exception_type or "缺材料", exception_reason,
             user["real_name"], current_role),
        )

    if action == "补正重提":
        await db.execute(
            "UPDATE exception_reasons SET is_resolved = 1, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP WHERE application_id = ? AND is_resolved = 0",
            (user["real_name"], app_id),
        )

    await db.commit()

    cursor = await db.execute(
        "SELECT * FROM account_applications WHERE id = ?", (app_id,)
    )
    updated = await cursor.fetchone()
    return app_to_list_item(updated), None, 200


@require_role(["客户经理", "运营主管", "支行行长"])
async def process_application(request: Request):
    app_id = request.path_params["id"]
    user = request.state.user
    body = await request.json()
    try:
        data = ProcessRequest(**body)
    except Exception as e:
        return JSONResponse({"detail": "请求参数错误"}, status_code=400)

    db = await get_db()
    try:
        result, error, status = await _validate_and_process(
            db, app_id, data.action, data.version, user,
            data.remark or "", data.evidence or "",
            data.exception_type or "", data.exception_reason or "",
        )
        if error:
            return JSONResponse({"detail": error}, status_code=status)

        cursor = await db.execute(
            "SELECT * FROM processing_records WHERE application_id = ? ORDER BY created_at DESC",
            (app_id,),
        )
        records = [row_to_dict(r) for r in await cursor.fetchall()]

        return JSONResponse({
            "application": result,
            "processing_records": records,
            "message": f"操作成功：{data.action}",
        })
    finally:
        await db.close()


@require_role(["运营主管", "支行行长"])
async def batch_process(request: Request):
    user = request.state.user
    body = await request.json()
    try:
        data = BatchProcessRequest(**body)
    except Exception as e:
        return JSONResponse({"detail": "请求参数错误"}, status_code=400)

    if not data.items:
        return JSONResponse({"detail": "批量处理项不能为空"}, status_code=400)

    db = await get_db()
    try:
        results = []
        for item in data.items:
            try:
                result, error, status = await _validate_and_process(
                    db, item.application_id, data.action, item.version, user,
                    data.remark or "", data.evidence or "",
                    "", "",
                )
                cursor = await db.execute(
                    "SELECT application_no FROM account_applications WHERE id = ?",
                    (item.application_id,),
                )
                app_row = await cursor.fetchone()
                app_no = app_row["application_no"] if app_row else f"ID{item.application_id}"

                if error:
                    results.append({
                        "application_id": item.application_id,
                        "application_no": app_no,
                        "success": False,
                        "message": error,
                        "new_status": None,
                    })
                else:
                    results.append({
                        "application_id": item.application_id,
                        "application_no": app_no,
                        "success": True,
                        "message": f"操作成功：{data.action}",
                        "new_status": result["status"],
                    })
            except Exception as e:
                results.append({
                    "application_id": item.application_id,
                    "application_no": f"ID{item.application_id}",
                    "success": False,
                    "message": f"处理异常：{str(e)}",
                    "new_status": None,
                })

        success_count = sum(1 for r in results if r["success"])
        fail_count = len(results) - success_count

        return JSONResponse({
            "total": len(results),
            "success_count": success_count,
            "fail_count": fail_count,
            "results": results,
        })
    finally:
        await db.close()


@require_role(["运营主管", "支行行长"])
async def add_audit_note(request: Request):
    app_id = request.path_params["id"]
    user = request.state.user
    body = await request.json()
    note_text = body.get("note", "")
    if not note_text:
        return JSONResponse({"detail": "备注内容不能为空"}, status_code=400)

    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id FROM account_applications WHERE id = ?", (app_id,)
        )
        if not await cursor.fetchone():
            return JSONResponse({"detail": "开户申请不存在"}, status_code=404)

        await db.execute(
            """INSERT INTO audit_notes
               (application_id, note, noted_by, noted_by_role)
               VALUES (?, ?, ?, ?)""",
            (app_id, note_text, user["real_name"], user["role"]),
        )
        await db.commit()

        cursor = await db.execute(
            "SELECT * FROM audit_notes WHERE application_id = ? ORDER BY created_at DESC",
            (app_id,),
        )
        notes = [row_to_dict(r) for r in await cursor.fetchall()]
        return JSONResponse({"audit_notes": notes})
    finally:
        await db.close()


routes = [
    Route("/api/auth/login", login, methods=["POST"]),
    Route("/api/auth/me", me, methods=["GET"]),
    Route("/api/applications", list_applications, methods=["GET"]),
    Route("/api/applications/stats", get_stats, methods=["GET"]),
    Route("/api/applications/{id:int}", get_application, methods=["GET"]),
    Route("/api/applications/{id:int}/process", process_application, methods=["POST"]),
    Route("/api/applications/batch", batch_process, methods=["POST"]),
    Route("/api/applications/{id:int}/audit-note", add_audit_note, methods=["POST"]),
]

middleware = [
    Middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3002", "http://127.0.0.1:3002"],
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=True,
    ),
]

app = Starlette(routes=routes, middleware=middleware)

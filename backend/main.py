import json
import os
import secrets
from datetime import datetime
from typing import Optional

from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from starlette.routing import Route, Mount
from starlette.requests import Request
from pydantic import BaseModel, Field

from database import get_db, init_db

FRONTEND_PORT = 3001
BACKEND_PORT = 8001

tokens = {}


def get_now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def get_order_deadline_status(deadline_str):
    if not deadline_str:
        return "normal"
    try:
        deadline = datetime.strptime(deadline_str, "%Y-%m-%d %H:%M:%S")
    except Exception:
        return "normal"
    now = datetime.now()
    diff_hours = (deadline - now).total_seconds() / 3600
    if diff_hours < 0:
        return "overdue"
    if diff_hours <= 24:
        return "approaching"
    return "normal"


ROLE_TRANSITIONS = {
    "jiaowu": {"待分派": ["已转办"]},
    "banzhuren": {"已转办": ["已回访", "待分派"]},
    "xiaozhang": {"已回访": []},
}

REQUIRED_EVIDENCE = {
    "已转办": ["课程排班"],
    "已回访": ["课后反馈", "回访记录", "家长确认"],
}

STATUS_ORDER = ["待分派", "已转办", "已回访"]


def require_auth(handler):
    async def wrapper(request: Request):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token or token not in tokens:
            return JSONResponse({"code": 401, "msg": "未登录或登录已过期"}, status_code=401)
        request.state.user = tokens[token]
        return await handler(request)
    return wrapper


def user_to_dict(row):
    return {"id": row["id"], "username": row["username"], "role": row["role"], "name": row["name"]}


def order_to_dict(row):
    d = dict(row)
    d["deadline_status"] = get_order_deadline_status(row["deadline"])
    d["is_exception"] = bool(row["is_exception"])
    return d


class LoginReq(BaseModel):
    username: str
    password: str


class CreateOrderReq(BaseModel):
    student_name: str
    student_id: Optional[str] = None
    course_name: str
    service_type: str
    description: Optional[str] = None
    deadline: Optional[str] = None


class DispatchReq(BaseModel):
    handler_id: int
    remark: Optional[str] = None


class ProcessReq(BaseModel):
    action: str
    version: int
    target_status: Optional[str] = None
    handler_id: Optional[int] = None
    remark: Optional[str] = None
    evidence_types: list[str] = Field(default_factory=list)
    exception_reason: Optional[str] = None
    correction_action: Optional[str] = None


class BatchProcessReq(BaseModel):
    action: str
    orders: list[dict]
    handler_id: Optional[int] = None
    remark: Optional[str] = None
    evidence_types: list[str] = Field(default_factory=list)
    exception_reason: Optional[str] = None
    correction_action: Optional[str] = None


async def login(request: Request):
    body = await request.json()
    try:
        data = LoginReq(**body)
    except Exception as e:
        return JSONResponse({"code": 400, "msg": f"参数错误: {e}"}, status_code=400)
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username=? AND password=?",
            (data.username, data.password),
        ).fetchone()
        if not row:
            return JSONResponse({"code": 401, "msg": "账号或密码错误"}, status_code=401)
        token = secrets.token_hex(16)
        tokens[token] = user_to_dict(row)
        return JSONResponse({"code": 0, "data": {"token": token, "user": user_to_dict(row)}})


async def logout(request: Request):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if token in tokens:
        del tokens[token]
    return JSONResponse({"code": 0, "msg": "已退出登录"})


async def current_user(request: Request):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if token and token in tokens:
        return JSONResponse({"code": 0, "data": tokens[token]})
    return JSONResponse({"code": 401, "msg": "未登录"}, status_code=401)


@require_auth
async def list_users(request: Request):
    with get_db() as conn:
        rows = conn.execute("SELECT id, username, role, name FROM users ORDER BY id").fetchall()
        return JSONResponse({"code": 0, "data": [user_to_dict(r) for r in rows]})


@require_auth
async def list_orders(request: Request):
    user = request.state.user
    params = request.query_params
    status = params.get("status")
    deadline_status = params.get("deadline_status")
    keyword = params.get("keyword")
    only_mine = params.get("only_mine") == "1"

    where = []
    args = []
    if status:
        where.append("so.status = ?")
        args.append(status)
    if keyword:
        where.append("(so.order_no LIKE ? OR so.student_name LIKE ? OR so.course_name LIKE ?)")
        kw = f"%{keyword}%"
        args.extend([kw, kw, kw])
    if only_mine:
        if user["role"] == "jiaowu":
            where.append("so.created_by = ?")
            args.append(user["id"])
        else:
            where.append("so.current_handler = ?")
            args.append(user["id"])

    sql = """
        SELECT so.*, u1.name AS created_by_name, u2.name AS current_handler_name
        FROM service_orders so
        LEFT JOIN users u1 ON so.created_by = u1.id
        LEFT JOIN users u2 ON so.current_handler = u2.id
    """
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY so.created_at DESC"

    with get_db() as conn:
        rows = conn.execute(sql, args).fetchall()
        orders = []
        for r in rows:
            d = order_to_dict(r)
            d["created_by_name"] = r["created_by_name"]
            d["current_handler_name"] = r["current_handler_name"]
            if deadline_status and d["deadline_status"] != deadline_status:
                continue
            orders.append(d)

        total_all = len(conn.execute("SELECT id FROM service_orders").fetchall())
        pending = len(conn.execute("SELECT id FROM service_orders WHERE status='待分派'").fetchall())
        transferred = len(conn.execute("SELECT id FROM service_orders WHERE status='已转办'").fetchall())
        reviewed = len(conn.execute("SELECT id FROM service_orders WHERE status='已回访'").fetchall())
        overdue = 0
        approaching = 0
        normal = 0
        for r in conn.execute("SELECT deadline FROM service_orders").fetchall():
            s = get_order_deadline_status(r["deadline"])
            if s == "overdue":
                overdue += 1
            elif s == "approaching":
                approaching += 1
            else:
                normal += 1
        stats = {
            "total": total_all,
            "pending": pending,
            "transferred": transferred,
            "reviewed": reviewed,
            "deadline_normal": normal,
            "deadline_approaching": approaching,
            "deadline_overdue": overdue,
        }
        return JSONResponse({"code": 0, "data": {"list": orders, "stats": stats}})


@require_auth
async def create_order(request: Request):
    user = request.state.user
    if user["role"] != "jiaowu":
        return JSONResponse({"code": 403, "msg": "只有教务老师可以发起课程服务单"}, status_code=403)
    body = await request.json()
    try:
        data = CreateOrderReq(**body)
    except Exception as e:
        return JSONResponse({"code": 400, "msg": f"参数错误: {e}"}, status_code=400)
    if not data.student_name or not data.course_name or not data.service_type:
        return JSONResponse({"code": 400, "msg": "学员姓名、课程名称、服务类型为必填"}, status_code=400)

    with get_db() as conn:
        now = get_now()
        order_no = f"FW{datetime.now().strftime('%Y%m%d%H%M%S')}"
        cursor = conn.execute(
            """INSERT INTO service_orders
            (order_no, student_name, student_id, course_name, service_type, description,
             status, version, created_by, deadline, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, '待分派', 1, ?, ?, ?, ?)""",
            (order_no, data.student_name, data.student_id, data.course_name,
             data.service_type, data.description, user["id"], data.deadline, now, now),
        )
        order_id = cursor.lastrowid
        conn.execute(
            """INSERT INTO processing_records
            (order_id, from_status, to_status, action, operator_id, remark, created_at, version)
            VALUES (?, NULL, '待分派', '创建服务单', ?, ?, ?, 1)""",
            (order_id, user["id"], f"服务单 {order_no} 创建", now),
        )
        row = conn.execute("SELECT * FROM service_orders WHERE id=?", (order_id,)).fetchone()
        return JSONResponse({"code": 0, "data": order_to_dict(row)})


def _check_and_transition(conn, order_id, user, client_version, action, target_status, handler_id, remark, evidence_types, exception_reason, correction_action):
    order = conn.execute("SELECT * FROM service_orders WHERE id=?", (order_id,)).fetchone()
    if not order:
        return None, "服务单不存在"

    if order["completed_at"]:
        return None, f"服务单已于 {order['completed_at']} 完成归档，禁止重复操作"

    current_status = order["status"]
    current_version = order["version"]
    current_handler = order["current_handler"]
    created_by = order["created_by"]

    if client_version is not None and client_version != current_version:
        return None, f"版本冲突：客户端版本 v{client_version}，当前最新版本 v{current_version}，请刷新后重试"

    if action not in ("退回补正", "复核归档"):
        allowed = ROLE_TRANSITIONS.get(user["role"], {}).get(current_status, [])
        if target_status and target_status not in allowed:
            return None, f"当前角色({user['role']})在状态({current_status})下不能执行该操作"
        elif not target_status and action not in ("转办班主任", "完成回访转校长"):
            return None, f"未知操作: {action}"

    if user["role"] != "jiaowu" and current_handler and current_handler != user["id"]:
        return None, f"当前处理人不是您，越权操作已拦截"

    if action == "转办班主任":
        if user["role"] != "jiaowu":
            return None, "只有教务老师可以转办"
        if current_status != "待分派":
            return None, f"当前状态 {current_status} 不能转办，需为待分派"
        if not handler_id:
            return None, "必须指定处理人"
        handler = conn.execute("SELECT * FROM users WHERE id=?", (handler_id,)).fetchone()
        if not handler or handler["role"] != "banzhuren":
            return None, "处理人必须是班主任角色"
        atts = conn.execute("SELECT evidence_type FROM attachments WHERE order_id=?", (order_id,)).fetchall()
        has = [a["evidence_type"] for a in atts]
        missing = [e for e in REQUIRED_EVIDENCE["已转办"] if e not in has]
        if missing:
            return None, f"缺少必要证据材料: {', '.join(missing)}，请先上传"
        new_status = "已转办"
        new_handler = handler_id
        is_exc = 0
        exc_reason = None
    elif action == "完成回访转校长":
        if user["role"] != "banzhuren":
            return None, "只有班主任可以提交回访"
        if current_status != "已转办":
            return None, f"当前状态 {current_status} 不能提交回访，需为已转办"
        atts = conn.execute("SELECT evidence_type FROM attachments WHERE order_id=?", (order_id,)).fetchall()
        has = [a["evidence_type"] for a in atts]
        missing = [e for e in REQUIRED_EVIDENCE["已回访"] if e not in has]
        if missing:
            return None, f"课后反馈缺记录或材料: {', '.join(missing)}，不能悄悄放行"
        principal = conn.execute("SELECT * FROM users WHERE role='xiaozhang' LIMIT 1").fetchone()
        new_status = "已回访"
        new_handler = principal["id"] if principal else None
        is_exc = 0
        exc_reason = None
    elif action == "退回补正":
        if user["role"] not in ("banzhuren", "xiaozhang"):
            return None, "只有班主任或校长可以退回补正"
        if current_status not in ("已转办", "已回访"):
            return None, f"当前状态 {current_status} 不支持退回补正"
        if not correction_action:
            return None, "请说明补正动作"
        if not exception_reason:
            return None, "请说明异常原因"
        if user["role"] == "banzhuren" and current_status == "已转办":
            new_status = "待分派"
            new_handler = created_by
        elif user["role"] == "xiaozhang" and current_status == "已回访":
            new_status = "已转办"
            last_banzhuren = conn.execute(
                """SELECT handler_id FROM processing_records
                   WHERE order_id=? AND to_status='已转办' ORDER BY created_at DESC LIMIT 1""",
                (order_id,),
            ).fetchone()
            new_handler = last_banzhuren["handler_id"] if last_banzhuren else current_handler
        elif user["role"] == "xiaozhang" and current_status == "已转办":
            new_status = "已转办"
            new_handler = current_handler
        else:
            return None, f"角色({user['role']})在状态({current_status})下不允许退回补正"
        is_exc = 1
        exc_reason = exception_reason
        conn.execute(
            "INSERT INTO correction_actions (order_id, action, reason, operator_id, created_at) VALUES (?, ?, ?, ?, ?)",
            (order_id, correction_action, exception_reason, user["id"], get_now()),
        )
    elif action == "复核归档":
        if user["role"] != "xiaozhang":
            return None, "只有校长可以复核归档"
        if current_status != "已回访":
            return None, f"当前状态 {current_status} 不能归档，需为已回访状态"
        new_status = "已回访"
        new_handler = current_handler
        is_exc = 0
        exc_reason = None
    else:
        return None, f"未知操作: {action}"

    new_version = current_version + 1
    now = get_now()
    completed_at = now if action == "复核归档" else None
    conn.execute(
        """UPDATE service_orders SET status=?, version=?, current_handler=?,
           updated_at=?, exception_reason=?, is_exception=?, completed_at=?
           WHERE id=? AND version=?""",
        (new_status, new_version, new_handler, now, exc_reason, is_exc, completed_at, order_id, current_version),
    )
    updated = conn.execute("SELECT changes() AS c").fetchone()["c"]
    if updated == 0:
        return None, "版本冲突，单据已被他人处理，请刷新后重试"

    conn.execute(
        """INSERT INTO processing_records
        (order_id, from_status, to_status, action, operator_id, handler_id, remark, created_at, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (order_id, current_status, new_status, action, user["id"], new_handler, remark, now, new_version),
    )
    return {"id": order_id, "status": new_status, "version": new_version, "handler_id": new_handler}, None


@require_auth
async def process_order(request: Request):
    user = request.state.user
    order_id = int(request.path_params["order_id"])
    body = await request.json()
    try:
        data = ProcessReq(**body)
    except Exception as e:
        return JSONResponse({"code": 400, "msg": f"参数错误: {e}"}, status_code=400)

    with get_db() as conn:
        result, err = _check_and_transition(
            conn, order_id, user, data.version, data.action, data.target_status, data.handler_id,
            data.remark, data.evidence_types, data.exception_reason, data.correction_action,
        )
        if err:
            return JSONResponse({"code": 400, "msg": err}, status_code=400)
        return JSONResponse({"code": 0, "data": result, "msg": "操作成功"})


@require_auth
async def batch_process(request: Request):
    user = request.state.user
    body = await request.json()
    try:
        data = BatchProcessReq(**body)
    except Exception as e:
        return JSONResponse({"code": 400, "msg": f"参数错误: {e}"}, status_code=400)
    if not data.orders:
        return JSONResponse({"code": 400, "msg": "请选择要处理的单据"}, status_code=400)

    results = []
    with get_db() as conn:
        for item in data.orders:
            oid = item.get("id")
            client_version = item.get("version")
            if not oid:
                results.append({"id": oid, "success": False, "msg": "缺少单据 id"})
                continue
            try:
                result, err = _check_and_transition(
                    conn, oid, user, client_version, data.action, None, data.handler_id,
                    data.remark, data.evidence_types, data.exception_reason, data.correction_action,
                )
                if err:
                    results.append({"id": oid, "success": False, "msg": err})
                else:
                    results.append({"id": oid, "success": True, "msg": "处理成功", "data": result})
            except Exception as e:
                results.append({"id": oid, "success": False, "msg": f"系统异常: {e}"})
    success_count = sum(1 for r in results if r["success"])
    return JSONResponse({
        "code": 0,
        "msg": f"批量处理完成：成功{success_count}条，失败{len(results)-success_count}条",
        "data": {"summary": {"success": success_count, "failed": len(results) - success_count}, "items": results},
    })


@require_auth
async def get_order_detail(request: Request):
    order_id = int(request.path_params["order_id"])
    with get_db() as conn:
        row = conn.execute(
            """SELECT so.*, u1.name AS created_by_name, u2.name AS current_handler_name
            FROM service_orders so
            LEFT JOIN users u1 ON so.created_by = u1.id
            LEFT JOIN users u2 ON so.current_handler = u2.id
            WHERE so.id=?""",
            (order_id,),
        ).fetchone()
        if not row:
            return JSONResponse({"code": 404, "msg": "服务单不存在"}, status_code=404)
        d = order_to_dict(row)
        d["created_by_name"] = row["created_by_name"]
        d["current_handler_name"] = row["current_handler_name"]

        atts = conn.execute(
            """SELECT a.*, u.name AS uploaded_by_name FROM attachments a
            LEFT JOIN users u ON a.uploaded_by = u.id WHERE a.order_id=? ORDER BY a.uploaded_at""",
            (order_id,),
        ).fetchall()
        d["attachments"] = [dict(r) for r in atts]

        records = conn.execute(
            """SELECT pr.*, u1.name AS operator_name, u2.name AS handler_name
            FROM processing_records pr
            LEFT JOIN users u1 ON pr.operator_id = u1.id
            LEFT JOIN users u2 ON pr.handler_id = u2.id
            WHERE pr.order_id=? ORDER BY pr.created_at""",
            (order_id,),
        ).fetchall()
        d["processing_records"] = [dict(r) for r in records]

        notes = conn.execute(
            """SELECT an.*, u.name AS user_name FROM audit_notes an
            LEFT JOIN users u ON an.user_id = u.id WHERE an.order_id=? ORDER BY an.created_at""",
            (order_id,),
        ).fetchall()
        d["audit_notes"] = [dict(r) for r in notes]

        corrections = conn.execute(
            """SELECT ca.*, u.name AS operator_name FROM correction_actions ca
            LEFT JOIN users u ON ca.operator_id = u.id WHERE ca.order_id=? ORDER BY ca.created_at""",
            (order_id,),
        ).fetchall()
        d["correction_actions"] = [dict(r) for r in corrections]

        return JSONResponse({"code": 0, "data": d})


@require_auth
async def upload_attachment(request: Request):
    user = request.state.user
    order_id = int(request.path_params["order_id"])
    form = await request.form()
    file = form.get("file")
    evidence_type = form.get("evidence_type", "其他")
    if not file or not file.filename:
        return JSONResponse({"code": 400, "msg": "请选择文件"}, status_code=400)
    with get_db() as conn:
        order = conn.execute("SELECT id FROM service_orders WHERE id=?", (order_id,)).fetchone()
        if not order:
            return JSONResponse({"code": 404, "msg": "服务单不存在"}, status_code=404)
        ext = os.path.splitext(file.filename)[1].lower().lstrip(".") or "bin"
        cursor = conn.execute(
            """INSERT INTO attachments (order_id, filename, file_type, evidence_type, uploaded_by, uploaded_at)
            VALUES (?, ?, ?, ?, ?, ?)""",
            (order_id, file.filename, ext, evidence_type, user["id"], get_now()),
        )
        row = conn.execute("SELECT * FROM attachments WHERE id=?", (cursor.lastrowid,)).fetchone()
        return JSONResponse({"code": 0, "data": dict(row)})


@require_auth
async def add_audit_note(request: Request):
    user = request.state.user
    order_id = int(request.path_params["order_id"])
    body = await request.json()
    content = body.get("content", "").strip()
    if not content:
        return JSONResponse({"code": 400, "msg": "备注内容不能为空"}, status_code=400)
    with get_db() as conn:
        conn.execute(
            "INSERT INTO audit_notes (order_id, user_id, content, created_at) VALUES (?, ?, ?, ?)",
            (order_id, user["id"], content, get_now()),
        )
        return JSONResponse({"code": 0, "msg": "备注已添加"})


app = Starlette(
    debug=True,
    middleware=[
        Middleware(
            CORSMiddleware,
            allow_origins=[f"http://localhost:{FRONTEND_PORT}", f"http://127.0.0.1:{FRONTEND_PORT}"],
            allow_methods=["*"],
            allow_headers=["*"],
            allow_credentials=True,
        ),
    ],
    routes=[
        Route("/api/auth/login", login, methods=["POST"]),
        Route("/api/auth/logout", logout, methods=["POST"]),
        Route("/api/auth/me", current_user, methods=["GET"]),
        Route("/api/users", list_users, methods=["GET"]),
        Route("/api/orders", list_orders, methods=["GET"]),
        Route("/api/orders", create_order, methods=["POST"]),
        Route("/api/orders/{order_id:int}", get_order_detail, methods=["GET"]),
        Route("/api/orders/{order_id:int}/process", process_order, methods=["POST"]),
        Route("/api/orders/batch", batch_process, methods=["POST"]),
        Route("/api/orders/{order_id:int}/attachments", upload_attachment, methods=["POST"]),
        Route("/api/orders/{order_id:int}/notes", add_audit_note, methods=["POST"]),
    ],
)

if __name__ == "__main__":
    import uvicorn
    init_db()
    uvicorn.run(app, host="0.0.0.0", port=BACKEND_PORT)

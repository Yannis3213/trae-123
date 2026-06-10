import sys
import os
from litestar import Litestar, Router, get, post, put, Controller
from litestar.config.cors import CORSConfig
from litestar.params import Body, Parameter
from litestar.datastructures import State as LitestarState
from litestar.status_codes import HTTP_200_OK, HTTP_400_BAD_REQUEST, HTTP_401_UNAUTHORIZED, HTTP_403_FORBIDDEN
from litestar.response import Response
from typing import Optional, Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.db import init_database, get_connection
from app.schemas import (
    ProcessAction,
    BatchProcessRequest,
    BatchProcessResult,
    ContractCreate,
    LoginRequest,
    CurrentUser,
)
from app.workflow import WorkflowException
from app import repository as repo


def row2dict(r):
    return {k: r[k] for k in r.keys()} if r else {}


def json_response(data: Any, status_code: int = HTTP_200_OK, headers=None):
    import json as _json
    body = _json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
    return Response(
        content=body,
        status_code=status_code,
        headers=headers or {},
        media_type="application/json; charset=utf-8",
    )


def err_response(message: str, code: str = "ERROR", exc_type: str = "系统错误", detail: dict = None, status_code: int = HTTP_400_BAD_REQUEST):
    return json_response({
        "success": False,
        "error": {
            "type": exc_type,
            "code": code,
            "message": message,
            "detail": detail or {},
        },
    }, status_code=status_code)


def get_current_user_from_header(x_user_id: Optional[int] = Parameter(default=None, header="X-User-Id")) -> Optional[dict]:
    if not x_user_id:
        return None
    with get_connection() as conn:
        return repo.get_current_user(conn, x_user_id)


class AuthController(Controller):
    path = "/api/auth"

    @post("/login")
    async def login(self, data: LoginRequest) -> Response:
        with get_connection() as conn:
            user = repo.get_user_by_username(conn, data.username)
        if not user or user["password"] != data.password:
            return err_response("用户名或密码错误", "E_LOGIN_FAIL", "权限问题", status_code=HTTP_401_UNAUTHORIZED)
        return json_response({
            "success": True,
            "user": {
                "id": user["id"],
                "username": user["username"],
                "real_name": user["real_name"],
                "role": user["role"],
            },
            "token": f"user-{user['id']}",
        })

    @get("/users")
    async def list_users(self) -> Response:
        with get_connection() as conn:
            users = [row2dict(r) for r in conn.execute("SELECT id, username, real_name, role FROM users ORDER BY id").fetchall()]
        return json_response({"success": True, "data": users})


class CustomerController(Controller):
    path = "/api/customers"

    @get()
    async def list(self, keyword: Optional[str] = None) -> Response:
        with get_connection() as conn:
            data = repo.list_customers(conn, keyword or "")
        return json_response({"success": True, "data": data})

    @get("/{customer_id:int}")
    async def detail(self, customer_id: int) -> Response:
        with get_connection() as conn:
            data = repo.get_customer(conn, customer_id)
        if not data:
            return err_response("用电客户不存在", "E_NOT_FOUND", "状态问题", status_code=404)
        return json_response({"success": True, "data": data})

    @put("/{customer_id:int}")
    async def update(self, customer_id: int, data: dict) -> Response:
        user = get_current_user_from_header(data.get("_user_id") if isinstance(data, dict) else None)
        with get_connection() as conn:
            c = repo.update_customer(conn, customer_id, {k: v for k, v in data.items() if k != "_user_id"})
        if not c:
            return err_response("用电客户不存在", "E_NOT_FOUND", "状态问题", status_code=404)
        return json_response({"success": True, "data": c})


class PricingController(Controller):
    path = "/api/pricing"

    @get()
    async def list(self, keyword: Optional[str] = None) -> Response:
        with get_connection() as conn:
            data = repo.list_pricing(conn, keyword or "")
        return json_response({"success": True, "data": data})

    @get("/{pricing_id:int}")
    async def detail(self, pricing_id: int) -> Response:
        with get_connection() as conn:
            data = repo.get_pricing(conn, pricing_id)
        if not data:
            return err_response("报价测算不存在", "E_NOT_FOUND", "状态问题", status_code=404)
        return json_response({"success": True, "data": data})

    @put("/{pricing_id:int}")
    async def update(self, pricing_id: int, data: dict) -> Response:
        with get_connection() as conn:
            p = repo.update_pricing(conn, pricing_id, {k: v for k, v in data.items() if k != "_user_id"})
        if not p:
            return err_response("报价测算不存在", "E_NOT_FOUND", "状态问题", status_code=404)
        return json_response({"success": True, "data": p})


class ContractController(Controller):
    path = "/api/contracts"

    @get()
    async def list(
        self,
        status: Optional[str] = None,
        stage: Optional[str] = None,
        warning_level: Optional[str] = None,
        keyword: Optional[str] = None,
        x_user_id: Optional[int] = Parameter(default=None, header="X-User-Id"),
    ) -> Response:
        my_only = True
        with get_connection() as conn:
            data = repo.list_contracts(
                conn,
                status or "",
                stage or "",
                warning_level or "",
                keyword or "",
                x_user_id if my_only and x_user_id else None,
            )
        return json_response({"success": True, "data": data})

    @get("/stats")
    async def stats(self) -> Response:
        with get_connection() as conn:
            rows = conn.execute("SELECT status, COUNT(*) AS n FROM sale_contracts GROUP BY status").fetchall()
            stats = {r["status"]: r["n"] for r in rows}
            total = sum(stats.values())
            all_items = repo.list_contracts(conn)
            warning_count = sum(1 for i in all_items if i.get("warning_level") == "warning")
            overdue_count = sum(1 for i in all_items if i.get("warning_level") == "overdue")
            normal_count = sum(1 for i in all_items if i.get("warning_level") == "normal")
        return json_response({
            "success": True,
            "data": {
                "by_status": stats,
                "total": total,
                "warning": warning_count,
                "overdue": overdue_count,
                "normal": normal_count,
            },
        })

    @get("/overdue-responsibles")
    async def overdue_responsibles(self) -> Response:
        with get_connection() as conn:
            data = repo.get_overdue_responsibles(conn)
        return json_response({"success": True, "data": data})

    @get("/{contract_id:int}")
    async def detail(self, contract_id: int) -> Response:
        with get_connection() as conn:
            data = repo.get_contract(conn, contract_id)
        if not data:
            return err_response("售电合同单不存在", "E_NOT_FOUND", "状态问题", status_code=404)
        return json_response({"success": True, "data": data})

    @post()
    async def create(self, data: ContractCreate, x_user_id: Optional[int] = Parameter(default=None, header="X-User-Id")) -> Response:
        if not x_user_id:
            return err_response("未登录", "E_UNAUTHORIZED", "权限问题", status_code=HTTP_401_UNAUTHORIZED)
        with get_connection() as conn:
            c = repo.create_contract(conn, data, x_user_id)
        return json_response({"success": True, "data": c})

    @post("/process")
    async def process(self, data: ProcessAction, x_user_id: Optional[int] = Parameter(default=None, header="X-User-Id")) -> Response:
        if not x_user_id:
            return err_response("未登录", "E_UNAUTHORIZED", "权限问题", status_code=HTTP_401_UNAUTHORIZED)
        with get_connection() as conn:
            user = repo.get_current_user(conn, x_user_id)
            if not user:
                return err_response("用户不存在", "E_USER_NOTFOUND", "权限问题", status_code=HTTP_401_UNAUTHORIZED)
            try:
                result = repo.process_contract(conn, data, user)
            except WorkflowException as e:
                return err_response(str(e), e.code, e.exc_type, e.detail)
        return json_response({"success": True, "data": result})

    @post("/batch")
    async def batch(self, data: BatchProcessRequest, x_user_id: Optional[int] = Parameter(default=None, header="X-User-Id")) -> Response:
        if not x_user_id:
            return err_response("未登录", "E_UNAUTHORIZED", "权限问题", status_code=HTTP_401_UNAUTHORIZED)
        with get_connection() as conn:
            user = repo.get_current_user(conn, x_user_id)
            if not user:
                return err_response("用户不存在", "E_USER_NOTFOUND", "权限问题", status_code=HTTP_401_UNAUTHORIZED)
            results = repo.batch_process(conn, data, user)
            dicts = [r.model_dump() for r in results]
        return json_response({"success": True, "data": dicts})

    @post("/{contract_id:int}/attachments")
    async def add_attachment(self, contract_id: int, data: dict, x_user_id: Optional[int] = Parameter(default=None, header="X-User-Id")) -> Response:
        if not x_user_id:
            return err_response("未登录", "E_UNAUTHORIZED", "权限问题", status_code=HTTP_401_UNAUTHORIZED)
        with get_connection() as conn:
            user = repo.get_current_user(conn, x_user_id)
            if not user:
                return err_response("用户不存在", "E_USER_NOTFOUND", "权限问题", status_code=HTTP_401_UNAUTHORIZED)
            atts = repo.add_attachment(
                conn,
                contract_id,
                data.get("file_name", "unnamed"),
                data.get("file_type", ""),
                data.get("file_size", 0),
                user,
            )
        return json_response({"success": True, "data": atts})


def create_app() -> Litestar:
    cors_config = CORSConfig(
        allow_origins=settings.CORS_ORIGINS,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        allow_credentials=True,
    )

    router = Router(
        path="/",
        route_handlers=[
            AuthController,
            CustomerController,
            PricingController,
            ContractController,
        ],
    )

    @get("/api/health")
    async def health() -> Response:
        return json_response({"success": True, "service": "electric-contract-backend", "port": settings.BACKEND_PORT})

    @get("/")
    async def index() -> Response:
        return json_response({
            "service": "售电公司月底集中处理售电合同单系统",
            "version": "1.0.0",
            "backend_port": settings.BACKEND_PORT,
            "frontend_port": settings.FRONTEND_PORT,
            "api_docs": f"{settings.BACKEND_URL}/schema",
        })

    app = Litestar(
        route_handlers=[router, health, index],
        cors_config=cors_config,
        debug=True,
    )

    init_database()
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.BACKEND_PORT,
        reload=True,
    )

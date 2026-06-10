from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from .constants import Role, ROLE_NAMES


DEMO_USERS = {
    "registrar": {"username": "registrar", "name": "李管家", "role": Role.REGISTRAR},
    "supervisor": {"username": "supervisor", "name": "王主管", "role": Role.SUPERVISOR},
    "reviewer": {"username": "reviewer", "name": "张经理", "role": Role.REVIEWER},
}


def get_current_user(request: Request):
    role = request.headers.get("X-User-Role")
    username = request.headers.get("X-User-Name")
    name = request.headers.get("X-User-Real-Name")
    if not role or role not in [Role.REGISTRAR, Role.SUPERVISOR, Role.REVIEWER]:
        return None
    return {
        "username": username or DEMO_USERS.get(role, {}).get("username", role),
        "name": name or DEMO_USERS.get(role, {}).get("name", ROLE_NAMES.get(role, role)),
        "role": role,
    }


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in ["/api/users", "/api/health", "/"] or request.method == "OPTIONS":
            return await call_next(request)
        user = get_current_user(request)
        if not user:
            return JSONResponse(
                status_code=401,
                content={"detail": "未授权或角色无效，请通过角色切换登录"},
            )
        request.state.user = user
        return await call_next(request)

from litestar import Request
from litestar.datastructures import Headers
from litestar.enums import MediaType
from litestar.exceptions import HTTPException
from litestar.status_codes import HTTP_401_UNAUTHORIZED
from litestar.types import ASGIApp, Receive, Scope, Send
from litestar.response import Response

from app.auth import get_user_from_token
from app.database import SessionLocal


def auth_middleware(app: ASGIApp) -> ASGIApp:
    async def middleware(scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await app(scope, receive, send)
            return

        path = scope.get("path", "")
        if (
            path in ("/api/auth/login", "/api/health")
            or path.startswith("/api/schema")
            or path.startswith("/schema")
            or path.startswith("/static")
        ):
            await app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        auth_header = headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            response = Response(
                content={
                    "detail": "未授权：缺少有效的认证令牌",
                    "status_code": HTTP_401_UNAUTHORIZED,
                    "error_code": "unauthorized",
                },
                status_code=HTTP_401_UNAUTHORIZED,
                media_type=MediaType.JSON,
            )
            await response(scope, receive, send)
            return

        token = auth_header[7:]
        db = SessionLocal()
        try:
            user = get_user_from_token(db, token)
            if not user:
                response = Response(
                    content={
                        "detail": "未授权：令牌无效或已过期",
                        "status_code": HTTP_401_UNAUTHORIZED,
                        "error_code": "unauthorized",
                    },
                    status_code=HTTP_401_UNAUTHORIZED,
                    media_type=MediaType.JSON,
                )
                await response(scope, receive, send)
                return

            scope["user"] = user
            await app(scope, receive, send)
        finally:
            db.close()

    return middleware


def get_current_user(request: Request):
    return request.scope.get("user")

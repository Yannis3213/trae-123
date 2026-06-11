from litestar import Litestar, Request
from litestar.middleware import AbstractMiddleware
from litestar.datastructures import Headers
from litestar.enums import MediaType
from litestar.exceptions import HTTPException
from litestar.status_codes import HTTP_401_UNAUTHORIZED
from litestar.types import ASGIApp, Receive, Scope, Send

from app.auth import get_user_from_token
from app.database import SessionLocal


class AuthMiddleware(AbstractMiddleware):
    async def __call__(self, scope: Scope, receive: Receive, send: Send, app: ASGIApp) -> None:
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
            response = HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="未授权：缺少有效的认证令牌")
            await self.send_response(scope, receive, send, response)
            return

        token = auth_header[7:]
        db = SessionLocal()
        try:
            user = get_user_from_token(db, token)
            if not user:
                response = HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="未授权：令牌无效或已过期")
                await self.send_response(scope, receive, send, response)
                return

            scope["user"] = user
            await app(scope, receive, send)
        finally:
            db.close()

    async def send_response(self, scope, receive, send, exc: HTTPException):
        from litestar.response import Response
        import json

        response = Response(
            content={"detail": exc.detail, "status_code": exc.status_code},
            status_code=exc.status_code,
            media_type=MediaType.JSON,
        )
        await response(scope, receive, send)


def get_current_user(request: Request):
    return request.scope.get("user")

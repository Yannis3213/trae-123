from typing import Optional
from litestar.connection import ASGIConnection
from litestar.exceptions import NotAuthorizedException
from litestar.handlers.base import BaseRouteHandler

from auth import decode_token
from database import SessionLocal
from models import User


def get_db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(connection: ASGIConnection) -> User:
    auth_header = connection.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise NotAuthorizedException("缺少认证令牌")

    token = auth_header.split(" ")[1]
    payload = decode_token(token)
    if not payload:
        raise NotAuthorizedException("认证令牌无效或已过期")

    username = payload.get("sub")
    if not username:
        raise NotAuthorizedException("认证令牌无效")

    db = next(get_db_session())
    user = db.query(User).filter(User.username == username).first()
    db.close()
    if not user:
        raise NotAuthorizedException("用户不存在")

    return user


def require_roles(*roles: str):
    def guard(connection: ASGIConnection, _: BaseRouteHandler) -> None:
        user: User = get_current_user(connection)
        if user.role not in roles:
            raise NotAuthorizedException(f"权限不足，需要角色: {', '.join(roles)}")
    return guard

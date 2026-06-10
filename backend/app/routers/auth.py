from datetime import timedelta
from litestar import Router, get, post
from litestar.connection import ASGIConnection
from litestar.exceptions import NotAuthorizedException

from ..config import settings
from ..database import get_db
from ..models import User
from ..schemas import LoginRequest, Token, UserOut
from ..auth import authenticate_user, create_access_token


@post("/login")
async def login(data: LoginRequest) -> Token:
    db = next(get_db())
    try:
        user = authenticate_user(db, data.username, data.password)
        if not user:
            raise NotAuthorizedException("用户名或密码错误")

        access_token = create_access_token(
            data={"sub": user.username, "role": user.role.value},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        return Token(
            access_token=access_token,
            token_type="bearer",
            user=UserOut.model_validate(user)
        )
    finally:
        db.close()


@get("/me")
async def get_current_user(connection: ASGIConnection) -> UserOut:
    user: User | None = connection.user
    if not user:
        raise NotAuthorizedException("未登录")
    return UserOut.model_validate(user)


auth_router = Router(
    path="/auth",
    route_handlers=[login, get_current_user]
)

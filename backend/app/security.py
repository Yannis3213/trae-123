from litestar.connection import ASGIConnection
from litestar.security.jwt import JWTAuth, Token

from .config import settings
from .database import get_db
from .models import User
from .auth import get_user_from_token


def retrieve_user_handler(token: Token, connection: ASGIConnection) -> User | None:
    db = next(get_db())
    try:
        user = get_user_from_token(db, token.encode())
        return user
    finally:
        db.close()


jwt_auth = JWTAuth[User](
    retrieve_user_handler=retrieve_user_handler,
    token_secret=settings.SECRET_KEY,
    algorithm=settings.ALGORITHM,
    exclude=[
        "/schema",
        "/health",
        "/auth/login",
        "/openapi.json",
        "/openapi.yaml",
        "/redoc",
        "/elements",
        "/swagger",
    ],
)

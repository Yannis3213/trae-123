from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from starlette.requests import Request
from starlette.responses import JSONResponse
from functools import wraps
import os

SECRET_KEY = os.environ.get("SECRET_KEY", "bank-month-end-secret-key-2024")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ROLE_HIERARCHY = {
    "客户经理": ["客户经理"],
    "运营主管": ["运营主管", "客户经理"],
    "支行行长": ["支行行长", "运营主管", "客户经理"],
}


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return {}


async def get_current_user(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:]
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        return None
    return {
        "username": payload.get("sub"),
        "role": payload.get("role"),
        "real_name": payload.get("real_name"),
        "branch": payload.get("branch"),
    }


def require_role(allowed_roles):
    def decorator(func):
        @wraps(func)
        async def wrapper(request):
            user = await get_current_user(request)
            if not user:
                return JSONResponse({"detail": "未登录或令牌无效"}, status_code=401)
            user_roles = ROLE_HIERARCHY.get(user["role"], [])
            has_permission = any(r in user_roles for r in allowed_roles)
            if not has_permission:
                return JSONResponse({"detail": f"权限不足，需要角色：{allowed_roles}"}, status_code=403)
            request.state.user = user
            return await func(request)
        return wrapper
    return decorator

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
import bcrypt
from .config import get_settings
from .constants import Roles

settings = get_settings()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload
    except JWTError:
        return None


USERS = [
    {
        "username": "registrar1",
        "password": "123456",
        "role": Roles.REGISTRAR,
        "name": "李登记员"
    },
    {
        "username": "supervisor1",
        "password": "123456",
        "role": Roles.AUDIT_SUPERVISOR,
        "name": "王审核主管"
    },
    {
        "username": "leader1",
        "password": "123456",
        "role": Roles.REVIEW_LEADER,
        "name": "张复核负责人"
    }
]


def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    for user in USERS:
        if user["username"] == username:
            return user
    return None


def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    user = get_user_by_username(username)
    if not user:
        return None
    if not verify_password(password, get_password_hash(user["password"])):
        return None
    return user

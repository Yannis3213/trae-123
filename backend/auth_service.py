import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from models import (
    User, TrainingProject, Attachment, ProcessingRecord,
    AuditNote, ExceptionRecord, get_db
)
from schemas import (
    LoginRequest, TrainingProjectCreate, TrainingProjectUpdate,
    ProcessActionRequest, BatchActionRequest, BatchResultItem
)


SECRET_KEY = "training-project-secret-key-2024"


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hash_str: str) -> bool:
    return hash_password(password) == hash_str


def generate_token(user_id: int, username: str, role: str) -> str:
    payload = f"{user_id}:{username}:{role}:{secrets.token_hex(16)}"
    return secrets.token_urlsafe(32) + "." + payload


tokens = {}


def authenticate(db: Session, req: LoginRequest) -> Optional[User]:
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not user.is_active:
        return None
    if not verify_password(req.password, user.password_hash):
        return None
    return user


def create_session_token(user: User) -> str:
    token = generate_token(user.id, user.username, user.role)
    tokens[token] = {
        "user_id": user.id,
        "username": user.username,
        "role": user.role,
        "created_at": datetime.utcnow().isoformat()
    }
    return token


def get_user_from_token(db: Session, token: str) -> Optional[User]:
    if not token or token not in tokens:
        return None
    data = tokens[token]
    user = db.query(User).filter(User.id == data["user_id"]).first()
    return user if user and user.is_active else None


def logout(token: str):
    if token in tokens:
        del tokens[token]


def user_to_response(user: User, token: str = "") -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "role_name": User.ROLE_NAMES.get(user.role, user.role),
        "department": user.department,
        "token": token
    }


def user_simple_response(user: Optional[User]) -> Optional[dict]:
    if not user:
        return None
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "role_name": User.ROLE_NAMES.get(user.role, user.role)
    }

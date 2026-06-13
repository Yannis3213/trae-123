from sqlalchemy.orm import Session
from models import User
from typing import Optional
import hashlib

ROLE_REGISTRAR = "REGISTRAR"
ROLE_AUDITOR = "AUDITOR"
ROLE_REVIEWER = "REVIEWER"

STATUS_PENDING_SUBMIT = "PENDING_SUBMIT"
STATUS_PENDING_AUDIT = "PENDING_AUDIT"
STATUS_PENDING_REVIEW = "PENDING_REVIEW"
STATUS_AUDITED_PASSED = "AUDITED_PASSED"
STATUS_RETURNED = "RETURNED"
STATUS_SYNCED = "SYNCED"


STATUS_DISPLAY = {
    STATUS_PENDING_SUBMIT: "待提交",
    STATUS_PENDING_AUDIT: "待审核",
    STATUS_PENDING_REVIEW: "待复核",
    STATUS_AUDITED_PASSED: "审核通过",
    STATUS_RETURNED: "退回补正",
    STATUS_SYNCED: "已同步",
}

ROLE_DISPLAY = {
    ROLE_REGISTRAR: "护登记员",
    ROLE_AUDITOR: "照护审核主管",
    ROLE_REVIEWER: "养老护理院复核负责人",
}


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(plain: str, hashed: str) -> bool:
    return hash_password(plain) == hashed


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    user = get_user_by_username(db, username)
    if not user:
        return None
    if not verify_password(password, user.password):
        return None
    return user


def generate_token(user: User) -> str:
    return f"tk_{user.id}_{user.role}_{user.username}"


def parse_token(token: str) -> Optional[dict]:
    if not token or not token.startswith("tk_"):
        return None
    parts = token.split("_")
    if len(parts) < 3:
        return None
    return {"id": int(parts[1]), "role": parts[2], "username": parts[3] if len(parts) > 3 else ""}

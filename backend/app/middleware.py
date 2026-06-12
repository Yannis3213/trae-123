from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp
from typing import List, Optional
from .security import decode_token
from .constants import Roles, ApplicationStatus, Actions, WarningLevel
from datetime import datetime, timedelta
import json


class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, exclude_paths: Optional[List[str]] = None):
        super().__init__(app)
        self.exclude_paths = exclude_paths or ["/api/auth/login", "/health", "/docs", "/openapi.json"]

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        for exclude in self.exclude_paths:
            if path.startswith(exclude) or path == exclude:
                return await call_next(request)

        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "未提供有效的认证令牌"}
            )

        token = auth_header.replace("Bearer ", "")
        payload = decode_token(token)

        if not payload:
            return JSONResponse(
                status_code=401,
                content={"detail": "认证令牌无效或已过期"}
            )

        request.state.user = {
            "username": payload.get("sub"),
            "role": payload.get("role"),
            "name": payload.get("name"),
            "id": payload.get("id")
        }

        return await call_next(request)


def role_required(allowed_roles: List[str]):
    def decorator(func):
        async def wrapper(request: Request, *args, **kwargs):
            user = getattr(request.state, "user", None)
            if not user:
                return JSONResponse(status_code=401, content={"detail": "未认证"})

            if user["role"] not in allowed_roles:
                return JSONResponse(
                    status_code=403,
                    content={"detail": f"权限不足，需要角色: {allowed_roles}"}
                )

            return await func(request, *args, **kwargs)
        return wrapper
    return decorator


def check_state_conflict(current_status: str, target_action: str, user_role: str) -> tuple[bool, Optional[str], Optional[str]]:
    allowed_transitions = {
        ApplicationStatus.DRAFT: {
            Roles.REGISTRAR: [Actions.SUBMIT]
        },
        ApplicationStatus.PENDING_AUDIT: {
            Roles.REGISTRAR: [Actions.CORRECT],
            Roles.AUDIT_SUPERVISOR: [Actions.APPROVE_AUDIT, Actions.REJECT_AUDIT, Actions.RETURN_FOR_CORRECTION]
        },
        ApplicationStatus.CORRECTION_REQUIRED: {
            Roles.REGISTRAR: [Actions.CORRECT]
        },
        ApplicationStatus.PENDING_REVIEW: {
            Roles.REVIEW_LEADER: [Actions.APPROVE_REVIEW, Actions.RETURN_FOR_CORRECTION]
        },
        ApplicationStatus.PENDING_BOOTH_CONFIRM: {
            Roles.REVIEW_LEADER: [Actions.CONFIRM_BOOTH, Actions.RETURN_FOR_CORRECTION]
        },
        ApplicationStatus.AUDIT_PASSED: {
            Roles.REVIEW_LEADER: [Actions.CONFIRM_BOOTH]
        },
        ApplicationStatus.BOOTH_CONFIRMED: {
            Roles.REVIEW_LEADER: [Actions.ARCHIVE]
        },
        ApplicationStatus.ARCHIVED: {
            Roles.REVIEW_LEADER: [Actions.SYNC]
        }
    }

    if current_status not in allowed_transitions:
        return False, "INVALID_STATUS", f"当前状态 [{current_status}] 不允许任何操作"

    role_actions = allowed_transitions[current_status]
    if user_role not in role_actions:
        return False, "PERMISSION_DENIED", f"角色 [{user_role}] 在当前状态下无操作权限"

    if target_action not in role_actions[user_role]:
        return False, "INVALID_ACTION", f"操作 [{target_action}] 在当前状态下不被允许"

    return True, None, None


def get_next_status(action: str) -> Optional[str]:
    action_to_status = {
        Actions.SUBMIT: ApplicationStatus.PENDING_AUDIT,
        Actions.CORRECT: ApplicationStatus.PENDING_AUDIT,
        Actions.APPROVE_AUDIT: ApplicationStatus.PENDING_REVIEW,
        Actions.REJECT_AUDIT: ApplicationStatus.REJECTED,
        Actions.RETURN_FOR_CORRECTION: ApplicationStatus.CORRECTION_REQUIRED,
        Actions.APPROVE_REVIEW: ApplicationStatus.PENDING_BOOTH_CONFIRM,
        Actions.CONFIRM_BOOTH: ApplicationStatus.BOOTH_CONFIRMED,
        Actions.ARCHIVE: ApplicationStatus.ARCHIVED,
        Actions.SYNC: ApplicationStatus.SYNCED
    }
    return action_to_status.get(action)


def get_target_queue(action: str) -> Optional[str]:
    action_to_queue = {
        Actions.SUBMIT: Roles.QUEUES[Roles.AUDIT_SUPERVISOR],
        Actions.CORRECT: Roles.QUEUES[Roles.AUDIT_SUPERVISOR],
        Actions.APPROVE_AUDIT: Roles.QUEUES[Roles.REVIEW_LEADER],
        Actions.RETURN_FOR_CORRECTION: Roles.QUEUES[Roles.REGISTRAR],
        Actions.APPROVE_REVIEW: Roles.QUEUES[Roles.REVIEW_LEADER],
        Actions.CONFIRM_BOOTH: Roles.QUEUES[Roles.REVIEW_LEADER],
        Actions.ARCHIVE: Roles.QUEUES[Roles.REVIEW_LEADER],
        Actions.SYNC: Roles.QUEUES[Roles.REVIEW_LEADER]
    }
    return action_to_queue.get(action)


def get_target_handler(action: str) -> Optional[str]:
    action_to_handler = {
        Actions.SUBMIT: "supervisor1",
        Actions.CORRECT: "supervisor1",
        Actions.APPROVE_AUDIT: "leader1",
        Actions.RETURN_FOR_CORRECTION: "registrar1",
        Actions.APPROVE_REVIEW: "leader1",
        Actions.CONFIRM_BOOTH: "leader1",
        Actions.ARCHIVE: "leader1",
        Actions.SYNC: "leader1"
    }
    return action_to_handler.get(action)


def calculate_warning_level(deadline: Optional[datetime]) -> tuple[str, bool]:
    if not deadline:
        return WarningLevel.NORMAL, False

    now = datetime.now()
    is_overdue = now > deadline

    if is_overdue:
        return WarningLevel.OVERDUE, True

    time_left = deadline - now
    if time_left <= timedelta(days=1):
        return WarningLevel.APPROACHING, False

    return WarningLevel.NORMAL, False

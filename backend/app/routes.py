from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route, Mount
from starlette.middleware.cors import CORSMiddleware
import json
from datetime import timedelta

from .config import get_settings
from .security import authenticate_user, create_access_token
from .services import (
    create_application,
    get_application_list,
    get_application_detail,
    get_processing_records,
    get_attachments,
    get_audit_notes,
    get_statistics,
    execute_action,
    execute_batch_action,
    add_audit_note,
    get_user_info
)
from .schemas import (
    LoginRequest,
    ApplicationCreate,
    ApplicationUpdate,
    ActionRequest,
    BatchActionRequest
)
from .constants import Roles, ApplicationStatus, WarningLevel
from .database import get_db

settings = get_settings()


async def health_check(request: Request):
    return JSONResponse({
        "status": "ok",
        "app_name": settings.app_name,
        "backend_port": settings.backend_port
    })


async def login(request: Request):
    try:
        body = await request.json()
        data = LoginRequest(**body)
    except Exception:
        return JSONResponse(status_code=400, content={"detail": "请求参数错误"})

    user = authenticate_user(data.username, data.password)
    if not user:
        return JSONResponse(status_code=401, content={"detail": "用户名或密码错误"})

    db_gen = get_db()
    db = await anext(db_gen)
    try:
        user_info = await get_user_info(db, user["username"])
    finally:
        try:
            await anext(db_gen)
        except StopAsyncIteration:
            pass

    if not user_info:
        return JSONResponse(status_code=401, content={"detail": "用户不存在"})

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={
            "sub": user_info["username"],
            "role": user_info["role"],
            "name": user_info["name"],
            "id": user_info["id"]
        },
        expires_delta=access_token_expires
    )

    return JSONResponse({
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user_info["id"],
            "username": user_info["username"],
            "role": user_info["role"],
            "name": user_info["name"],
            "role_name": Roles.ROLE_NAMES.get(user_info["role"], user_info["role"])
        }
    })


async def get_current_user(request: Request):
    user = request.state.user
    return JSONResponse({
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "name": user["name"],
        "role_name": Roles.ROLE_NAMES.get(user["role"], user["role"])
    })


async def get_constants(request: Request):
    return JSONResponse({
        "roles": {
            "items": [
                {"value": k, "label": v} for k, v in Roles.ROLE_NAMES.items()
            ]
        },
        "queues": {
            "items": [
                {"value": k, "label": v} for k, v in Roles.QUEUE_NAMES.items()
            ]
        },
        "statuses": {
            "items": [
                {"value": k, "label": v} for k, v in ApplicationStatus.STATUS_NAMES.items()
            ]
        },
        "warning_levels": {
            "items": [
                {"value": k, "label": v} for k, v in WarningLevel.LEVEL_NAMES.items()
            ]
        },
        "stat_groups": {
            "items": [
                {"value": k, "label": v} for k, v in ApplicationStatus.GROUP_NAMES.items()
            ]
        }
    })


async def list_applications(request: Request):
    user = request.state.user
    params = request.query_params

    db_gen = get_db()
    db = await anext(db_gen)
    try:
        applications, total = await get_application_list(
            db,
            user_role=user["role"],
            username=user["username"],
            status=params.get("status"),
            queue=params.get("queue"),
            warning_level=params.get("warning_level"),
            stat_group=params.get("stat_group"),
            keyword=params.get("keyword"),
            page=int(params.get("page", 1)),
            page_size=int(params.get("page_size", 20))
        )

        return JSONResponse({
            "items": applications,
            "total": total,
            "page": int(params.get("page", 1)),
            "page_size": int(params.get("page_size", 20))
        })
    finally:
        try:
            await anext(db_gen)
        except StopAsyncIteration:
            pass


async def create_new_application(request: Request):
    user = request.state.user
    try:
        body = await request.json()
        data = ApplicationCreate(**body)
    except Exception as e:
        return JSONResponse(status_code=400, content={"detail": f"请求参数错误: {str(e)}"})

    db_gen = get_db()
    db = await anext(db_gen)
    try:
        application = await create_application(db, data, user["username"])
        return JSONResponse(application, status_code=201)
    finally:
        try:
            await anext(db_gen)
        except StopAsyncIteration:
            pass


async def get_application(request: Request):
    app_id = int(request.path_params["id"])

    db_gen = get_db()
    db = await anext(db_gen)
    try:
        application = await get_application_detail(db, app_id)
        if not application:
            return JSONResponse(status_code=404, content={"detail": "展商申请不存在"})

        records = await get_processing_records(db, app_id)
        attachments = await get_attachments(db, app_id)
        notes = await get_audit_notes(db, app_id)

        return JSONResponse({
            "application": application,
            "processing_records": records,
            "attachments": attachments,
            "audit_notes": notes
        })
    finally:
        try:
            await anext(db_gen)
        except StopAsyncIteration:
            pass


async def perform_action(request: Request):
    user = request.state.user
    app_id = int(request.path_params["id"])

    try:
        body = await request.json()
        data = ActionRequest(**body)
    except Exception as e:
        return JSONResponse(status_code=400, content={"detail": f"请求参数错误: {str(e)}"})

    db_gen = get_db()
    db = await anext(db_gen)
    try:
        success, error_code, error_msg, application = await execute_action(
            db, app_id, data, user
        )

        if not success:
            return JSONResponse(status_code=400, content={
                "detail": error_msg,
                "error_code": error_code
            })

        records = await get_processing_records(db, app_id)

        return JSONResponse({
            "application": application,
            "processing_records": records
        })
    finally:
        try:
            await anext(db_gen)
        except StopAsyncIteration:
            pass


async def batch_action(request: Request):
    user = request.state.user

    try:
        body = await request.json()
        data = BatchActionRequest(**body)
    except Exception as e:
        return JSONResponse(status_code=400, content={"detail": f"请求参数错误: {str(e)}"})

    if len(data.application_ids) == 0:
        return JSONResponse(status_code=400, content={"detail": "请选择要处理的申请"})

    db_gen = get_db()
    db = await anext(db_gen)
    try:
        result = await execute_batch_action(db, data, user)
        return JSONResponse(result.model_dump())
    finally:
        try:
            await anext(db_gen)
        except StopAsyncIteration:
            pass


async def get_app_statistics(request: Request):
    user = request.state.user

    db_gen = get_db()
    db = await anext(db_gen)
    try:
        stats = await get_statistics(db, user["role"], user["username"])
        return JSONResponse(stats)
    finally:
        try:
            await anext(db_gen)
        except StopAsyncIteration:
            pass


async def add_note(request: Request):
    user = request.state.user
    app_id = int(request.path_params["id"])

    try:
        body = await request.json()
        note = body.get("note", "")
    except Exception:
        return JSONResponse(status_code=400, content={"detail": "请求参数错误"})

    if not note or not note.strip():
        return JSONResponse(status_code=400, content={"detail": "备注内容不能为空"})

    db_gen = get_db()
    db = await anext(db_gen)
    try:
        new_note = await add_audit_note(db, app_id, note.strip(), user["username"])
        notes = await get_audit_notes(db, app_id)
        return JSONResponse({
            "note": new_note,
            "audit_notes": notes
        })
    finally:
        try:
            await anext(db_gen)
        except StopAsyncIteration:
            pass


def create_routes():
    return [
        Route("/health", health_check, methods=["GET"]),
        Route("/api/auth/login", login, methods=["POST"]),
        Route("/api/auth/me", get_current_user, methods=["GET"]),
        Route("/api/constants", get_constants, methods=["GET"]),
        Route("/api/applications", list_applications, methods=["GET"]),
        Route("/api/applications", create_new_application, methods=["POST"]),
        Route("/api/applications/{id:int}", get_application, methods=["GET"]),
        Route("/api/applications/{id:int}/action", perform_action, methods=["POST"]),
        Route("/api/applications/{id:int}/notes", add_note, methods=["POST"]),
        Route("/api/batch/action", batch_action, methods=["POST"]),
        Route("/api/statistics", get_app_statistics, methods=["GET"]),
    ]

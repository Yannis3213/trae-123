from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from ..auth import DEMO_USERS
from ..constants import ROLE_NAMES, ROLE_HANDLER_RESPONSIBILITY


async def list_users(request: Request):
    users = []
    for key, u in DEMO_USERS.items():
        users.append({
            **u,
            "role_name": ROLE_NAMES.get(u["role"], u["role"]),
            "responsibility": ROLE_HANDLER_RESPONSIBILITY.get(u["role"], ""),
        })
    return JSONResponse({"users": users})


routes = [
    Route("/api/users", list_users, methods=["GET"]),
]

import os
import uvicorn
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from starlette.routing import Route, Mount
from starlette.requests import Request

from app.config import settings
from app.auth import AuthMiddleware
from app.database import init_db
from app.seed import seed_data
from app.routers import orders as orders_routes
from app.routers import users as users_routes


async def health_check(request: Request):
    return JSONResponse({"status": "ok", "message": "物业服务中心-月底集中处理报修工单系统运行中"})


async def index(request: Request):
    return JSONResponse({
        "name": "物业服务中心-月底集中处理报修工单系统",
        "version": "1.0.0",
        "api": "/api",
        "docs": "请使用前端界面访问系统"
    })


all_routes = [
    Route("/", index, methods=["GET"]),
    Route("/api/health", health_check, methods=["GET"]),
    *orders_routes.routes,
    *users_routes.routes,
]

middleware = [
    Middleware(CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    ),
    Middleware(AuthMiddleware),
]

app = Starlette(debug=True, routes=all_routes, middleware=middleware)


@app.on_event("startup")
async def startup():
    print(f"[启动中，正在初始化数据库...")
    init_db()
    print("数据库初始化完成，正在载入演示数据...")
    seed_data()
    print(f"系统启动完成，监听端口 {settings.BACKEND_PORT}")


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.BACKEND_PORT,
        reload=True,
    )

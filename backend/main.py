from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from models import init_db, SessionLocal
from routers import auth as auth_router_module
from routers import projects as project_router_module
from init_data import seed_demo_data
import os


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="企业培训公司-月底集中处理培训项目单系统",
    description="多角色流转：课程顾问→讲师运营→项目经理",
    version="1.0.0",
    lifespan=lifespan
)

FRONTEND_PORT = os.environ.get("FRONTEND_PORT", "3106")
BACKEND_PORT = int(os.environ.get("BACKEND_PORT", "8106"))

origins = [
    f"http://localhost:{FRONTEND_PORT}",
    f"http://127.0.0.1:{FRONTEND_PORT}",
    f"http://0.0.0.0:{FRONTEND_PORT}",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router_module.router)
app.include_router(project_router_module.router)


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "training-project-backend",
        "frontend_port": FRONTEND_PORT,
        "backend_port": BACKEND_PORT
    }


@app.get("/")
def root():
    return {
        "name": "企业培训公司-月底集中处理培训项目单系统 API",
        "docs": "/docs",
        "health": "/api/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=BACKEND_PORT,
        reload=True
    )

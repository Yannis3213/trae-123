import os

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from database import engine, SessionLocal, Base
from seed import seed_demo_data
from routers import auth, inspections, charging_pile_inspections, fault_reports, expiry_queue

load_dotenv()

FRONTEND_PORT = os.getenv("FRONTEND_PORT", "3000")
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))

app = FastAPI(title="新能源汽车充电站设备巡检单管理系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[f"http://localhost:{FRONTEND_PORT}"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(inspections.router, prefix="/api")
app.include_router(charging_pile_inspections.router, prefix="/api")
app.include_router(fault_reports.router, prefix="/api")
app.include_router(expiry_queue.router, prefix="/api")


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=BACKEND_PORT, reload=True)

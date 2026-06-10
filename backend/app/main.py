import os
from litestar import Litestar, get
from litestar.config.cors import CORSConfig
from litestar.openapi import OpenAPIConfig
from litestar.logging import LoggingConfig

from .config import settings
from .database import SessionLocal
from .seed import seed_database
from .routers.auth import auth_router, jwt_auth
from .routers.orders import orders_router


@get("/health")
async def health_check() -> dict:
    return {"status": "ok", "app": settings.APP_NAME}


def create_app() -> Litestar:
    cors_config = CORSConfig(
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app = Litestar(
        route_handlers=[health_check, auth_router, orders_router],
        cors_config=cors_config,
        on_app_init=[jwt_auth.on_app_init],
        openapi_config=OpenAPIConfig(
            title=settings.APP_NAME,
            version="1.0.0",
            description="生鲜超市月底集中处理生鲜采购单系统 API",
        ),
        logging_config=LoggingConfig(
            loggers={
                "litestar": {"level": "INFO"},
                "sqlalchemy": {"level": "WARNING"},
            }
        ),
    )
    return app


app = create_app()


def init_and_seed():
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()


if __name__ == "__main__":
    import uvicorn
    init_and_seed()
    uvicorn.run(
        "backend.app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("BACKEND_PORT", settings.BACKEND_PORT)),
        reload=True,
    )

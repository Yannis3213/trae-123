from litestar import Litestar, Request, get
from litestar.config.cors import CORSConfig
from litestar.enums import MediaType
from litestar.exceptions import HTTPException
from litestar.openapi import OpenAPIConfig
from litestar.response import Response

from app.config import settings
from app.database import Base, engine
from app.exceptions import BusinessException
from app.middleware import auth_middleware
from app.routes.auth import AuthController
from app.routes.enrollments import EnrollmentController


@get("/health")
async def health_check() -> dict:
    return {"status": "ok"}


def business_exception_handler(request: Request, exc: BusinessException) -> Response:
    return Response(
        content={
            "detail": exc.detail,
            "status_code": exc.status_code,
            "error_code": exc.error_code,
        },
        status_code=exc.status_code,
        media_type=MediaType.JSON,
    )


def http_exception_handler(request: Request, exc: HTTPException) -> Response:
    return Response(
        content={
            "detail": exc.detail,
            "status_code": exc.status_code,
            "error_code": "business_error",
        },
        status_code=exc.status_code,
        media_type=MediaType.JSON,
    )


def create_app() -> Litestar:
    Base.metadata.create_all(bind=engine)

    cors_config = CORSConfig(
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        allow_credentials=True,
    )

    openapi_config = OpenAPIConfig(
        title="社区健身房会员入会单系统 API",
        version="1.0.0",
        description="月底集中处理会员入会单系统后端接口",
    )

    app = Litestar(
        route_handlers=[health_check, AuthController, EnrollmentController],
        path="/api",
        cors_config=cors_config,
        middleware=[auth_middleware],
        openapi_config=openapi_config,
        exception_handlers={
            BusinessException: business_exception_handler,
            HTTPException: http_exception_handler,
        },
    )

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.port, reload=True)

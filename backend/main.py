from litestar import Litestar
from litestar.config.cors import CORSConfig
from litestar.openapi import OpenAPIConfig, OpenAPIController

from config import settings
from routes import auth_router, order_router


class MyOpenAPIController(OpenAPIController):
    path = "/api/schema"


cors_config = CORSConfig(
    allow_origins=[
        f"http://localhost:{settings.FRONTEND_PORT}",
        f"http://127.0.0.1:{settings.FRONTEND_PORT}",
    ],
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=True,
)


app = Litestar(
    route_handlers=[auth_router, order_router],
    cors_config=cors_config,
    openapi_config=OpenAPIConfig(
        title="货运物流公司-月底集中处理运输订单系统",
        version="1.0.0",
        description="运输订单登记、过程核验和复核归档闭环管理系统",
        openapi_controller=MyOpenAPIController,
    ),
    debug=True,
)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.BACKEND_PORT,
        reload=True
    )

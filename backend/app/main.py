from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware import Middleware

from .config import get_settings
from .middleware import AuthMiddleware
from .routes import create_routes

settings = get_settings()

middleware = [
    Middleware(
        CORSMiddleware,
        allow_origins=[
            settings.frontend_url,
            f"http://localhost:{settings.frontend_port}",
            f"http://127.0.0.1:{settings.frontend_port}",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    ),
    Middleware(AuthMiddleware),
]

app = Starlette(
    debug=True,
    routes=create_routes(),
    middleware=middleware,
)

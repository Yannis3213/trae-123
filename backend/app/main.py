from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware

from .routes import routes
from .database import init_db
from .seed import seed_data
from .config import CORS_ALLOW_ORIGINS


middleware = [
    Middleware(
        CORSMiddleware,
        allow_origins=CORS_ALLOW_ORIGINS,
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=True,
    ),
]


def on_startup():
    init_db()
    seed_data()


app = Starlette(
    routes=routes,
    middleware=middleware,
    on_startup=[on_startup],
)

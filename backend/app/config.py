import os

BACKEND_HOST = os.getenv("BACKEND_HOST", "0.0.0.0")
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8101"))

FRONTEND_ORIGIN = os.getenv(
    "FRONTEND_ORIGIN",
    f"http://localhost:31010",
)

CORS_ALLOW_ORIGINS = [FRONTEND_ORIGIN]

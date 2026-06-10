import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    FRONTEND_PORT: int = int(os.getenv("FRONTEND_PORT", "5173"))
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./repair_orders.db")
    CORS_ORIGINS: list[str] = [
        f"http://localhost:{os.getenv('FRONTEND_PORT', '5173')}",
        f"http://127.0.0.1:{os.getenv('FRONTEND_PORT', '5173')}",
    ]

    class Config:
        env_file = ".env"


settings = Settings()

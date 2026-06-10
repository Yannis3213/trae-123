import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "生鲜采购单管理系统"
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8001"))
    FRONTEND_PORT: int = int(os.getenv("FRONTEND_PORT", "8002"))
    DATABASE_URL: str = "sqlite:///./fresh_purchase.db"
    SECRET_KEY: str = "fresh-purchase-super-secret-key-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    @property
    def CORS_ORIGINS(self) -> list[str]:
        return [
            f"http://localhost:{self.FRONTEND_PORT}",
            f"http://127.0.0.1:{self.FRONTEND_PORT}",
        ]

    class Config:
        env_file = ".env"


settings = Settings()

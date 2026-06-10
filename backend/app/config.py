from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    BACKEND_PORT: int = 8004
    FRONTEND_PORT: int = 3004
    FRONTEND_URL: str = f"http://localhost:3004"
    BACKEND_URL: str = f"http://localhost:8004"
    DB_PATH: str = "backend/data/electric_contracts.db"
    CORS_ORIGINS: list[str] = [
        "http://localhost:3004",
        "http://127.0.0.1:3004",
    ]


settings = Settings()

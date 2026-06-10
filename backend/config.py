from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    BACKEND_PORT: int = 8003
    FRONTEND_PORT: int = 3003
    DATABASE_URL: str = "sqlite:///./freight_orders.db"
    SECRET_KEY: str = "freight-logistics-secret-key-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    class Config:
        env_file = ".env"


settings = Settings()

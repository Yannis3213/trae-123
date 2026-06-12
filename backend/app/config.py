from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "展会主办方-月底集中处理展商申请系统"
    frontend_port: int = 3108
    backend_port: int = 8108
    frontend_url: str = "http://localhost:3108"
    backend_url: str = "http://localhost:8108"
    database_url: str = "sqlite:///./data/exhibitor.db"
    secret_key: str = "exhibitor-system-secret-key-2024"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    upload_dir: str = "./uploads"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()

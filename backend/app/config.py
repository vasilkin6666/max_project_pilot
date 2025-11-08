# backend/app/config.py
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    SITE_URL: str
    BACKEND_API_URL: str # Добавлено для бота

    class Config:
        env_file = ".env"

settings = Settings()

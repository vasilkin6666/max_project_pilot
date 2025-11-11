# backend/app/config.py
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    SITE_URL: str
    BACKEND_API_URL: str

    @classmethod
    def parse_env_var(cls, field_name: str, raw_val: str):
        if field_name == "ACCESS_TOKEN_EXPIRE_MINUTES":
            if raw_val == "":
                return 30
            return int(raw_val)
        return raw_val

    class Config:
        env_file = ".env"

settings = Settings()

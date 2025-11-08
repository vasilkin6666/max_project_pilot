from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    BOT_TOKEN: str
    SITE_URL: str
    BACKEND_URL: str
    DATABASE_URL: str

    class Config:
        env_file = ".env"

settings = Settings()

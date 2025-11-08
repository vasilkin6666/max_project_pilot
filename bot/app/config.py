# bot/app/config.py
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    BOT_TOKEN: str
    BACKEND_API_URL: str
    SITE_URL: str = "http://localhost:3000"  # Добавьте эту строку

    class Config:
        env_file = ".env"

settings = Settings()

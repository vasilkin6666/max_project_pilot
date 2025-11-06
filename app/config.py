from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    BOT_TOKEN: str
    APP_HOST: str = "http://localhost:8000"
    APP_PORT: int = 8000
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/db.sqlite3"
    WEBHOOK_PATH: str = "/webhook"

    class Config:
        env_file = ".env"
        case_sensitive = False

    @property
    def WEBHOOK_URL(self) -> str:
        return f"{self.APP_HOST}{self.WEBHOOK_PATH}"

settings = Settings()

from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    BOT_TOKEN: str
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/db.sqlite3"
    WEBHOOK_PATH: str = "/webhook"

    # Единый публичный URL бота
    BOT_PUBLIC_URL: str = "https://your-bot-domain.com"

    # URL мини-приложения
    MINIAPP_URL: str = "https://vasilkin6666.github.io/max_project_pilot/webapp/"

    class Config:
        env_file = ".env"
        case_sensitive = False

    @property
    def WEBHOOK_URL(self) -> str:
        return f"{self.BOT_PUBLIC_URL}{self.WEBHOOK_PATH}"

    @property
    def BOT_DIRECT_API_URL(self) -> str:
        return f"{self.BOT_PUBLIC_URL}/api/direct"

settings = Settings()

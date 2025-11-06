from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    BOT_TOKEN: str
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/db.sqlite3"
    WEBHOOK_PATH: str = "/webhook"

    # Единый публичный URL бота (должен быть доступен из интернета)
    BOT_PUBLIC_URL: str = "https://dully-valued-yak.cloudpub.ru"

    # URL мини-приложения
    MINIAPP_URL: str = "https://max.ru/t44_hakaton_bot?startapp"

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

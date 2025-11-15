from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    BOT_TOKEN: str
    BACKEND_API_URL: str
    MAX_MINI_APP_URL: str = "https://max.ru/t44_hakaton_bot"
    SITE_URL: str = "https://vasilkin6666.github.io/max_project_pilot/web"

    class Config:
        env_file = ".env"

settings = Settings()

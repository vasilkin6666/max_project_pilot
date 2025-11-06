import asyncio
import uvicorn
from app import app
from app.bot import run_bot
from app.config import settings
from app.models import Base
from app.db import engine

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ База данных готова: data/db.sqlite3")

async def main():
    # Создаём таблицы
    await create_tables()

    # Запускаем бота в фоне
    bot_task = asyncio.create_task(run_bot())

    # Запускаем API
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=settings.APP_PORT,
        reload=True,
        log_level="info"
    )
    server = uvicorn.Server(config)

    await asyncio.gather(
        server.serve(),
        bot_task,
        return_exceptions=True
    )

if __name__ == "__main__":
    asyncio.run(main())

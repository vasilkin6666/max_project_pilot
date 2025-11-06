from maxapi import Bot
from app.config import settings
from app.bot.handlers import dp
import asyncio
import logging

logger = logging.getLogger(__name__)

bot = Bot(token=settings.BOT_TOKEN)

async def run_bot():
    """Запуск бота в режиме Long Polling"""
    try:
        logger.info("🚀 Запуск MAX Project Pilot бота...")
        # Убираем параметр drop_pending_updates - его нет в maxapi
        await bot.delete_webhook()
        logger.info("✅ Вебхук удален, запускаем поллинг...")
        await dp.start_polling(bot)
    except Exception as e:
        logger.error(f"❌ Ошибка запуска бота: {e}")
        raise

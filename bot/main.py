import asyncio
from bot import bot, dp
import logging

logging.basicConfig(level=logging.INFO)

async def main():
    await bot.delete_webhook(drop_pending_updates=True)
    print("MAX Pilot Bot запущен")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())

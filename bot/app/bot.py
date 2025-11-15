import asyncio
import logging
from maxapi import Bot, Dispatcher, F
from maxapi.types import MessageCreated, MessageCallback, CallbackButton
from maxapi.utils.inline_keyboard import InlineKeyboardBuilder
from maxapi.filters.command import Command

from app.config import settings
from app.handlers import (
    cmd_start, cmd_help, cmd_create_project, cmd_join_project, cmd_my_projects,
    handle_callback_projects,
    handle_callback_project_summary,
    handle_callback_project_invite,
    handle_callback_project_requests,
    handle_callback_notifications,
    handle_callback_manage_requests,
    handle_callback_request_page,
    handle_callback_approve_request,
    handle_callback_reject_request,
    handle_callback_stats
)

logging.basicConfig(level=logging.INFO)

bot = Bot(token=settings.BOT_TOKEN)
dp = Dispatcher()

# Обработчики команд
@dp.message_created(Command('start'))
async def handle_start(event: MessageCreated):
    await cmd_start(event)

@dp.message_created(Command('help'))
async def handle_help(event: MessageCreated):
    await cmd_help(event)

@dp.message_created(Command('create_project'))
async def handle_create_project(event: MessageCreated):
    await cmd_create_project(event)

@dp.message_created(Command('join'))
async def handle_join_project(event: MessageCreated):
    await cmd_join_project(event)

@dp.message_created(Command('projects'))
async def handle_my_projects(event: MessageCreated):
    await cmd_my_projects(event)

@dp.message_created(Command('stats'))
async def handle_stats(event: MessageCreated):
    await handle_callback_stats(event)

# Обработчики callback'ов
@dp.message_callback(F.callback.payload.startswith("projects"))
async def handle_projects_callback(event: MessageCallback):
    await handle_callback_projects(event)

@dp.message_callback(F.callback.payload.startswith("project_summary:"))
async def handle_project_summary_callback(event: MessageCallback):
    await handle_callback_project_summary(event)

@dp.message_callback(F.callback.payload.startswith("project_invite:"))
async def handle_project_invite_callback(event: MessageCallback):
    await handle_callback_project_invite(event)

@dp.message_callback(F.callback.payload.startswith("project_requests:"))
async def handle_project_requests_callback(event: MessageCallback):
    await handle_callback_project_requests(event)

@dp.message_callback(F.callback.payload.startswith("notifications"))
async def handle_notifications_callback(event: MessageCallback):
    await handle_callback_notifications(event)

@dp.message_callback(F.callback.payload == "manage_requests")
async def handle_manage_requests_callback(event: MessageCallback):
    await handle_callback_manage_requests(event)

@dp.message_callback(F.callback.payload.startswith("request_page:"))
async def handle_request_page_callback(event: MessageCallback):
    await handle_callback_request_page(event)

@dp.message_callback(F.callback.payload.startswith("approve_request:"))
async def handle_approve_request_callback(event: MessageCallback):
    await handle_callback_approve_request(event)

@dp.message_callback(F.callback.payload.startswith("reject_request:"))
async def handle_reject_request_callback(event: MessageCallback):
    await handle_callback_reject_request(event)

@dp.message_callback(F.callback.payload == "stats")
async def handle_stats_callback(event: MessageCallback):
    await handle_callback_stats(event)

# Обработчик для открытия веб-приложения
@dp.message_callback(F.callback.payload.startswith("open_webapp:"))
async def handle_open_webapp(event: MessageCallback):
    webapp_url = event.callback.payload.replace("open_webapp:", "")
    await event.answer(notification=f"🌐 Открываю веб-приложение...")

# Универсальный обработчик для неизвестных команд
@dp.message_created()
async def handle_unknown_message(event: MessageCreated):
    text = event.message.body.text
    if text and not text.startswith('/'):
        await event.message.answer(
            "🤖 Я не понимаю эту команду. Используйте /help для списка команд."
        )

async def main():
    logging.info("Starting MAX Project Pilot Bot...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())

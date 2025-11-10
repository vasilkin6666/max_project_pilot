# bot/app/bot.py
import asyncio
import logging
from maxapi import Bot, Dispatcher
from maxapi.types import MessageCreated, MessageCallback, CallbackButton
from maxapi.utils.inline_keyboard import InlineKeyboardBuilder
from maxapi.filters.command import Command

from app.config import settings
from app.handlers import (
    cmd_start, cmd_help, cmd_create_project, cmd_join_project,
    handle_callback_projects,
    handle_callback_project_summary,
    handle_callback_project_invite,
    handle_callback_project_requests,
    handle_callback_notifications
)

logging.basicConfig(level=logging.INFO)

bot = Bot(token=settings.BOT_TOKEN)
dp = Dispatcher()

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

async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())

# bot/app/bot.py
import asyncio
from maxapi import Max, MessageCreated, Command, F
from app.config import settings
from app.handlers import (
    cmd_start, cmd_create_project, cmd_join_project,
    handle_callback_create_project_start,
    handle_callback_projects,
    handle_callback_project_summary,
    handle_callback_project_invite,
    handle_callback_project_requests,
    handle_callback_notifications
)

bot = Max(token=settings.BOT_TOKEN)

@bot.message_created(Command('start'))
async def handle_start(event: MessageCreated):
    await cmd_start(event)

@bot.message_created(Command('create_project'))
async def handle_create_project(event: MessageCreated):
    await cmd_create_project(event)

@bot.message_created(Command('join'))
async def handle_join_project(event: MessageCreated):
    await cmd_join_project(event)

@bot.message_callback(F.payload.startswith("projects"))
async def handle_projects_callback(event: MessageCallback):
    await handle_callback_projects(event)

@bot.message_callback(F.payload.startswith("project_summary:"))
async def handle_project_summary_callback(event: MessageCallback):
    await handle_callback_project_summary(event)

@bot.message_callback(F.payload.startswith("project_invite:"))
async def handle_project_invite_callback(event: MessageCallback):
    await handle_callback_project_invite(event)

@bot.message_callback(F.payload.startswith("project_requests:"))
async def handle_project_requests_callback(event: MessageCallback):
    await handle_callback_project_requests(event)

@bot.message_callback(F.payload.startswith("notifications"))
async def handle_notifications_callback(event: MessageCallback):
    await handle_callback_notifications(event)

@bot.message_callback(F.payload.startswith("create_project_start"))
async def handle_create_start_callback(event: MessageCallback):
    await handle_callback_create_project_start(event)

if __name__ == "__main__":
    bot.run()

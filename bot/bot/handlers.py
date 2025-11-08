from maxapi import Dispatcher, F
from maxapi.filters import Command
from maxapi.types import MessageCreated, CallbackButton
from maxapi.utils.inline_keyboard import InlineKeyboardBuilder
import httpx
import os

dp = Dispatcher()
BACKEND = os.getenv("BACKEND_URL")
SITE_URL = os.getenv("SITE_URL")

@dp.message_created(Command("start"))
async def start(event: MessageCreated):
    user_id = str(event.from_user.user_id)
    await httpx.post(f"{BACKEND}/api/users", json={"max_id": user_id})
    builder = InlineKeyboardBuilder()
    builder.row(CallbackButton("Открыть MAX Pilot", url=f"{SITE_URL}/?user_id={user_id}"))
    await event.answer(
        "MAX Pilot v4.0\n"
        "Проекты, задачи, QR, Pomodoro — всё в MAX.",
        reply_markup=builder
    )

@dp.message_created(Command("project"))
async def create_project(event: MessageCreated):
    title = " ".join(event.text.split()[1:]) or "Новый проект"
    data = await httpx.post(f"{BACKEND}/api/projects", params={
        "title": title,
        "user_id": event.from_user.user_id
    }).json()
    await event.answer(f"Проект создан!\n{data['project']['invite_link']}")

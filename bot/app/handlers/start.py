# bot/app/handlers/start.py
from maxapi import MessageCreated, CallbackButton, InlineKeyboardBuilder
from app.services.api_client import APIClient
from app.config import settings

api_client = APIClient()

async def cmd_start(event: MessageCreated):
    user_id = str(event.from_user.user_id)
    full_name = event.from_user.full_name or "Аноним"

    builder = InlineKeyboardBuilder()
    web_app_url = f"{settings.SITE_URL}/?user_id={user_id}"
    builder.row(CallbackButton(text="🌐 Открыть веб-приложение", payload=f"open_webapp:{web_app_url}"))
    builder.row(CallbackButton(text="📋 Мои проекты", payload="projects"))
    builder.row(CallbackButton(text="🔔 Уведомления", payload="notifications"))

    await event.message.answer(
        text=f"👋 Привет, {full_name}!\n"
             f"🚀 **MAX Project Pilot**\n"
             f"Управляйте проектами через веб-приложение или получайте уведомления здесь!\n"
             f"💡 **Основные команды:**\n"
             f"• /create_project - Создать новый проект\n"
             f"• /join <хэш> - Присоединиться к проекту\n"
             f"• /help - Помощь",
        attachments=[builder.as_markup()]
    )

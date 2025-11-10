# bot/app/handlers/start.py
from maxapi.types import MessageCreated, CallbackButton, OpenAppButton
from maxapi.utils.inline_keyboard import InlineKeyboardBuilder
from app.services.api_client import APIClient
from app.config import settings

api_client = APIClient()

async def cmd_start(event: MessageCreated):
    user_id = str(event.from_user.user_id)
    full_name = event.from_user.full_name or "Аноним"
    username = event.from_user.username or ""

    # Создаем пользователя в базе данных
    await api_client.create_user(user_id, full_name, username)

    builder = InlineKeyboardBuilder()

    # Кнопка для открытия мини-приложения
    builder.row(OpenAppButton(
        text="🚀 Открыть Project Pilot",
        web_app=event.bot.me.username,  # Имя бота (web_app)
        contact_id=event.bot.me.user_id  # ID бота (contact_id)
    ))

    builder.row(CallbackButton(text="📋 Мои проекты", payload="projects"))
    builder.row(CallbackButton(text="🔔 Уведомления", payload="notifications"))

    await event.message.answer(
        text=f"👋 Привет, {full_name}!\n"
             f"🚀 **MAX Project Pilot**\n\n"
             f"Управляйте проектами и задачами прямо в MAX!\n\n"
             f"💡 **Основные команды:**\n"
             f"• /create_project - Создать новый проект\n"
             f"• /join <хэш> - Присоединиться к проекту\n"
             f"• /help - Помощь\n\n"
             f"📱 **Нажмите кнопку ниже, чтобы открыть приложение:**",
        attachments=[builder.as_markup()]
    )

async def cmd_help(event: MessageCreated):
    user_id = str(event.from_user.user_id)
    full_name = event.from_user.full_name or "Аноним"

    builder = InlineKeyboardBuilder()

    # Кнопка для открытия мини-приложения
    builder.row(OpenAppButton(
        text="🚀 Открыть Project Pilot",
        web_app=event.bot.me.username,
        contact_id=event.bot.me.user_id
    ))

    builder.row(CallbackButton(text="📋 Мои проекты", payload="projects"))
    builder.row(CallbackButton(text="🔔 Уведомления", payload="notifications"))
    builder.row(CallbackButton(text="🏠 Домой", payload="start"))

    await event.message.answer(
        text=f"🆘 **Помощь по MAX Project Pilot**\n\n"
             f"💡 **Основные команды:**\n"
             f"• /start - Главное меню\n"
             f"• /create_project - Создать новый проект\n"
             f"• /join <хэш> - Присоединиться к проекту\n"
             f"• /help - Эта справка\n\n"
             f"📋 **Управление проектами:**\n"
             f"• Создавайте проекты и приглашайте участников\n"
             f"• Управляйте задачами и сроками\n"
             f"• Получайте уведомления о новых задачах\n\n"
             f"🚀 **Откройте приложение для полного функционала!**",
        attachments=[builder.as_markup()]
    )

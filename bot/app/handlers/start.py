from maxapi.types import MessageCreated, CallbackButton
from maxapi.utils.inline_keyboard import InlineKeyboardBuilder
from app.services.api_client import APIClient
from app.config import settings

api_client = APIClient()

async def cmd_start(event: MessageCreated):
    user_id = str(event.from_user.user_id)
    full_name = event.from_user.full_name or "Аноним"
    username = event.from_user.username or ""  # Изменено на пустую строку вместо None

    # Создаем пользователя в базе данных
    await api_client.create_user(user_id, full_name, username)

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

async def cmd_help(event: MessageCreated):
    user_id = str(event.from_user.user_id)
    full_name = event.from_user.full_name or "Аноним"
    builder = InlineKeyboardBuilder()
    web_app_url = f"{settings.SITE_URL}/?user_id={user_id}&user_name={full_name}"
    builder.row(CallbackButton(text="🌐 Открыть веб-приложение", payload=f"open_webapp:{web_app_url}"))
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
             f"• Используйте веб-приложение для создания и управления проектами\n"
             f"• Получайте уведомления о новых задачах и событиях\n\n"
             f"🔗 **Веб-приложение:** {settings.SITE_URL}",
        attachments=[builder.as_markup()]
    )

from maxapi.types import MessageCreated, CallbackButton, OpenAppButton
from maxapi.utils.inline_keyboard import InlineKeyboardBuilder
from app.services.api_client import APIClient
from app.config import settings
import logging

logger = logging.getLogger(__name__)
api_client = APIClient()

async def cmd_start(event: MessageCreated):
    user_id = str(event.from_user.user_id)
    full_name = event.from_user.full_name or "Аноним"
    username = event.from_user.username or ""

    # Проверяем, есть ли параметр start (приглашение в проект)
    text = event.message.body.text.strip()
    parts = text.split(" ", 1)

    if len(parts) > 1:
        # Есть параметр - это приглашение в проект
        project_hash = parts[1]
        await handle_project_invitation(event, project_hash, user_id, full_name)
        return

    # Создаем пользователя в базе данных
    await api_client.create_user(user_id, full_name, username)

    builder = InlineKeyboardBuilder()

    # Кнопка для открытия мини-приложения
    builder.row(OpenAppButton(
        text="🚀 Открыть Project Pilot",
        web_app=settings.MAX_MINI_APP_URL
    ))

    builder.row(CallbackButton(text="📋 Мои проекты", payload="projects"))
    builder.row(CallbackButton(text="🔔 Уведомления", payload="notifications"))
    builder.row(CallbackButton(text="📊 Статистика", payload="stats"))

    await event.message.answer(
        text=f"👋 Привет, {full_name}!\n"
             f"🚀 **MAX Project Pilot**\n\n"
             f"Управляйте проектами и задачами прямо в MAX!\n\n"
             f"💡 **Основные команды:**\n"
             f"• /projects - Мои проекты\n"
             f"• /create_project - Создать новый проект\n"
             f"• /join <хэш> - Присоединиться к проекту\n"
             f"• /stats - Статистика\n"
             f"• /help - Помощь\n\n"
             f"📱 **Нажмите кнопку ниже, чтобы открыть приложение:**",
        attachments=[builder.as_markup()]
    )

async def handle_project_invitation(event: MessageCreated, project_hash: str, user_id: str, full_name: str):
    """Обработка приглашения в проект через мини-приложение"""
    try:
        # Сначала создаем/авторизуем пользователя
        await api_client.create_user(user_id, full_name, "")

        # Пытаемся присоединиться к проекту
        result = await api_client.request_join_project(project_hash, user_id, full_name)

        if result.get("status") == "joined":
            message_text = (
                f"🎉 **Вы успешно присоединились к проекту!**\n\n"
                f"Добро пожаловать в команду! Теперь вы можете:\n"
                f"• 📋 Просматривать задачи проекта\n"
                f"• ✅ Отмечать выполнение задач\n"
                f"• 💬 Участвовать в обсуждениях\n"
                f"• 🔔 Получать уведомления\n\n"
                f"Откройте мини-приложение, чтобы начать работу!"
            )
        elif result.get("message") == "Join request sent for approval":
            message_text = (
                f"📥 **Запрос на присоединение отправлен!**\n\n"
                f"Ваша заявка отправлена администраторам проекта на одобрение.\n"
                f"Вы получите уведомление, когда заявка будет рассмотрена.\n\n"
                f"Ожидайте подтверждения! ⏳"
            )
        elif result.get("message") == "Already a member of this project":
            message_text = "✅ Вы уже являетесь участником этого проекта."
        else:
            message_text = f"❌ {result.get('message', 'Не удалось присоединиться к проекту')}"

        builder = InlineKeyboardBuilder()
        builder.row(OpenAppButton(
            text="🚀 Открыть Project Pilot",
            web_app=settings.MAX_MINI_APP_URL
        ))
        builder.row(CallbackButton(text="🏠 Домой", payload="start"))

        await event.message.answer(
            text=message_text,
            attachments=[builder.as_markup()]
        )

    except Exception as e:
        logger.error(f"Error handling project invitation: {e}")
        await event.message.answer(
            text="❌ Произошла ошибка при обработке приглашения. Попробуйте позже.",
            attachments=[InlineKeyboardBuilder()
                .row(OpenAppButton(
                    text="🚀 Открыть Project Pilot",
                    web_app=settings.MAX_MINI_APP_URL
                ))
                .row(CallbackButton(text="🏠 Домой", payload="start"))
                .as_markup()]
        )

async def cmd_help(event: MessageCreated):
    user_id = str(event.from_user.user_id)
    full_name = event.from_user.full_name or "Аноним"

    builder = InlineKeyboardBuilder()

    # Кнопка для открытия мини-приложения
    builder.row(OpenAppButton(
        text="🚀 Открыть Project Pilot",
        web_app=settings.MAX_MINI_APP_URL
    ))

    builder.row(CallbackButton(text="📋 Мои проекты", payload="projects"))
    builder.row(CallbackButton(text="🔔 Уведомления", payload="notifications"))
    builder.row(CallbackButton(text="📊 Статистика", payload="stats"))
    builder.row(CallbackButton(text="🏠 Домой", payload="start"))

    await event.message.answer(
        text=f"🆘 **Помощь по MAX Project Pilot**\n\n"
             f"💡 **Основные команды:**\n"
             f"• /start - Главное меню\n"
             f"• /projects - Мои проекты\n"
             f"• /create_project - Создать новый проект\n"
             f"• /join <хэш> - Присоединиться к проекту\n"
             f"• /stats - Статистика\n"
             f"• /help - Эта справка\n\n"
             f"📋 **Управление проектами:**\n"
             f"• Создавайте проекты и приглашайте участников\n"
             f"• Управляйте задачами и сроками\n"
             f"• Получайте уведомления о новых задачах\n"
             f"• Одобряйте заявки на вступление\n\n"
             f"🔗 **Приглашение в проекты:**\n"
             f"• Отправляйте ссылку-приглашение друзьям\n"
             f"• Они автоматически присоединятся к проекту\n"
             f"• Или подадут заявку, если проект приватный\n\n"
             f"🚀 **Откройте мини-приложение для полного функционала!**",
        attachments=[builder.as_markup()]
    )

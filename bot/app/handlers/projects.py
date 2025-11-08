# bot/app/handlers/projects.py
from maxapi.types import MessageCreated, MessageCallback, CallbackButton
from maxapi.utils.inline_keyboard import InlineKeyboardBuilder
from maxapi.filters.command import Command
from app.services.api_client import APIClient
from app.utils import generate_invite_hash
from app.config import settings
import re

api_client = APIClient()

async def cmd_create_project(event: MessageCreated):
    builder = InlineKeyboardBuilder()
    builder.row(CallbackButton(text="📁 Начать создание", payload="create_project_start"))
    await event.message.answer("Нажмите кнопку, чтобы начать создание проекта.", attachments=[builder.as_markup()])

async def handle_callback_create_project_start(event: MessageCallback):
    user_id = str(event.from_user.user_id)
    web_app_url = f"{settings.SITE_URL}/?user_id={user_id}#projects"
    await event.message.answer(f"Для создания проекта перейдите в веб-приложение: {web_app_url}")

async def cmd_join_project(event: MessageCreated):
    user_id = str(event.from_user.user_id)
    full_name = event.from_user.full_name or "Аноним"
    text = event.message.body.text.strip()

    parts = text.split(" ", 1)
    if len(parts) < 2:
        await event.message.answer("Пожалуйста, укажите хэш проекта. Пример: /join abc123def456")
        return

    project_hash = parts[1]
    if len(project_hash) != 12 or not re.match(r'^[a-z0-9]+$', project_hash):
        await event.message.answer("Неверный формат хэша проекта. Должно быть 12 символов (a-z, 0-9).")
        return

    result = await api_client.request_join_project(project_hash, user_id, full_name)
    if result.get("status") == "joined":
        await event.message.answer("✅ Вы успешно присоединились к проекту!")
    elif result.get("message") == "Join request sent for approval":
        await event.message.answer("📥 Запрос на присоединение отправлен на одобрение!")
    elif result.get("message") == "Already a member of this project":
        await event.message.answer("❌ Вы уже являетесь участником этого проекта.")
    else:
        await event.message.answer(f"❌ {result.get('message', 'Неизвестная ошибка')}")

async def handle_callback_projects(event: MessageCallback):
    user_id = str(event.from_user.user_id)
    full_name = event.from_user.full_name or "Аноним"
    projects_data = await api_client.get_user_projects(user_id)

    if not projects_data:
        text = "📂 У вас пока нет проектов. Используйте веб-приложение для создания проектов!"
    else:
        text = "📂 **Ваши проекты:**\n"
        for i, member in enumerate(projects_data[:5], 1):
            project = member.get("project", {})
            role_emoji = {"owner": "👑", "admin": "⚡", "member": "👤"}.get(member.get("role"), "👤")
            tasks_count = len(project.get("tasks", []))
            text += f"{i}. {role_emoji} **{project.get('title', 'Без названия')}**\n"
            text += f"📋 {tasks_count} задач | 👥 {len(project.get('members', []))} участников\n"
            text += f"🔗 Хэш: `{project.get('hash', '')}`\n\n"

    builder = InlineKeyboardBuilder()
    for i, member in enumerate(projects_data[:5], 1):
        project = member.get("project", {})
        if member.get("role") in ["owner", "admin"]:
            builder.row(
                CallbackButton(text=f"🔍 {i} - Подробнее", payload=f"project_summary:{project.get('hash')}"),
                CallbackButton(text=f"🔗 {i} - Пригласить", payload=f"project_invite:{project.get('hash')}")
            )

    web_app_url = f"{settings.SITE_URL}/?user_id={user_id}"
    builder.row(CallbackButton(text="🌐 Открыть веб-приложение", payload=f"open_webapp:{web_app_url}"))
    builder.row(CallbackButton(text="🔄 Обновить", payload="projects"))

    await event.bot.edit_message(
        message_id=event.message.body.mid,
        text=text,
        attachments=[builder.as_markup()]
    )

async def handle_callback_project_summary(event: MessageCallback):
    parts = event.callback.payload.split(":", 1)
    if len(parts) != 2:
        await event.answer(notification="❌ Неверная команда")
        return

    project_hash = parts[1]
    user_id = str(event.from_user.user_id)
    full_name = event.from_user.full_name or "Аноним"

    summary = await api_client.get_project_summary(project_hash, user_id, full_name)
    if not summary:
        await event.answer(notification="❌ Не удалось получить информацию о проекте")
        return

    text = (
        f"🚀 **{summary['title']}**\n"
        f"{summary['description'] or '📝 Без описания'}\n"
        f"📊 **Статистика:**\n"
        f"• 👥 Участников: {summary['members_count']}\n"
        f"• 📋 Всего задач: {summary['tasks_count']}\n"
        f"• ⏳ К выполнению: {summary['tasks_todo']}\n"
        f"• 🔧 В работе: {summary['tasks_in_progress']}\n"
        f"• ✅ Выполнено: {summary['tasks_done']}\n"
        f"🔐 {'🔒 Приватный' if summary['is_private'] else '🌐 Публичный'}\n"
        f"📋 {'✅ Одобрение не требуется' if not summary['requires_approval'] else '⏳ Требуется одобрение'}\n"
        f"👤 Ваша роль: {summary['user_role']}"
    )

    builder = InlineKeyboardBuilder()
    web_app_url = f"{settings.SITE_URL}/?user_id={user_id}#project={project_hash}"
    builder.row(CallbackButton(text="🌐 Открыть веб-приложение", payload=f"open_webapp:{web_app_url}"))

    if summary.get('can_manage'):
        builder.row(CallbackButton(text="🔗 Пригласить", payload=f"project_invite:{project_hash}"))
        builder.row(CallbackButton(text="📋 Заявки", payload=f"project_requests:{project_hash}"))

    builder.row(CallbackButton(text="📋 Мои проекты", payload="projects"))

    await event.bot.edit_message(
        message_id=event.message.body.mid,
        text=text,
        attachments=[builder.as_markup()]
    )

async def handle_callback_project_invite(event: MessageCallback):
    parts = event.callback.payload.split(":", 1)
    if len(parts) != 2:
        await event.answer(notification="❌ Неверная команда")
        return

    project_hash = parts[1]
    invite_link = f"{settings.SITE_URL}/join/{project_hash}"
    text = f"🔗 **Приглашение в проект**\nПроект: **{project_hash}**\nОтправьте эту ссылку пользователям:\n`{invite_link}`\nИли поделитесь хэшем проекта:\n`{project_hash}`"

    builder = InlineKeyboardBuilder()
    builder.row(CallbackButton(text="📋 Мои проекты", payload="projects"))

    await event.bot.edit_message(
        message_id=event.message.body.mid,
        text=text,
        attachments=[builder.as_markup()]
    )

async def handle_callback_project_requests(event: MessageCallback):
    parts = event.callback.payload.split(":", 1)
    if len(parts) != 2:
        await event.answer(notification="❌ Неверная команда")
        return

    project_hash = parts[1]
    user_id = str(event.from_user.user_id)
    full_name = event.from_user.full_name or "Аноним"

    data = await api_client.get_project_join_requests(project_hash, user_id, full_name)
    requests = data.get("requests", [])

    if not requests:
        text = "📋 **Заявки на присоединение**\n\nНет ожидающих заявок."
    else:
        text = "📋 **Заявки на присоединение**\n\n"
        for i, req in enumerate(requests, 1):
            user = req.get("user", {})
            text += f"{i}. {user.get('full_name', 'Аноним')} (ID: {user.get('max_id')})\n"
            text += f"Статус: {req.get('status', 'pending')}\n"
            text += f"Дата: {req.get('requested_at', 'N/A')}\n"
            text += f"---\n"

    builder = InlineKeyboardBuilder()
    builder.row(CallbackButton(text="📋 Мои проекты", payload="projects"))

    await event.bot.edit_message(
        message_id=event.message.body.mid,
        text=text,
        attachments=[builder.as_markup()]
    )

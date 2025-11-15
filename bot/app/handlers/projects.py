from maxapi.types import MessageCreated, MessageCallback, CallbackButton, OpenAppButton
from maxapi.utils.inline_keyboard import InlineKeyboardBuilder
from maxapi.filters.command import Command
from app.services.api_client import APIClient
from app.utils import generate_invite_hash
from app.config import settings
import re

api_client = APIClient()

async def cmd_create_project(event: MessageCreated):
    user_id = str(event.from_user.user_id)

    builder = InlineKeyboardBuilder()
    builder.row(OpenAppButton(
        text="🚀 Открыть Project Pilot",
        web_app=settings.MAX_MINI_APP_URL
    ))
    builder.row(CallbackButton(text="🏠 Домой", payload="start"))

    await event.message.answer(
        text=f"🚀 Создание проекта\n\n"
             f"Для создания проекта откройте мини-приложение:\n\n"
             f"В мини-приложении вы сможете:\n"
             f"• 📝 Создать проект с названием и описанием\n"
             f"• 🔐 Настроить приватность\n"
             f"• 👥 Управлять участниками\n"
             f"• 📋 Создавать задачи\n"
             f"• 🎯 Назначать исполнителей",
        attachments=[builder.as_markup()]
    )

async def handle_callback_create_project_start(event: MessageCallback):
    """Обработка начала создания проекта через callback"""
    user_id = str(event.from_user.user_id)

    builder = InlineKeyboardBuilder()
    builder.row(OpenAppButton(
        text="🚀 Открыть Project Pilot",
        web_app=settings.MAX_MINI_APP_URL
    ))
    builder.row(CallbackButton(text="🏠 Домой", payload="start"))

    await event.bot.edit_message(
        message_id=event.message.body.mid,
        text=(
            "🚀 **Создание проекта**\n\n"
            "Для создания проекта откройте мини-приложение:\n\n"
            "В мини-приложении вы сможете:\n"
            "• 📝 Создать проект с названием и описанием\n"
            "• 🔐 Настроить приватность\n"
            "• 👥 Управлять участниками\n"
            "• 📋 Создавать задачи\n"
            "• 🎯 Назначать исполнителей"
        ),
        attachments=[builder.as_markup()]
    )

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
        message_text = "✅ Вы успешно присоединились к проекту!"
    elif result.get("message") == "Join request sent for approval":
        message_text = "📥 Запрос на присоединение отправлен на одобрение!"
    elif result.get("message") == "Already a member of this project":
        message_text = "❌ Вы уже являетесь участником этого проекта."
    else:
        message_text = f"❌ {result.get('message', 'Неизвестная ошибка')}"

    builder = InlineKeyboardBuilder()
    builder.row(OpenAppButton(
        text="🚀 Открыть Project Pilot",
        web_app=settings.MAX_MINI_APP_URL
    ))
    builder.row(CallbackButton(text="🏠 Домой", payload="start"))

    await event.message.answer(message_text, attachments=[builder.as_markup()])

async def cmd_my_projects(event: MessageCreated):
    """Команда для просмотра проектов с улучшенным интерфейсом"""
    user_id = str(event.from_user.user_id)
    full_name = event.from_user.full_name or "Аноним"

    # Получаем дашборд для полной информации
    dashboard = await api_client.get_user_dashboard(user_id, full_name)

    if not dashboard or not dashboard.get("projects"):
        text = (
            "📂 Ваши проекты\n\n"
            "У вас пока нет проектов. Создайте первый проект и начните управлять задачами!\n\n"
            "💡 Что можно делать:\n"
            "• Создавать проекты и приглашать команду\n"
            "• Ставить задачи и отслеживать прогресс\n"
            "• Обсуждать задачи и получать уведомления"
        )

        builder = InlineKeyboardBuilder()
        builder.row(OpenAppButton(
            text="🚀 Создать проект",
            web_app=settings.MAX_MINI_APP_URL
        ))
        builder.row(CallbackButton(text="🔄 Обновить", payload="projects"))
        builder.row(CallbackButton(text="🏠 Домой", payload="start"))

        await event.message.answer(text, attachments=[builder.as_markup()])
        return

    projects = dashboard.get("projects", [])

    text = "📂 Ваши проекты\n\n"

    for i, project in enumerate(projects[:10], 1):  # Ограничиваем 10 проектами
        stats = project.get("stats", {})
        role_emoji = {
            "owner": "👑",
            "admin": "⚡",
            "member": "👤",
            "guest": "👀"
        }.get(project.get("current_user_role", "member"), "👤")

        # Эмодзи для приватности
        privacy_emoji = "🔒" if project.get("is_private") else "🌐"

        text += (
            f"{i}. {role_emoji} {project.get('title', 'Без названия')} {privacy_emoji}\n"
            f"   📊 Задачи: {stats.get('total_tasks', 0)} "
            f"(✅ {stats.get('done_tasks', 0)} | "
            f"🔄 {stats.get('in_progress_tasks', 0)} | "
            f"⏳ {stats.get('todo_tasks', 0)})\n"
            f"   👥 Участников: {stats.get('members_count', 0)}\n"
            f"   🔗 Хэш: `{project.get('hash', '')}`\n\n"
        )

    if len(projects) > 10:
        text += f"*... и еще {len(projects) - 10} проектов*\n\n"

    text += "💡 Управление:\n• Нажмите на проект для деталей\n• Используйте мини-приложение для полного контроля"

    builder = InlineKeyboardBuilder()

    # Создаем кнопки для каждого проекта
    for i, project in enumerate(projects[:5], 1):
        builder.row(
            CallbackButton(
                text=f"🔍 {i} - Детали",
                payload=f"project_summary:{project.get('hash')}"
            ),
            CallbackButton(
                text=f"🔗 {i} - Пригласить",
                payload=f"project_invite:{project.get('hash')}"
            )
        )

    # Дополнительные кнопки
    builder.row(OpenAppButton(
        text="🌐 Открыть мини-приложение",
        web_app=settings.MAX_MINI_APP_URL
    ))
    builder.row(
        CallbackButton(text="🔄 Обновить", payload="projects"),
        CallbackButton(text="📊 Статистика", payload="stats")
    )
    builder.row(CallbackButton(text="🏠 Домой", payload="start"))

    await event.message.answer(text, attachments=[builder.as_markup()])

async def handle_callback_projects(event: MessageCallback):
    user_id = str(event.from_user.user_id)
    full_name = event.from_user.full_name or "Аноним"
    projects_data = await api_client.get_user_projects(user_id)
    if not projects_data:
        text = "📂 У вас пока нет проектов. Используйте мини-приложение для создания проектов!"
    else:
        text = "📂 Ваши проекты:\n"
        for i, member in enumerate(projects_data[:5], 1):
            project = member.get("project", {})
            role_emoji = {"owner": "👑", "admin": "⚡", "member": "👤"}.get(member.get("role"), "👤")
            tasks_count = len(project.get("tasks", []))
            text += f"{i}. {role_emoji} {project.get('title', 'Без названия')}\n"
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

    builder.row(OpenAppButton(
        text="🌐 Открыть мини-приложение",
        web_app=settings.MAX_MINI_APP_URL
    ))
    builder.row(CallbackButton(text="🔄 Обновить", payload="projects"))
    builder.row(CallbackButton(text="🏠 Домой", payload="start"))

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
        f"🚀 {summary['title']}\n"
        f"{summary['description'] or '📝 Без описания'}\n"
        f"📊 Статистика:\n"
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
    builder.row(OpenAppButton(
        text="🌐 Открыть мини-приложение",
        web_app=f"{settings.MAX_MINI_APP_URL}?start={project_hash}"
    ))
    if summary.get('can_manage'):
        builder.row(CallbackButton(text="🔗 Пригласить", payload=f"project_invite:{project_hash}"))
        builder.row(CallbackButton(text="📋 Заявки", payload=f"project_requests:{project_hash}"))
    builder.row(CallbackButton(text="📋 Мои проекты", payload="projects"))
    builder.row(CallbackButton(text="🏠 Домой", payload="start"))

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

    # Генерируем ссылку для приглашения в мини-приложение
    invite_link = f"{settings.MAX_MINI_APP_URL}?start={project_hash}"

    text = (
        f"🔗 Приглашение в проект\n\n"
        f"Отправьте эту ссылку пользователям:\n"
        f"`{invite_link}`\n\n"
        f"Или поделитесь хэшем проекта:\n"
        f"`{project_hash}`\n\n"
        f"💡 Как это работает:\n"
        f"• Пользователь нажимает на ссылку\n"
        f"• Открывается мини-приложение\n"
        f"• Автоматическая регистрация/вход\n"
        f"• Автоматическое присоединение к проекту"
    )

    builder = InlineKeyboardBuilder()
    builder.row(CallbackButton(text="📋 Мои проекты", payload="projects"))
    builder.row(CallbackButton(text="🏠 Домой", payload="start"))

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
        text = "📋 Заявки на присоединение\n\nНет ожидающих заявок."
    else:
        text = "📋 Заявки на присоединение\n\n"
        for i, req in enumerate(requests, 1):
            user = req.get("user", {})
            text += f"{i}. {user.get('full_name', 'Аноним')} (ID: {user.get('max_id')})\n"
            text += f"Статус: {req.get('status', 'pending')}\n"
            text += f"Дата: {req.get('requested_at', 'N/A')}\n"
            text += f"---\n"

    builder = InlineKeyboardBuilder()
    builder.row(CallbackButton(text="📋 Мои проекты", payload="projects"))
    builder.row(CallbackButton(text="🏠 Домой", payload="start"))

    await event.bot.edit_message(
        message_id=event.message.body.mid,
        text=text,
        attachments=[builder.as_markup()]
    )

async def handle_callback_stats(event: MessageCallback):
    """Показать статистику пользователя"""
    user_id = str(event.from_user.user_id)
    full_name = event.from_user.full_name or "Аноним"

    dashboard = await api_client.get_user_dashboard(user_id, full_name)

    if not dashboard:
        await event.answer(notification="❌ Не удалось загрузить статистику")
        return

    projects = dashboard.get("projects", [])
    total_projects = len(projects)

    # Считаем общую статистику
    total_tasks = 0
    done_tasks = 0
    in_progress_tasks = 0
    todo_tasks = 0
    total_members = 0

    for project in projects:
        stats = project.get("stats", {})
        total_tasks += stats.get("total_tasks", 0)
        done_tasks += stats.get("done_tasks", 0)
        in_progress_tasks += stats.get("in_progress_tasks", 0)
        todo_tasks += stats.get("todo_tasks", 0)
        total_members += stats.get("members_count", 0)

    completion_rate = (done_tasks / total_tasks * 100) if total_tasks > 0 else 0

    text = (
        "📊 Ваша статистика\n\n"
        f"📁 Проекты: {total_projects}\n"
        f"📋 Всего задач: {total_tasks}\n"
        f"✅ Выполнено: {done_tasks}\n"
        f"🔄 В работе: {in_progress_tasks}\n"
        f"⏳ Осталось: {todo_tasks}\n"
        f"👥 Участников в проектах: {total_members}\n"
        f"📈 Процент выполнения: {completion_rate:.1f}%\n\n"

        "💡 Советы:\n"
        "• Ставьте реалистичные сроки\n"
        "• Регулярно обновляйте статусы задач\n"
        "• Привлекайте команду к обсуждению"
    )

    builder = InlineKeyboardBuilder()
    builder.row(OpenAppButton(
        text="🌐 Открыть мини-приложение",
        web_app=settings.MAX_MINI_APP_URL
    ))
    builder.row(CallbackButton(text="📂 Мои проекты", payload="projects"))
    builder.row(CallbackButton(text="🏠 Домой", payload="start"))

    await event.bot.edit_message(
        message_id=event.message.body.mid,
        text=text,
        attachments=[builder.as_markup()]
    )

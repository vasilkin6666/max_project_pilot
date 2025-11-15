from maxapi.types import MessageCallback, CallbackButton, OpenAppButton
from maxapi.utils.inline_keyboard import InlineKeyboardBuilder
from app.services.api_client import APIClient
from app.config import settings
import logging

logger = logging.getLogger(__name__)
api_client = APIClient()

async def handle_callback_notifications(event: MessageCallback):
    user_id = str(event.from_user.user_id)

    # Получаем как уведомления, так и pending заявки
    notifications_data = await api_client.get_user_notifications(user_id)
    notifications = notifications_data.get("notifications", [])

    # Получаем проекты пользователя для проверки заявок
    projects_data = await api_client.get_user_projects(user_id)

    pending_requests = []
    for project_data in projects_data:
        project = project_data.get("project", {})
        if project_data.get("role") in ["owner", "admin"]:
            requests_data = await api_client.get_project_join_requests(
                project["hash"], user_id, event.from_user.full_name or "Аноним"
            )
            for req in requests_data.get("requests", []):
                if req.get("status") == "pending":
                    pending_requests.append({
                        **req,
                        "project_title": project.get("title", "Без названия"),
                        "project_hash": project["hash"]
                    })

    if not notifications and not pending_requests:
        text = "📭 У вас пока нет уведомлений и заявок."
    else:
        text = "🔔 Ваши уведомления и заявки:\n\n"

        if pending_requests:
            text += "📋 Заявки на вступление:\n"
            for i, req in enumerate(pending_requests[:3], 1):
                user = req.get("user", {})
                text += f"{i}. 👤 {user.get('full_name', 'Аноним')}\n"
                text += f"   📁 Проект: {req['project_title']}\n"
                text += f"   ⏰ {req.get('requested_at', '')}\n\n"

        if notifications:
            text += "🔔 Последние уведомления:\n"
            for i, notification in enumerate(notifications[:3], 1):
                emoji = "🔵" if not notification.get("is_read") else "⚪"
                text += f"{emoji} {notification.get('title', '')}\n"
                text += f"   {notification.get('message', '')}\n\n"

    builder = InlineKeyboardBuilder()

    if pending_requests:
        builder.row(CallbackButton(
            text="📋 Управлять заявками",
            payload="manage_requests"
        ))

    builder.row(OpenAppButton(
        text="🌐 Открыть мини-приложение",
        web_app=settings.MAX_MINI_APP_URL
    ))
    builder.row(CallbackButton(text="🔄 Обновить", payload="notifications"))
    builder.row(CallbackButton(text="🏠 Домой", payload="start"))

    await event.bot.edit_message(
        message_id=event.message.body.mid,
        text=text,
        attachments=[builder.as_markup()]
    )

async def handle_callback_manage_requests(event: MessageCallback):
    """Управление заявками на вступление"""
    user_id = str(event.from_user.user_id)
    full_name = event.from_user.full_name or "Аноним"

    # Получаем проекты, где пользователь админ/владелец
    projects_data = await api_client.get_user_projects(user_id)
    admin_projects = [p for p in projects_data if p.get("role") in ["owner", "admin"]]

    if not admin_projects:
        text = "❌ У вас нет проектов, где вы являетесь администратором."
        builder = InlineKeyboardBuilder()
        builder.row(CallbackButton(text="📋 Мои проекты", payload="projects"))
        builder.row(CallbackButton(text="🏠 Домой", payload="start"))
        await event.bot.edit_message(
            message_id=event.message.body.mid,
            text=text,
            attachments=[builder.as_markup()]
        )
        return

    # Собираем все pending заявки
    all_requests = []
    for project_data in admin_projects:
        project = project_data.get("project", {})
        requests_data = await api_client.get_project_join_requests(
            project["hash"], user_id, full_name
        )
        for req in requests_data.get("requests", []):
            if req.get("status") == "pending":
                all_requests.append({
                    **req,
                    "project_title": project.get("title", "Без названия"),
                    "project_hash": project["hash"]
                })

    if not all_requests:
        text = "📭 Нет ожидающих заявок на вступление."
        builder = InlineKeyboardBuilder()
        builder.row(CallbackButton(text="🔙 Назад", payload="notifications"))
        builder.row(CallbackButton(text="🏠 Домой", payload="start"))
        await event.bot.edit_message(
            message_id=event.message.body.mid,
            text=text,
            attachments=[builder.as_markup()]
        )
        return

    # Показываем первую заявку с пагинацией
    await show_request_page(event, all_requests, 0)

async def show_request_page(event, requests, page_index):
    """Показать страницу с заявкой"""
    if page_index >= len(requests):
        return

    req = requests[page_index]
    user = req.get("user", {})

    text = (
        f"📋 Заявка на вступление\n\n"
        f"👤 Пользователь: {user.get('full_name', 'Аноним')}\n"
        f"🆔 ID: `{user.get('max_id', '')}`\n"
        f"📁 Проект: {req['project_title']}\n"
        f"🔗 Хэш: `{req['project_hash']}`\n"
        f"⏰ Подана: {req.get('requested_at', '')}\n\n"
        f"📊 Статистика заявки {page_index + 1}/{len(requests)}"
    )

    builder = InlineKeyboardBuilder()

    # Кнопки действий
    builder.row(
        CallbackButton(
            text="✅ Принять",
            payload=f"approve_request:{req['project_hash']}:{req['id']}:{page_index}"
        ),
        CallbackButton(
            text="❌ Отклонить",
            payload=f"reject_request:{req['project_hash']}:{req['id']}:{page_index}"
        )
    )

    # Навигация
    nav_buttons = []
    if page_index > 0:
        nav_buttons.append(CallbackButton(
            text="⬅️ Назад",
            payload=f"request_page:{page_index - 1}"
        ))
    if page_index < len(requests) - 1:
        nav_buttons.append(CallbackButton(
            text="➡️ Вперед",
            payload=f"request_page:{page_index + 1}"
        ))

    if nav_buttons:
        builder.row(*nav_buttons)

    builder.row(CallbackButton(text="🔙 К уведомлениям", payload="notifications"))
    builder.row(CallbackButton(text="🏠 Домой", payload="start"))

    await event.bot.edit_message(
        message_id=event.message.body.mid,
        text=text,
        attachments=[builder.as_markup()]
    )

async def handle_callback_request_page(event: MessageCallback):
    """Обработка переключения страниц заявок"""
    try:
        page_index = int(event.callback.payload.split(":")[1])
        user_id = str(event.from_user.user_id)
        full_name = event.from_user.full_name or "Аноним"

        # Загружаем заявки заново
        projects_data = await api_client.get_user_projects(user_id)
        admin_projects = [p for p in projects_data if p.get("role") in ["owner", "admin"]]

        all_requests = []
        for project_data in admin_projects:
            project = project_data.get("project", {})
            requests_data = await api_client.get_project_join_requests(
                project["hash"], user_id, full_name
            )
            for req in requests_data.get("requests", []):
                if req.get("status") == "pending":
                    all_requests.append({
                        **req,
                        "project_title": project.get("title", "Без названия"),
                        "project_hash": project["hash"]
                    })

        await show_request_page(event, all_requests, page_index)

    except Exception as e:
        logger.error(f"Error handling request page: {e}")
        await event.answer(notification="❌ Ошибка при загрузке заявки")

async def handle_callback_approve_request(event: MessageCallback):
    """Одобрение заявки"""
    try:
        parts = event.callback.payload.split(":")
        project_hash = parts[1]
        request_id = int(parts[2])
        page_index = int(parts[3])

        user_id = str(event.from_user.user_id)
        full_name = event.from_user.full_name or "Аноним"

        # Одобряем заявку
        result = await api_client.approve_join_request(
            project_hash, request_id, user_id, full_name
        )

        if result.get("status") == "success":
            # Получаем информацию о заявке для уведомления
            requests_data = await api_client.get_project_join_requests(
                project_hash, user_id, full_name
            )
            approved_request = next(
                (req for req in requests_data.get("requests", [])
                 if req.get("id") == request_id), None
            )

            if approved_request:
                # Уведомляем пользователя
                target_user_id = approved_request.get("user", {}).get("max_id")
                if target_user_id:
                    try:
                        project_info = await api_client.get_project_summary(
                            project_hash, user_id, full_name
                        )
                        await event.bot.send_message(
                            chat_id=target_user_id,
                            text=(
                                f"🎉 Ваша заявка одобрена!\n\n"
                                f"📁 Проект: {project_info.get('title', '')}\n"
                                f"📝 {project_info.get('description', '')}\n\n"
                                f"Теперь вы можете работать в проекте! 🚀\n\n"
                                f"Откройте мини-приложение, чтобы начать:"
                            ),
                            attachments=[InlineKeyboardBuilder()
                                .row(OpenAppButton(
                                    text="🚀 Открыть Project Pilot",
                                    web_app=f"{settings.MAX_MINI_APP_URL}?start={project_hash}"
                                ))
                                .as_markup()]
                        )
                    except Exception as e:
                        logger.error(f"Could not notify user {target_user_id}: {e}")

            await event.answer(notification="✅ Заявка одобрена!")

            # Обновляем список заявок
            await handle_callback_manage_requests(event)

        else:
            await event.answer(notification="❌ Ошибка при одобрении заявки")

    except Exception as e:
        logger.error(f"Error approving request: {e}")
        await event.answer(notification="❌ Ошибка при одобрении заявки")

async def handle_callback_reject_request(event: MessageCallback):
    """Отклонение заявки"""
    try:
        parts = event.callback.payload.split(":")
        project_hash = parts[1]
        request_id = int(parts[2])
        page_index = int(parts[3])

        user_id = str(event.from_user.user_id)
        full_name = event.from_user.full_name or "Аноним"

        # Отклоняем заявку
        result = await api_client.reject_join_request(
            project_hash, request_id, user_id, full_name
        )

        if result.get("status") == "success":
            # Получаем информацию о заявке для уведомления
            requests_data = await api_client.get_project_join_requests(
                project_hash, user_id, full_name
            )
            rejected_request = next(
                (req for req in requests_data.get("requests", [])
                 if req.get("id") == request_id), None
            )

            if rejected_request:
                # Уведомляем пользователя
                target_user_id = rejected_request.get("user", {}).get("max_id")
                if target_user_id:
                    try:
                        project_info = await api_client.get_project_summary(
                            project_hash, user_id, full_name
                        )
                        await event.bot.send_message(
                            chat_id=target_user_id,
                            text=(
                                f"😔 Ваша заявка отклонена\n\n"
                                f"📁 Проект: {project_info.get('title', '')}\n"
                                f"❌ К сожалению, администратор отклонил вашу заявку.\n\n"
                                f"Вы можете подать заявку в другой проект! 💪"
                            ),
                            attachments=[InlineKeyboardBuilder()
                                .row(OpenAppButton(
                                    text="🚀 Открыть Project Pilot",
                                    web_app=settings.MAX_MINI_APP_URL
                                ))
                                .as_markup()]
                        )
                    except Exception as e:
                        logger.error(f"Could not notify user {target_user_id}: {e}")

            await event.answer(notification="❌ Заявка отклонена")

            # Обновляем список заявок
            await handle_callback_manage_requests(event)

        else:
            await event.answer(notification="❌ Ошибка при отклонении заявки")

    except Exception as e:
        logger.error(f"Error rejecting request: {e}")
        await event.answer(notification="❌ Ошибка при отклонении заявки")

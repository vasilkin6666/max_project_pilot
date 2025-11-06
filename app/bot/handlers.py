import logging
from maxapi import Dispatcher, F
from maxapi.filters.command import Command
from maxapi.filters.callback_payload import CallbackPayload
from maxapi.types import MessageCreated, MessageCallback, CallbackButton
from maxapi.utils.inline_keyboard import InlineKeyboardBuilder
from app.services import (
    get_or_create_user,
    get_user_notifications,
    mark_notification_as_read,
    mark_all_notifications_as_read,
    get_user_projects,
    toggle_user_notifications,
    get_notification_settings
)
from app.models import NotificationType

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

dp = Dispatcher()

class Action(CallbackPayload, prefix="mpp"):
    action: str
    data: str = ""

# СТАРТ - только уведомления
@dp.message_created(Command('start'))
async def cmd_start(event: MessageCreated):
    try:
        user = await get_or_create_user(str(event.from_user.user_id), event.from_user.full_name or "Аноним")

        kb = InlineKeyboardBuilder()
        kb.row(
            CallbackButton(text="🔔 Мои уведомления", payload=Action(action="notifications").pack()),
            CallbackButton(text="⚙️ Настройки", payload=Action(action="settings").pack())
        )
        kb.row(
            CallbackButton(text="📋 Мои проекты", payload=Action(action="projects").pack())
        )

        await event.message.answer(
            text=f"👋 Привет, {user.full_name}!\n\n"
                 "🔔 **MAX Project Pilot - Уведомления**\n\n"
                 "Я буду присылать уведомления о:\n"
                 "• ✅ Выполненных задачах\n"
                 "• 🎯 Новых назначениях\n"
                 "• 👥 Новых участниках\n"
                 "• 📝 Изменениях в проектах\n\n"
                 "Весь функционал управления проектами доступен в веб-приложении!",
            attachments=[kb.as_markup()]
        )
    except Exception as e:
        logger.error(f"Start error: {e}")
        await event.message.answer("❌ Ошибка при запуске. Попробуй позже.")

# УВЕДОМЛЕНИЯ
@dp.message_callback(Action.filter(F.action == "notifications"))
async def show_notifications(event: MessageCallback, payload: Action):
    try:
        user = await get_or_create_user(str(event.from_user.user_id), event.from_user.full_name or "Аноним")
        notifications = await get_user_notifications(user.id, limit=10)

        kb = InlineKeyboardBuilder()

        if not notifications:
            text = "📭 У вас пока нет уведомлений\n\nНовые уведомления появятся здесь, когда в ваших проектах что-то произойдет!"
        else:
            text = "🔔 **Последние уведомления:**\n\n"
            unread_count = 0

            for i, notification in enumerate(notifications[:5], 1):
                emoji = "🔵" if not notification.is_read else "⚪"
                if not notification.is_read:
                    unread_count += 1

                text += f"{emoji} **{notification.title}**\n"
                text += f"   {notification.message}\n"
                text += f"   📅 {notification.created_at.strftime('%d.%m %H:%M')}\n\n"

            if unread_count > 0:
                kb.row(CallbackButton(
                    text="✅ Отметить все как прочитанные",
                    payload=Action(action="mark_all_read").pack()
                ))

            if len(notifications) > 5:
                text += f"... и ещё {len(notifications) - 5} уведомлений"

        kb.row(CallbackButton(text="🔄 Обновить", payload=Action(action="notifications").pack()))
        kb.row(CallbackButton(text="🏠 Домой", payload=Action(action="start").pack()))

        await event.bot.edit_message(
            message_id=event.message.body.mid,
            text=text,
            attachments=[kb.as_markup()]
        )

    except Exception as e:
        logger.error(f"Notifications error: {e}")
        await event.answer(notification="❌ Ошибка загрузки уведомлений")

# ОТМЕТИТЬ ВСЕ КАК ПРОЧИТАННЫЕ
@dp.message_callback(Action.filter(F.action == "mark_all_read"))
async def mark_all_read(event: MessageCallback, payload: Action):
    try:
        user = await get_or_create_user(str(event.from_user.user_id), event.from_user.full_name or "Аноним")
        await mark_all_notifications_as_read(user.id)

        await event.answer(notification="✅ Все уведомления отмечены как прочитанные")
        await show_notifications(event, payload)  # Обновляем список

    except Exception as e:
        logger.error(f"Mark all read error: {e}")
        await event.answer(notification="❌ Ошибка")

# НАСТРОЙКИ УВЕДОМЛЕНИЙ
@dp.message_callback(Action.filter(F.action == "settings"))
async def show_settings(event: MessageCallback, payload: Action):
    try:
        user = await get_or_create_user(str(event.from_user.user_id), event.from_user.full_name or "Аноним")
        projects = await get_user_projects(user.id)

        kb = InlineKeyboardBuilder()

        if not projects:
            text = "⚙️ **Настройки уведомлений**\n\nУ вас пока нет проектов для настройки."
        else:
            text = "⚙️ **Настройки уведомлений**\n\nВыберите проект для настройки:\n\n"

            for i, member in enumerate(projects[:8], 1):
                project = member.project
                is_enabled = await get_notification_settings(user.id, project.id)
                status = "🔔" if is_enabled else "🔕"
                text += f"{i}. {status} {project.title}\n"

                # Кнопки для каждого проекта
                kb.add(CallbackButton(
                    text=f"{i}",
                    payload=Action(action="project_settings", data=project.hash).pack()
                ))

        kb.row(CallbackButton(text="🏠 Домой", payload=Action(action="start").pack()))

        await event.bot.edit_message(
            message_id=event.message.body.mid,
            text=text,
            attachments=[kb.as_markup()]
        )

    except Exception as e:
        logger.error(f"Settings error: {e}")
        await event.answer(notification="❌ Ошибка загрузки настроек")

# НАСТРОЙКИ КОНКРЕТНОГО ПРОЕКТА
@dp.message_callback(Action.filter(F.action == "project_settings"))
async def project_settings(event: MessageCallback, payload: Action):
    try:
        user = await get_or_create_user(str(event.from_user.user_id), event.from_user.full_name or "Аноним")
        project = await get_project_by_hash(payload.data)

        if not project:
            await event.answer(notification="❌ Проект не найден")
            return

        current_setting = await get_notification_settings(user.id, project.id)

        kb = InlineKeyboardBuilder()

        if current_setting:
            kb.row(CallbackButton(
                text="🔕 Отключить уведомления",
                payload=Action(action="toggle_notifications", data=f"{project.hash}:false").pack()
            ))
            status_text = "🔔 Уведомления включены"
        else:
            kb.row(CallbackButton(
                text="🔔 Включить уведомления",
                payload=Action(action="toggle_notifications", data=f"{project.hash}:true").pack()
            ))
            status_text = "🔕 Уведомления отключены"

        kb.row(CallbackButton(text="⬅️ Назад", payload=Action(action="settings").pack()))
        kb.row(CallbackButton(text="🏠 Домой", payload=Action(action="start").pack()))

        text = f"⚙️ **Настройки уведомлений**\n\n"
        text += f"**Проект:** {project.title}\n"
        text += f"**Статус:** {status_text}\n\n"
        text += "Уведомления включают:\n"
        text += "• ✅ Выполнение задач\n"
        text += "• 🎯 Назначение задач\n"
        text += "• 👥 Новые участники\n"
        text += "• 📝 Изменения в проекте"

        await event.bot.edit_message(
            message_id=event.message.body.mid,
            text=text,
            attachments=[kb.as_markup()]
        )

    except Exception as e:
        logger.error(f"Project settings error: {e}")
        await event.answer(notification="❌ Ошибка")

# ПЕРЕКЛЮЧЕНИЕ УВЕДОМЛЕНИЙ
@dp.message_callback(Action.filter(F.action == "toggle_notifications"))
async def toggle_notifications(event: MessageCallback, payload: Action):
    try:
        project_hash, enabled_str = payload.data.split(":")
        enabled = enabled_str.lower() == "true"

        user = await get_or_create_user(str(event.from_user.user_id), event.from_user.full_name or "Аноним")
        project = await get_project_by_hash(project_hash)

        if not project:
            await event.answer(notification="❌ Проект не найден")
            return

        await toggle_user_notifications(user.id, project.id, enabled)

        status = "включены" if enabled else "отключены"
        await event.answer(notification=f"✅ Уведомления {status} для проекта «{project.title}»")

        # Возвращаемся к настройкам проекта
        await project_settings(event, Action(action="project_settings", data=project_hash))

    except Exception as e:
        logger.error(f"Toggle notifications error: {e}")
        await event.answer(notification="❌ Ошибка")

# СПИСОК ПРОЕКТОВ (только просмотр)
@dp.message_callback(Action.filter(F.action == "projects"))
async def show_projects(event: MessageCallback, payload: Action):
    try:
        user = await get_or_create_user(str(event.from_user.user_id), event.from_user.full_name or "Аноним")
        projects = await get_user_projects(user.id)

        kb = InlineKeyboardBuilder()

        if not projects:
            text = "📂 **Мои проекты**\n\nУ вас пока нет проектов.\n\nДля создания проектов и управления задачами используйте веб-приложение!"
        else:
            text = "📂 **Мои проекты**\n\n"
            for i, member in enumerate(projects[:10], 1):
                project = member.project
                members_count = len(project.members) if project.members else 0
                tasks_count = len(project.tasks) if project.tasks else 0

                text += f"{i}. **{project.title}**\n"
                text += f"   👥 {members_count} участников | 📋 {tasks_count} задач\n"
                text += f"   🔗 Хэш: `{project.hash}`\n\n"

        kb.row(CallbackButton(text="🔔 Уведомления", payload=Action(action="notifications").pack()))
        kb.row(CallbackButton(text="🏠 Домой", payload=Action(action="start").pack()))

        await event.bot.edit_message(
            message_id=event.message.body.mid,
            text=text,
            attachments=[kb.as_markup()]
        )

    except Exception as e:
        logger.error(f"Projects error: {e}")
        await event.answer(notification="❌ Ошибка загрузки проектов")

# ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ
@dp.message_created(F.message.body.text.len() > 0)
async def handle_text_messages(event: MessageCreated):
    text = event.message.body.text.strip()

    # Если сообщение похоже на хэш проекта (12 символов)
    if len(text) == 12 and text.isalnum():
        await event.message.answer(
            "🔗 Для присоединения к проектам используйте веб-приложение.\n\n"
            "В боте доступны только уведомления о событиях в ваших проектах!"
        )
    else:
        await event.message.answer(
            "🤖 Я бот для уведомлений!\n\n"
            "Используйте кнопки для:\n"
            "• 🔔 Просмотра уведомлений\n"
            "• ⚙️ Настройки уведомлений\n"
            "• 📋 Просмотра проектов\n\n"
            "Весь функционал управления доступен в веб-приложении!"
        )

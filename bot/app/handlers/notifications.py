# bot/app/handlers/notifications.py
from maxapi import MessageCallback, CallbackButton, InlineKeyboardBuilder
from app.services.api_client import APIClient

api_client = APIClient()

async def handle_callback_notifications(event: MessageCallback):
    user_id = str(event.from_user.user_id)
    data = await api_client.get_user_notifications(user_id)
    notifications = data.get("notifications", [])

    if not notifications:
        text = "📭 У вас пока нет уведомлений.\nНовые уведомления появятся здесь, когда в ваших проектах что-то произойдет!"
    else:
        text = "🔔 **Последние уведомления:**\n"
        for i, notification in enumerate(notifications[:5], 1):
            emoji = "🔵" if not notification.get("is_read") else "⚪"
            text += f"{emoji} **{notification.get('title', '')}**\n"
            text += f"{notification.get('message', '')}\n"
            # Добавить дату, если есть
            # text += f"📅 {notification.get('created_at', '')}\n"
            text += "\n"

    builder = InlineKeyboardBuilder()
    web_app_url = f"{settings.SITE_URL}/?user_id={event.from_user.user_id}#notifications"
    builder.row(CallbackButton(text="🌐 Открыть веб-приложение", payload=f"open_webapp:{web_app_url}"))
    builder.row(CallbackButton(text="🔄 Обновить", payload="notifications"))
    await event.bot.edit_message(message_id=event.message.body.mid, text=text, attachments=[builder.as_markup()])

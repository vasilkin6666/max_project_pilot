import secrets
import string
from datetime import datetime, timedelta

def generate_hash(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def format_date(dt: datetime | None) -> str:
    if not dt:
        return "—"
    return dt.strftime("%d.%m.%Y %H:%M")

def is_overdue(due: datetime | None) -> bool:
    return due and due < datetime.utcnow()

def format_project_info(project) -> str:
    """Форматирует информацию о проекте для сообщения"""
    members_count = len(project.members) if project.members else 0
    tasks_count = len(project.tasks) if project.tasks else 0

    # Статистика по задачам
    tasks_todo = len([t for t in (project.tasks or []) if t.status == "todo"])
    tasks_in_progress = len([t for t in (project.tasks or []) if t.status == "in_progress"])
    tasks_done = len([t for t in (project.tasks or []) if t.status == "done"])

    return (
        f"🚀 **{project.title}**\n\n"
        f"{project.description or '📝 Без описания'}\n\n"
        f"📊 **Статистика:**\n"
        f"• 👥 Участников: {members_count}\n"
        f"• 📋 Всего задач: {tasks_count}\n"
        f"• ⏳ К выполнению: {tasks_todo}\n"
        f"• 🔧 В работе: {tasks_in_progress}\n"
        f"• ✅ Выполнено: {tasks_done}\n"
        f"🔐 {'🔒 Приватный' if project.is_private else '🌐 Публичный'}\n"
        f"📅 Создан: {format_date(project.created_at)}\n"
        f"🔗 Хэш: `{project.hash}`"
    )

def format_project_preview(project, index: int = None) -> str:
    """Форматирует краткую информацию о проекте для списка"""
    members_count = len(project.members) if project.members else 0
    tasks_count = len(project.tasks) if project.tasks else 0
    tasks_done = len([t for t in (project.tasks or []) if t.status == "done"])

    prefix = f"{index}. " if index is not None else ""

    return (
        f"{prefix}**{project.title}**\n"
        f"   📋 {tasks_count} задач ({tasks_done} ✅) | 👥 {members_count} участников\n"
        f"   {project.description[:50] + '...' if project.description and len(project.description) > 50 else project.description or '📝 Без описания'}"
    )

def escape_markdown(text: str) -> str:
    """Экранирует символы Markdown"""
    escape_chars = r'_*[]()~`>#+-=|{}.!'
    return ''.join(f'\\{char}' if char in escape_chars else char for char in text)

# backend/app/models/settings.py
from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base
import json

class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    theme = Column(String, default="light")  # light, dark, auto
    language = Column(String, default="ru")  # ru, en, etc.
    notifications_enabled = Column(Boolean, default=True)
    email_notifications = Column(Boolean, default=False)
    push_notifications = Column(Boolean, default=True)
    compact_view = Column(Boolean, default=False)
    show_completed_tasks = Column(Boolean, default=True)
    default_project_view = Column(String, default="list")  # list, board, calendar
    timezone = Column(String, default="UTC")
    date_format = Column(String, default="DD.MM.YYYY")
    time_format = Column(String, default="24h")  # 12h, 24h
    items_per_page = Column(Integer, default=20)
    custom_settings = Column(Text, default="{}")  # JSON для кастомных настроек
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship
    user = relationship("User", back_populates="settings")

    def get_custom_settings(self) -> dict:
        """Получить кастомные настройки как словарь"""
        try:
            return json.loads(self.custom_settings) if self.custom_settings else {}
        except json.JSONDecodeError:
            return {}

    def set_custom_settings(self, settings: dict):
        """Установить кастомные настройки"""
        self.custom_settings = json.dumps(settings)

    def to_dict(self):
        """Сериализация настроек в словарь"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "theme": self.theme,
            "language": self.language,
            "notifications_enabled": self.notifications_enabled,
            "email_notifications": self.email_notifications,
            "push_notifications": self.push_notifications,
            "compact_view": self.compact_view,
            "show_completed_tasks": self.show_completed_tasks,
            "default_project_view": self.default_project_view,
            "timezone": self.timezone,
            "date_format": self.date_format,
            "time_format": self.time_format,
            "items_per_page": self.items_per_page,
            "custom_settings": self.get_custom_settings(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

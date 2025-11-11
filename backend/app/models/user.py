# backend/app/models/user.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    max_id = Column(String(100), unique=True, index=True, nullable=False)
    full_name = Column(String(200), nullable=False)
    username = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Упрощенные отношения - убираем конфликтующие backref
    owned_projects = relationship(
        "Project",
        foreign_keys="Project.created_by",
        back_populates="project_owner"
    )

    project_memberships = relationship(
        "ProjectMember",
        back_populates="member_user"
    )

    join_requests = relationship(
        "JoinRequest",
        foreign_keys="JoinRequest.user_id",
        back_populates="join_request_user"
    )

    # Задачи, созданные пользователем
    created_tasks = relationship(
        "Task",
        foreign_keys="Task.created_by",
        back_populates="task_creator"
    )

    # Задачи, назначенные пользователю
    assigned_tasks = relationship(
        "TaskAssignee",
        back_populates="assignee_user"
    )

    # Комментарии пользователя
    comments = relationship(
        "Comment",
        back_populates="comment_user"
    )

    # Настройки пользователя
    settings = relationship(
        "UserSettings",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<User(id={self.id}, max_id='{self.max_id}', full_name='{self.full_name}')>"

    def to_dict(self):
        """Сериализация пользователя в словарь"""
        return {
            "id": self.id,
            "max_id": self.max_id,
            "full_name": self.full_name,
            "username": self.username,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

    async def get_or_create_settings(self, db):
        """Получить или создать настройки пользователя"""
        from app.models import UserSettings

        if self.settings:
            return self.settings

        # Проверяем, есть ли уже настройки
        from sqlalchemy import select
        result = await db.execute(
            select(UserSettings).where(UserSettings.user_id == self.id)
        )
        existing_settings = result.scalar_one_or_none()

        if existing_settings:
            return existing_settings

        # Создаем настройки по умолчанию
        settings = UserSettings(user_id=self.id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
        return settings

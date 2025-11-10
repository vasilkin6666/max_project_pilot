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

    # Упрощенные отношения
    owned_projects = relationship(
        "Project",
        foreign_keys="Project.created_by",
        backref="project_owner",
        cascade="all, delete-orphan"
    )

    project_memberships = relationship(
        "ProjectMember",
        backref="member_user",
        cascade="all, delete-orphan"
    )

    join_requests = relationship(
        "JoinRequest",
        foreign_keys="JoinRequest.user_id",
        backref="join_request_user",
        cascade="all, delete-orphan"
    )

    # Задачи, созданные пользователем
    created_tasks = relationship(
        "Task",
        foreign_keys="Task.created_by",
        backref="task_creator"
    )

    # Задачи, назначенные пользователю
    assigned_tasks = relationship(
        "TaskAssignee",
        backref="assignee_user",
        cascade="all, delete-orphan"
    )

    # Комментарии пользователя
    comments = relationship(
        "Comment",
        backref="comment_user",
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

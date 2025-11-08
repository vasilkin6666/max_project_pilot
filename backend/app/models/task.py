# backend/app/models/task.py
from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base
from .enums import TaskStatus, TaskPriority

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default=TaskStatus.TODO) # Хранение строки
    priority = Column(String, default=TaskPriority.MEDIUM) # Хранение строки
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True) # ID исполнителя
    due_date = Column(DateTime(timezone=True), nullable=True)
    parent_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True) # Для подзадач
    depends_on_id = Column(Integer, ForeignKey("tasks.id"), nullable=True) # Для зависимостей
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    project = relationship("Project", back_populates="tasks")
    creator = relationship("User", foreign_keys=[created_by])
    assignee = relationship("User", foreign_keys=[assigned_to_id])
    parent_task = relationship("Task", remote_side=[id], back_populates="subtasks")
    subtasks = relationship("Task", back_populates="parent_task", cascade="all, delete-orphan")
    dependencies = relationship("Task", remote_side=[id], back_populates="dependents")
    dependents = relationship("Task", back_populates="dependencies")
    assignees = relationship("TaskAssignee", back_populates="task", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="task", cascade="all, delete-orphan")

class TaskAssignee(Base):
    __tablename__ = "task_assignees"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    task = relationship("Task", back_populates="assignees")
    user = relationship("User")

    __table_args__ = (UniqueConstraint('task_id', 'user_id', name='unique_task_assignee'),)

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    task = relationship("Task", back_populates="comments")
    user = relationship("User")

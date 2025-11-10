
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
    status = Column(String, default=TaskStatus.TODO)
    priority = Column(String, default=TaskPriority.MEDIUM)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    parent_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Используем backref
    assignees = relationship("TaskAssignee", backref="assignee_task", cascade="all, delete-orphan")
    comments = relationship("Comment", backref="comment_task", cascade="all, delete-orphan")

    # Отношение для родительской задачи и подзадач
    parent_task = relationship(
        "Task",
        remote_side=[id],
        backref="subtasks",
        foreign_keys=[parent_task_id]
    )

    # Отношение для зависимостей задач
    dependencies = relationship(
        "TaskDependency",
        foreign_keys="TaskDependency.task_id",
        backref="dependency_task"
    )
    dependents = relationship(
        "TaskDependency",
        foreign_keys="TaskDependency.depends_on_id",
        backref="dependent_task"
    )

class TaskDependency(Base):
    __tablename__ = "task_dependencies"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    depends_on_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)

    __table_args__ = (UniqueConstraint('task_id', 'depends_on_id', name='unique_task_dependency'),)

class TaskAssignee(Base):
    __tablename__ = "task_assignees"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    __table_args__ = (UniqueConstraint('task_id', 'user_id', name='unique_task_assignee'),)

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

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
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Один исполнитель
    due_date = Column(DateTime(timezone=True), nullable=True)
    parent_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    task_project = relationship("Project", back_populates="tasks")
    task_creator = relationship("User", foreign_keys=[created_by], back_populates="created_tasks")
    assigned_user = relationship("User", foreign_keys=[assigned_to_id], back_populates="assigned_tasks")  # Один исполнитель
    comments = relationship("Comment", back_populates="comment_task", cascade="all, delete-orphan")

    # Отношение для родительской задачи и подзадач
    parent_task = relationship(
        "Task",
        remote_side=[id],
        back_populates="subtasks",
        foreign_keys=[parent_task_id]
    )
    subtasks = relationship(
        "Task",
        back_populates="parent_task",
        foreign_keys=[parent_task_id]
    )

    # Отношение для зависимостей задач
    dependencies = relationship(
        "TaskDependency",
        foreign_keys="TaskDependency.task_id",
        back_populates="dependency_task"
    )
    dependents = relationship(
        "TaskDependency",
        foreign_keys="TaskDependency.depends_on_id",
        back_populates="dependent_task"
    )

class TaskDependency(Base):
    __tablename__ = "task_dependencies"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    depends_on_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)

    __table_args__ = (UniqueConstraint('task_id', 'depends_on_id', name='unique_task_dependency'),)

    dependency_task = relationship("Task", foreign_keys=[task_id], back_populates="dependencies")
    dependent_task = relationship("Task", foreign_keys=[depends_on_id], back_populates="dependents")

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    comment_task = relationship("Task", back_populates="comments")
    comment_user = relationship("User", foreign_keys=[user_id], back_populates="comments")

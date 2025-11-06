from sqlalchemy import select, update, and_
from sqlalchemy.orm import selectinload
from app.db import AsyncSessionLocal
from app.models import User, Project, ProjectMember, Task, TaskAssignee, Notification, NotificationType
from app.utils import generate_hash
from datetime import datetime
import json

# ПОЛЬЗОВАТЕЛЬ
async def get_or_create_user(max_id: str, full_name: str) -> User:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.max_id == max_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            user = User(max_id=max_id, full_name=full_name or "Аноним")
            db.add(user)
            await db.commit()
            await db.refresh(user)

        return user

# СОЗДАТЬ ПРОЕКТ
async def create_project(owner: User, title: str, description: str = "", is_private: bool = True) -> Project:
    async with AsyncSessionLocal() as db:
        project = Project(
            hash=generate_hash(),
            title=title,
            description=description,
            is_private=is_private,
            owner_id=owner.id
        )
        db.add(project)
        await db.flush()

        # Добавляем владельца как участника
        member = ProjectMember(project_id=project.id, user_id=owner.id, role="owner")
        db.add(member)

        await db.commit()
        await db.refresh(project)
        return project

# СОЗДАТЬ ЗАДАЧУ
async def create_task(project_id: int, title: str, description: str = "", priority: str = "medium", due_date: datetime = None):
    async with AsyncSessionLocal() as db:
        task = Task(
            project_id=project_id,
            title=title,
            description=description,
            priority=priority,
            due_date=due_date
        )
        db.add(task)
        await db.commit()
        await db.refresh(task)
        return task

# ПРОЕКТЫ ПОЛЬЗОВАТЕЛЯ
async def get_user_projects(user_id: int):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ProjectMember)
            .where(ProjectMember.user_id == user_id)
            .options(
                selectinload(ProjectMember.project).selectinload(Project.members),
                selectinload(ProjectMember.project).selectinload(Project.tasks)
            )
        )
        members = result.scalars().all()
        return members

# ПРОЕКТ ПО ХЭШУ
async def get_project_by_hash(hash_: str):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Project)
            .where(Project.hash == hash_)
            .options(
                selectinload(Project.members).selectinload(ProjectMember.user),
                selectinload(Project.tasks).selectinload(Task.assignees).selectinload(TaskAssignee.user)
            )
        )
        return result.scalar_one_or_none()

# УЧАСТНИКИ ПРОЕКТА
async def get_project_members(project_id: int):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ProjectMember)
            .where(ProjectMember.project_id == project_id)
            .options(selectinload(ProjectMember.user))
        )
        return result.scalars().all()

# ЗАДАЧИ ПРОЕКТА
async def get_project_tasks(project_id: int):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Task)
            .where(Task.project_id == project_id)
            .options(selectinload(Task.assignees).selectinload(TaskAssignee.user))
        )
        return result.scalars().all()

# ДОБАВИТЬ УЧАСТНИКА В ПРОЕКТ
async def add_user_to_project(user_id: int, project_id: int, role: str = "member"):
    async with AsyncSessionLocal() as db:
        # Проверяем, не является ли пользователь уже участником
        result = await db.execute(
            select(ProjectMember)
            .where(and_(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id
            ))
        )
        existing_member = result.scalar_one_or_none()

        if existing_member:
            return existing_member

        member = ProjectMember(project_id=project_id, user_id=user_id, role=role)
        db.add(member)
        await db.commit()
        await db.refresh(member)
        return member

# УВЕДОМЛЕНИЯ
async def create_notification(user_id: int, project_id: int, type: NotificationType, title: str, message: str, data: dict = None):
    async with AsyncSessionLocal() as db:
        notification = Notification(
            user_id=user_id,
            project_id=project_id,
            type=type,
            title=title,
            message=message,
            data=json.dumps(data) if data else None
        )
        db.add(notification)
        await db.commit()
        await db.refresh(notification)
        return notification

async def get_user_notifications(user_id: int, limit: int = 10):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Notification)
            .where(Notification.user_id == user_id)
            .options(selectinload(Notification.project))
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()

async def mark_notification_as_read(notification_id: int):
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(Notification)
            .where(Notification.id == notification_id)
            .values(is_read=True)
        )
        await db.commit()

async def mark_all_notifications_as_read(user_id: int):
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(Notification)
            .where(Notification.user_id == user_id)
            .values(is_read=True)
        )
        await db.commit()

# СИСТЕМНЫЕ УВЕДОМЛЕНИЯ
async def notify_task_completed(task_id: int, completed_by_user_id: int):
    """Создает уведомления о завершении задачи для всех участников проекта"""
    async with AsyncSessionLocal() as db:
        # Получаем задачу и проект
        result = await db.execute(
            select(Task)
            .where(Task.id == task_id)
            .options(selectinload(Task.project).selectinload(Project.members))
        )
        task = result.scalar_one_or_none()

        if not task:
            return

        # Получаем пользователя, который завершил задачу
        user_result = await db.execute(
            select(User).where(User.id == completed_by_user_id)
        )
        completed_by_user = user_result.scalar_one_or_none()

        # Создаем уведомления для всех участников проекта с включенными уведомлениями
        for member in task.project.members:
            if member.notifications_enabled and member.user_id != completed_by_user_id:
                await create_notification(
                    user_id=member.user_id,
                    project_id=task.project_id,
                    type=NotificationType.TASK_COMPLETED,
                    title="✅ Задача выполнена",
                    message=f"{completed_by_user.full_name} выполнил(а) задачу «{task.title}» в проекте «{task.project.title}»",
                    data={"task_id": task_id, "completed_by_user_id": completed_by_user_id}
                )

async def notify_task_assigned(task_id: int, assigned_to_user_id: int):
    """Создает уведомление о назначении задачи"""
    async with AsyncSessionLocal() as db:
        # Получаем задачу
        result = await db.execute(
            select(Task)
            .where(Task.id == task_id)
            .options(selectinload(Task.project))
        )
        task = result.scalar_one_or_none()

        if not task:
            return

        # Создаем уведомление для назначенного пользователя
        await create_notification(
            user_id=assigned_to_user_id,
            project_id=task.project_id,
            type=NotificationType.TASK_ASSIGNED,
            title="🎯 Новая задача",
            message=f"Вам назначена задача «{task.title}» в проекте «{task.project.title}»",
            data={"task_id": task_id}
        )

async def notify_user_joined(project_id: int, joined_user_id: int):
    """Создает уведомления о новом участнике проекта"""
    async with AsyncSessionLocal() as db:
        # Получаем проект и пользователя
        project_result = await db.execute(
            select(Project)
            .where(Project.id == project_id)
            .options(selectinload(Project.members))
        )
        project = project_result.scalar_one_or_none()

        user_result = await db.execute(select(User).where(User.id == joined_user_id))
        joined_user = user_result.scalar_one_or_none()

        if not project or not joined_user:
            return

        # Создаем уведомления для всех участников проекта (кроме нового)
        for member in project.members:
            if member.notifications_enabled and member.user_id != joined_user_id:
                await create_notification(
                    user_id=member.user_id,
                    project_id=project_id,
                    type=NotificationType.USER_JOINED,
                    title="👥 Новый участник",
                    message=f"{joined_user.full_name} присоединился(ась) к проекту «{project.title}»",
                    data={"joined_user_id": joined_user_id}
                )

# НАСТРОЙКИ УВЕДОМЛЕНИЙ
async def toggle_user_notifications(user_id: int, project_id: int, enabled: bool):
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(ProjectMember)
            .where(and_(
                ProjectMember.user_id == user_id,
                ProjectMember.project_id == project_id
            ))
            .values(notifications_enabled=enabled)
        )
        await db.commit()

async def get_notification_settings(user_id: int, project_id: int):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ProjectMember)
            .where(and_(
                ProjectMember.user_id == user_id,
                ProjectMember.project_id == project_id
            ))
        )
        member = result.scalar_one_or_none()
        return member.notifications_enabled if member else True

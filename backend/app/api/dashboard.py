# В файле app/api/dashboard.py исправьте импорты и логику:

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload  # Добавьте этот импорт
from app.database import get_db
from app.models import User, Project, ProjectMember, Task, Notification, UserSettings
from app.api.deps import get_current_user
from app.models.enums import TaskStatus, ProjectRole
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/")
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить данные для дашборда"""
    try:
        logger.info(f"Fetching dashboard data for user: {current_user.max_id}")

        # Получаем настройки пользователя
        result = await db.execute(
            select(UserSettings).where(UserSettings.user_id == current_user.id)
        )
        settings = result.scalar_one_or_none()

        if not settings:
            # Создаем настройки по умолчанию, если их нет
            settings = UserSettings(user_id=current_user.id)
            db.add(settings)
            await db.commit()
            await db.refresh(settings)

        # Получить проекты пользователя
        projects_result = await db.execute(
            select(ProjectMember)
            .where(ProjectMember.user_id == current_user.id)
            .options(selectinload(ProjectMember.member_project))
        )
        memberships = projects_result.scalars().all()

        projects_data = []
        total_tasks_count = 0
        overdue_tasks_count = 0

        for member in memberships:
            project = member.member_project

            # Статистика задач по проекту
            total_result = await db.execute(
                select(func.count(Task.id)).where(Task.project_id == project.id)
            )
            done_result = await db.execute(
                select(func.count(Task.id)).where(
                    Task.project_id == project.id,
                    Task.status == TaskStatus.DONE
                )
            )
            in_progress_result = await db.execute(
                select(func.count(Task.id)).where(
                    Task.project_id == project.id,
                    Task.status == TaskStatus.IN_PROGRESS
                )
            )
            todo_result = await db.execute(
                select(func.count(Task.id)).where(
                    Task.project_id == project.id,
                    Task.status == TaskStatus.TODO
                )
            )

            # Подсчет участников
            members_count_result = await db.execute(
                select(func.count(ProjectMember.id)).where(ProjectMember.project_id == project.id)
            )

            stats = {
                "tasks_count": total_result.scalar() or 0,
                "tasks_done": done_result.scalar() or 0,
                "tasks_in_progress": in_progress_result.scalar() or 0,
                "tasks_todo": todo_result.scalar() or 0,
                "members_count": members_count_result.scalar() or 0,
                "completion_percentage": round((done_result.scalar() or 0) / (total_result.scalar() or 1) * 100, 1)
            }

            total_tasks_count += stats["tasks_count"]

            project_data = {
                "id": project.id,
                "title": project.title,
                "description": project.description,
                "hash": project.hash,
                "is_private": project.is_private,
                "requires_approval": project.requires_approval,
                "created_at": project.created_at.isoformat() if project.created_at else None,
                "stats": stats,
                "user_role": member.role
            }
            projects_data.append(project_data)

        # Приоритетные задачи пользователя
        priority_tasks_result = await db.execute(
            select(Task)
            .join(Project, Task.project_id == Project.id)
            .join(ProjectMember, Project.id == ProjectMember.project_id)
            .where(
                ProjectMember.user_id == current_user.id,
                Task.status != TaskStatus.DONE
            )
            .order_by(Task.due_date.asc(), Task.priority.desc())
            .limit(10)
        )
        priority_tasks = priority_tasks_result.scalars().all()

        # Уведомления
        notifications_result = await db.execute(
            select(Notification)
            .where(Notification.user_id == current_user.id)
            .order_by(Notification.created_at.desc())
            .limit(10)
        )
        notifications = notifications_result.scalars().all()

        # Общая статистика
        user_projects_count = len(projects_data)
        active_projects_count = len([p for p in projects_data if p["stats"]["tasks_todo"] > 0])

        dashboard_data = {
            "user": {
                "id": current_user.id,
                "max_id": current_user.max_id,
                "full_name": current_user.full_name,
                "username": current_user.username
            },
            "settings": settings.to_dict() if settings else None,
            "summary": {
                "projects_count": user_projects_count,
                "active_projects": active_projects_count,
                "total_tasks": total_tasks_count,
                "overdue_tasks": overdue_tasks_count
            },
            "projects": projects_data,
            "priority_tasks": [
                {
                    "id": task.id,
                    "title": task.title,
                    "project_id": task.project_id,
                    "project_title": next((p["title"] for p in projects_data if p["id"] == task.project_id), ""),
                    "status": task.status,
                    "priority": task.priority,
                    "due_date": task.due_date.isoformat() if task.due_date else None,
                    "created_at": task.created_at.isoformat() if task.created_at else None
                } for task in priority_tasks
            ],
            "notifications": [
                {
                    "id": notification.id,
                    "type": notification.type,
                    "title": notification.title,
                    "message": notification.message,
                    "is_read": notification.is_read,
                    "created_at": notification.created_at.isoformat() if notification.created_at else None
                } for notification in notifications
            ]
        }

        logger.info(f"Dashboard data fetched successfully for user: {current_user.max_id}")
        return dashboard_data

    except Exception as e:
        logger.error(f"Error fetching dashboard data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

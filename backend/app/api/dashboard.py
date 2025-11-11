# app/api/dashboard.py
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.api import deps
from app.models import Project, ProjectMember, Task, User, UserSettings
from app.schemas.dashboard import DashboardResponse, ProjectResponse, UserSettingsResponse, TaskResponse
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


async def _get_project_ids_for_user(
    user: User, session: AsyncSession
) -> List[int]:
    """Возвращает список ID проектов, в которых состоит пользователь."""
    stmt = (
        select(ProjectMember.project_id)
        .where(ProjectMember.user_id == user.id)
    )
    result = await session.execute(stmt)
    return [row[0] for row in result.fetchall()]


async def _get_project_stats(
    project_id: int, session: AsyncSession
) -> dict:
    """Считает статистику по одному проекту."""
    try:
        # Общее количество задач
        total = await session.scalar(
            select(func.count(Task.id)).where(Task.project_id == project_id)
        )

        # По статусам
        done = await session.scalar(
            select(func.count(Task.id)).where(
                Task.project_id == project_id, Task.status == "done"
            )
        )
        in_progress = await session.scalar(
            select(func.count(Task.id)).where(
                Task.project_id == project_id, Task.status == "in_progress"
            )
        )
        todo = await session.scalar(
            select(func.count(Task.id)).where(
                Task.project_id == project_id, Task.status == "todo"
            )
        )

        # Участники
        members = await session.scalar(
            select(func.count(ProjectMember.id)).where(
                ProjectMember.project_id == project_id
            )
        )

        return {
            "total_tasks": total or 0,
            "done_tasks": done or 0,
            "in_progress_tasks": in_progress or 0,
            "todo_tasks": todo or 0,
            "members_count": members or 0,
        }
    except Exception as e:
        logger.error(f"Error getting stats for project {project_id}: {str(e)}")
        return {
            "total_tasks": 0,
            "done_tasks": 0,
            "in_progress_tasks": 0,
            "todo_tasks": 0,
            "members_count": 0,
        }


@router.get("/dashboard/", response_model=DashboardResponse)
async def get_dashboard(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db),
):
    """
    Возвращает дашборд:
    - настройки пользователя
    - список проектов (только те, где пользователь участник)
    - статистика по каждому проекту
    """
    try:
        logger.info(f"Fetching dashboard data for user: {current_user.max_id}")

        # 1. Настройки пользователя
        settings_stmt = select(UserSettings).where(
            UserSettings.user_id == current_user.id
        )
        settings_result = await db.execute(settings_stmt)
        settings = settings_result.scalar_one_or_none()
        if not settings:
            logger.warning(f"User settings not found for user: {current_user.id}")
            raise HTTPException(status_code=404, detail="User settings not found")

        # 2. ID проектов пользователя
        project_ids = await _get_project_ids_for_user(current_user, db)
        logger.info(f"User {current_user.max_id} has {len(project_ids)} projects")

        if not project_ids:
            return DashboardResponse(
                settings=UserSettingsResponse(**settings.to_dict()),
                projects=[],
                recent_tasks=[],
            )

        # 3. Данные проектов
        projects_stmt = select(Project).where(Project.id.in_(project_ids))
        projects_result = await db.execute(projects_stmt)
        projects = projects_result.scalars().all()

        # 4. Статистика по каждому проекту
        project_responses = []
        for project in projects:
            stats = await _get_project_stats(project.id, db)

            project_data = {
                "id": project.id,
                "title": project.title,
                "description": project.description,
                "hash": project.hash,
                "is_private": project.is_private,
                "requires_approval": project.requires_approval,
                "created_by": project.created_by,
                "created_at": project.created_at,
                "updated_at": project.updated_at,
                "total_tasks": stats["total_tasks"],
                "done_tasks": stats["done_tasks"],
                "in_progress_tasks": stats["in_progress_tasks"],
                "todo_tasks": stats["todo_tasks"],
                "members_count": stats["members_count"],
            }
            project_responses.append(ProjectResponse(**project_data))

        logger.info(f"Dashboard data fetched successfully for user: {current_user.max_id}")
        return DashboardResponse(
            settings=UserSettingsResponse(**settings.to_dict()),
            projects=project_responses,
            recent_tasks=[],  # пока пусто, можно добавить отдельный запрос
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error fetching dashboard data")
        raise HTTPException(
            status_code=500, detail="Internal server error while loading dashboard"
        ) from exc

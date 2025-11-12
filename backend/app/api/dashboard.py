# app/api/dashboard.py
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.api import deps
from app.models.enums import ProjectRole
from app.models import Project, ProjectMember, Task, User, UserSettings
from app.schemas.dashboard import DashboardResponse, ProjectResponse, UserSettingsResponse, TaskResponse, ProjectOwnerResponse, ProjectMemberResponse
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


async def _get_project_ids_for_user(
    user: User, session: AsyncSession
) -> List[int]:
    """Возвращает список ID проектов, в которых состоит пользователь (ЛЮБАЯ роль)."""
    stmt = (
        select(ProjectMember.project_id)
        .where(ProjectMember.user_id == user.id)
    )
    result = await session.execute(stmt)
    project_ids = [row[0] for row in result.fetchall()]
    logger.info(f"User {user.max_id} is member of projects: {project_ids}")
    return project_ids


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

# Заменить проблемную функцию _get_project_with_members:
async def _get_project_with_members(
    project_id: int,
    current_user_id: int,
    session: AsyncSession
) -> dict:
    """Получить проект с информацией об участниках и владельце"""
    try:
        # Получить проект
        project_stmt = select(Project).where(Project.id == project_id)
        project_result = await session.execute(project_stmt)
        project = project_result.scalar_one_or_none()

        if not project:
            return None

        # Получить владельца
        owner_stmt = select(User).where(User.id == project.created_by)
        owner_result = await session.execute(owner_stmt)
        owner = owner_result.scalar_one_or_none()

        # Получить всех участников с информацией о пользователях
        members_stmt = (
            select(ProjectMember, User)
            .join(User, ProjectMember.user_id == User.id)
            .where(ProjectMember.project_id == project_id)
        )
        members_result = await session.execute(members_stmt)
        members_data = members_result.all()

        # Найти роль текущего пользователя
        current_user_role = None
        members_list = []

        # Сначала проверим, является ли пользователь владельцем проекта
        if project.created_by == current_user_id:
            current_user_role = ProjectRole.OWNER

        # Добавляем всех участников
        for member, user in members_data:
            member_data = {
                "user_id": user.id,
                "role": member.role,
                "max_id": user.max_id,
                "full_name": user.full_name,
                "username": user.username,
                "joined_at": member.joined_at
            }
            members_list.append(member_data)

            # Если пользователь не владелец, но найден в участниках
            if user.id == current_user_id and current_user_role != ProjectRole.OWNER:
                current_user_role = member.role

        # Если пользователь владелец, но не найден в участниках, добавим его
        if project.created_by == current_user_id and not any(m['user_id'] == current_user_id for m in members_list):
            if owner:
                members_list.append({
                    "user_id": owner.id,
                    "role": ProjectRole.OWNER,
                    "max_id": owner.max_id,
                    "full_name": owner.full_name,
                    "username": owner.username,
                    "joined_at": project.created_at
                })

        # Информация о владельце
        owner_info = None
        if owner:
            owner_info = {
                "id": owner.id,
                "max_id": owner.max_id,
                "full_name": owner.full_name,
                "username": owner.username
            }

        return {
            "project": project,
            "owner_info": owner_info,
            "members": members_list,
            "current_user_role": current_user_role or ProjectRole.MEMBER
        }

    except Exception as e:
        logger.error(f"Error getting project members for project {project_id}: {str(e)}")
        return None

@router.get("/dashboard/", response_model=DashboardResponse)
async def get_dashboard(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db),
):
    """
    Возвращает дашборд
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
            # Создаем настройки по умолчанию
            settings = UserSettings(user_id=current_user.id)
            db.add(settings)
            await db.commit()
            await db.refresh(settings)

        # 2. ID проектов пользователя
        project_ids = await _get_project_ids_for_user(current_user, db)
        logger.info(f"User {current_user.max_id} is member of {len(project_ids)} projects")

        if not project_ids:
            logger.info(f"User {current_user.max_id} has no projects")
            return DashboardResponse(
                settings=UserSettingsResponse(**settings.to_dict()),
                projects=[],
                recent_tasks=[],
            )

        # 3. Данные проектов с участниками
        project_responses = []
        for project_id in project_ids:
            try:
                # Получаем полную информацию о проекте с участниками
                project_data = await _get_project_with_members(project_id, current_user.id, db)

                if not project_data or not project_data["project"]:
                    logger.warning(f"Project {project_id} not found or inaccessible")
                    continue

                project = project_data["project"]
                stats = await _get_project_stats(project.id, db)

                # Формируем ответ
                project_response_data = {
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
                    "owner_info": ProjectOwnerResponse(**project_data["owner_info"]) if project_data["owner_info"] else None,
                    "members": [ProjectMemberResponse(**member) for member in project_data["members"]],
                    "current_user_role": project_data["current_user_role"] or "member"
                }
                project_responses.append(ProjectResponse(**project_response_data))

            except Exception as e:
                logger.error(f"Error processing project {project_id}: {str(e)}")
                continue

        logger.info(f"Dashboard data fetched successfully for user: {current_user.max_id}. Found {len(project_responses)} projects")
        return DashboardResponse(
            settings=UserSettingsResponse(**settings.to_dict()),
            projects=project_responses,
            recent_tasks=[],
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error fetching dashboard data")
        raise HTTPException(
            status_code=500, detail="Internal server error while loading dashboard"
        ) from exc

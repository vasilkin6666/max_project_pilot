from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import User, ProjectMember, Project, Task
from app.api.deps import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/{user_id}")
async def get_user(user_id: str, db: AsyncSession = Depends(get_db)):
    try:
        logger.info(f"Fetching user data for user_id: {user_id}")
        result = await db.execute(select(User).where(User.max_id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            logger.error(f"User not found for user_id: {user_id}")
            raise HTTPException(status_code=404, detail="User not found")
        logger.info(f"User data fetched successfully for user_id: {user_id}")
        return {
            "id": user.id,
            "max_id": user.max_id,
            "full_name": user.full_name,
            "username": user.username
        }
    except Exception as e:
        logger.error(f"Error fetching user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/{user_id}/projects")
async def get_user_projects(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.max_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this user's projects")

    # Получаем членства в проектах
    result = await db.execute(
        select(ProjectMember)
        .where(ProjectMember.user_id == current_user.id)
        .options(
            selectinload(ProjectMember.project).selectinload(Project.members),
            selectinload(ProjectMember.project).selectinload(Project.tasks)
        )
    )
    memberships = result.scalars().all()

    projects_with_stats = []
    for member in memberships:
        project = member.project

        # АЛЬТЕРНАТИВНОЕ РЕШЕНИЕ: отдельные запросы для каждого статуса
        total_result = await db.execute(
            select(func.count(Task.id)).where(Task.project_id == project.id)
        )
        done_result = await db.execute(
            select(func.count(Task.id)).where(
                Task.project_id == project.id,
                Task.status == 'done'
            )
        )
        in_progress_result = await db.execute(
            select(func.count(Task.id)).where(
                Task.project_id == project.id,
                Task.status == 'in_progress'
            )
        )
        todo_result = await db.execute(
            select(func.count(Task.id)).where(
                Task.project_id == project.id,
                Task.status == 'todo'
            )
        )

        stats = {
            "tasks_count": total_result.scalar() or 0,
            "tasks_done": done_result.scalar() or 0,
            "tasks_in_progress": in_progress_result.scalar() or 0,
            "tasks_todo": todo_result.scalar() or 0
        }

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
            "members": [{"user_id": m.user_id, "role": m.role} for m in project.members] if project.members else [],
            "stats": stats
        }
        projects_with_stats.append({
            "project": project_data,
            "role": member.role
        })

    return {"projects": projects_with_stats}

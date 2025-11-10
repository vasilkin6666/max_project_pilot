# backend/app/api/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import User, ProjectMember, Project, Task
from app.api.deps import get_current_user
from app.core.exceptions import NotFoundException, ForbiddenException
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me")
async def read_users_me(
    current_user: User = Depends(get_current_user),
):
    """Получить данные текущего аутентифицированного пользователя"""
    logger.info(f"Fetching current user data for: {current_user.max_id}")
    try:
        return {
            "id": current_user.id,
            "max_id": current_user.max_id,
            "full_name": current_user.full_name,
            "username": current_user.username,
            "is_active": current_user.is_active,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None
        }
    except Exception as e:
        logger.error(f"Error fetching current user data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/{user_id}")
async def get_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить данные пользователя по ID"""
    try:
        if user_id == "me":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Use /api/users/me endpoint for current user data"
            )

        logger.info(f"Fetching user data for user_id: {user_id}")

        # КРИТИЧЕСКАЯ ПРОВЕРКА ДОСТУПА
        if user_id != current_user.max_id:
            logger.warning(f"User {current_user.max_id} attempted to access profile of {user_id}")
            raise HTTPException(status_code=403, detail="Access denied - can only view own profile")

        result = await db.execute(select(User).where(User.max_id == user_id))
        user = result.scalar_one_or_none()

        if not user:
            logger.warning(f"User not found for user_id: {user_id}")
            raise NotFoundException("User not found")

        logger.info(f"User data fetched successfully for user_id: {user_id}")
        return {
            "id": user.id,
            "max_id": user.max_id,
            "full_name": user.full_name,
            "username": user.username,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/{user_id}/projects")
async def get_user_projects(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить проекты пользователя"""
    try:
        if current_user.max_id != user_id:
            logger.warning(f"User {current_user.max_id} attempted to access projects of {user_id}")
            raise HTTPException(status_code=403, detail="Not authorized to view this user's projects")

        logger.info(f"Fetching projects for user: {user_id}")

        result = await db.execute(
            select(ProjectMember)
            .where(ProjectMember.user_id == current_user.id)
            .options(selectinload(ProjectMember.member_project))
        )
        memberships = result.scalars().all()

        projects_with_stats = []

        for member in memberships:
            project = member.member_project

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

            members_result = await db.execute(
                select(ProjectMember)
                .where(ProjectMember.project_id == project.id)
                .options(selectinload(ProjectMember.member_user))
            )
            project_members = members_result.scalars().all()

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
                "members": [
                    {
                        "user_id": m.user_id,
                        "role": m.role,
                        "user": {
                            "id": m.member_user.id,
                            "max_id": m.member_user.max_id,
                            "full_name": m.member_user.full_name,
                            "username": m.member_user.username
                        } if m.member_user else None
                    } for m in project_members
                ],
                "stats": stats
            }
            projects_with_stats.append({
                "project": project_data,
                "role": member.role
            })

        logger.info(f"Successfully fetched {len(projects_with_stats)} projects for user: {user_id}")
        return {"projects": projects_with_stats}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching projects for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.put("/me")
async def update_current_user(
    full_name: str = None,
    username: str = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновить данные текущего пользователя"""
    try:
        logger.info(f"Updating user data for: {current_user.max_id}")

        update_data = {}
        if full_name is not None:
            update_data["full_name"] = full_name
        if username is not None:
            update_data["username"] = username

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No data provided for update"
            )

        for field, value in update_data.items():
            setattr(current_user, field, value)

        await db.commit()
        await db.refresh(current_user)

        logger.info(f"Successfully updated user: {current_user.max_id}")
        return {
            "id": current_user.id,
            "max_id": current_user.max_id,
            "full_name": current_user.full_name,
            "username": current_user.username,
            "is_active": current_user.is_active,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user {current_user.max_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

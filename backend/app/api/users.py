# backend/app/api/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import User, ProjectMember, Project, Task, UserSettings
from app.api.deps import get_current_user
from app.core.exceptions import NotFoundException, ForbiddenException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])

# Pydantic модели
class UserPreferences(BaseModel):
    theme: Optional[str] = None
    language: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    email_notifications: Optional[bool] = None
    push_notifications: Optional[bool] = None
    compact_view: Optional[bool] = None
    show_completed_tasks: Optional[bool] = None
    default_project_view: Optional[str] = None
    timezone: Optional[str] = None
    date_format: Optional[str] = None
    time_format: Optional[str] = None
    items_per_page: Optional[int] = None
    custom_settings: Optional[Dict[str, Any]] = None

class UserPreferencesResponse(BaseModel):
    id: int
    user_id: int
    theme: str
    language: str
    notifications_enabled: bool
    email_notifications: bool
    push_notifications: bool
    compact_view: bool
    show_completed_tasks: bool
    default_project_view: str
    timezone: str
    date_format: str
    time_format: str
    items_per_page: int
    custom_settings: Dict[str, Any]
    created_at: str
    updated_at: Optional[str] = None

async def get_or_create_user_settings(user_id: int, db: AsyncSession) -> UserSettings:
    """Получить или создать настройки пользователя"""
    try:
        result = await db.execute(
            select(UserSettings).where(UserSettings.user_id == user_id)
        )
        settings = result.scalar_one_or_none()

        if not settings:
            settings = UserSettings(user_id=user_id)
            db.add(settings)
            await db.commit()
            await db.refresh(settings)

        return settings
    except Exception as e:
        logger.error(f"Error in get_or_create_user_settings: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error accessing user settings"
        )

@router.get("/me")
async def read_users_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить данные текущего аутентифицированного пользователя"""
    logger.info(f"Fetching current user data for: {current_user.max_id}")
    try:
        # Загружаем настройки пользователя
        settings = await get_or_create_user_settings(current_user.id, db)

        return {
            "id": current_user.id,
            "max_id": current_user.max_id,
            "full_name": current_user.full_name,
            "username": current_user.username,
            "is_active": current_user.is_active,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
            "updated_at": current_user.updated_at.isoformat() if current_user.updated_at else None,
            "settings": settings.to_dict() if settings else None
        }
    except Exception as e:
        logger.error(f"Error fetching current user data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/me/preferences", response_model=UserPreferencesResponse)
async def get_user_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить настройки пользователя"""
    try:
        logger.info(f"Fetching preferences for user: {current_user.max_id}")

        # Получаем или создаем настройки
        settings = await get_or_create_user_settings(current_user.id, db)

        return settings.to_dict()

    except Exception as e:
        logger.error(f"Error fetching user preferences: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.put("/me/preferences", response_model=UserPreferencesResponse)
async def update_user_preferences(
    preferences: UserPreferences,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновить настройки пользователя"""
    try:
        logger.info(f"Updating preferences for user: {current_user.max_id}")

        # Получаем или создаем настройки
        settings = await get_or_create_user_settings(current_user.id, db)

        # Обновляем только переданные поля
        update_fields = preferences.dict(exclude_unset=True)

        for field, value in update_fields.items():
            if hasattr(settings, field):
                if field == 'custom_settings' and value is not None:
                    # Для кастомных настроек мержим с существующими
                    current_custom = settings.get_custom_settings()
                    current_custom.update(value)
                    settings.set_custom_settings(current_custom)
                else:
                    setattr(settings, field, value)

        await db.commit()
        await db.refresh(settings)

        logger.info(f"Successfully updated preferences for user: {current_user.max_id}")
        return settings.to_dict()

    except Exception as e:
        logger.error(f"Error updating user preferences: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.patch("/me/preferences", response_model=UserPreferencesResponse)
async def patch_user_preferences(
    preferences: UserPreferences,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Частичное обновление настроек пользователя"""
    try:
        logger.info(f"Patching preferences for user: {current_user.max_id}")

        # Получаем или создаем настройки
        settings = await get_or_create_user_settings(current_user.id, db)

        # Обновляем только переданные поля
        update_fields = preferences.dict(exclude_unset=True, exclude_none=True)

        for field, value in update_fields.items():
            if hasattr(settings, field):
                if field == 'custom_settings' and value is not None:
                    # Для кастомных настроек мержим с существующими
                    current_custom = settings.get_custom_settings()
                    current_custom.update(value)
                    settings.set_custom_settings(current_custom)
                else:
                    setattr(settings, field, value)

        await db.commit()
        await db.refresh(settings)

        logger.info(f"Successfully patched preferences for user: {current_user.max_id}")
        return settings.to_dict()

    except Exception as e:
        logger.error(f"Error patching user preferences: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.put("/me/preferences/reset")
async def reset_user_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Сбросить настройки пользователя к значениям по умолчанию"""
    try:
        logger.info(f"Resetting preferences for user: {current_user.max_id}")

        # Получаем настройки
        result = await db.execute(
            select(UserSettings).where(UserSettings.user_id == current_user.id)
        )
        settings = result.scalar_one_or_none()

        if settings:
            # Удаляем текущие настройки
            await db.delete(settings)
            await db.commit()

        # Создаем новые настройки по умолчанию
        new_settings = await get_or_create_user_settings(current_user.id, db)

        logger.info(f"Successfully reset preferences for user: {current_user.max_id}")
        return {
            "status": "success",
            "message": "Preferences reset to default",
            "preferences": new_settings.to_dict()
        }

    except Exception as e:
        logger.error(f"Error resetting user preferences: {str(e)}")
        await db.rollback()
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
        # ИСПРАВЛЕНИЕ: Обработка случая "me"
        if user_id == "me":
            # Разрешить доступ к собственным проектам
            target_user_id = current_user.max_id
        else:
            # Проверка доступа к чужим проектам
            if current_user.max_id != user_id:
                logger.warning(f"User {current_user.max_id} attempted to access projects of {user_id}")
                raise HTTPException(status_code=403, detail="Not authorized to view this user's projects")
            target_user_id = user_id

        logger.info(f"Fetching projects for user: {target_user_id}")

        # Получаем пользователя по max_id
        result = await db.execute(
            select(User).where(User.max_id == target_user_id)
        )
        target_user = result.scalar_one_or_none()

        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")

        result = await db.execute(
            select(ProjectMember)
            .where(ProjectMember.user_id == target_user.id)
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

        logger.info(f"Successfully fetched {len(projects_with_stats)} projects for user: {target_user_id}")
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

# backend/app/api/deps.py
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User
from app.core.security import verify_token
from sqlalchemy import select
import logging

logger = logging.getLogger(__name__)

async def get_current_user(
    authorization: str = Header(..., description="Bearer token"),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Получить текущего аутентифицированного пользователя"""
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.replace("Bearer ", "")
    user_id = verify_token(token)

    if not user_id:
        logger.warning(f"Invalid token provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(select(User).where(User.max_id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        logger.error(f"User not found for max_id: {user_id}")
        raise HTTPException(status_code=404, detail="User not found")

    if not user.is_active:
        logger.warning(f"Inactive user attempted access: {user_id}")
        raise HTTPException(status_code=403, detail="User account is disabled")

    logger.info(f"Authenticated user: {user.max_id} (ID: {user.id})")
    return user

async def get_current_user_data(
    authorization: str = Header(..., description="Bearer token"),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Получить сериализуемые данные текущего пользователя"""
    user = await get_current_user(authorization, db)

    # Возвращаем только базовые данные для сериализации
    return {
        "id": user.id,
        "max_id": user.max_id,
        "full_name": user.full_name,
        "username": user.username,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None
    }

async def get_current_user_id(
    authorization: str = Header(..., description="Bearer token"),
    db: AsyncSession = Depends(get_db)
) -> int:
    """Получить только ID текущего пользователя (для оптимизации)"""
    user = await get_current_user(authorization, db)
    return user.id

async def require_project_access(
    project_id: int,
    user_id: int,
    db: AsyncSession,
    require_manage: bool = False
) -> bool:
    """Проверить доступ пользователя к проекту"""
    from app.models import ProjectMember, ProjectRole
    from sqlalchemy import select

    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id
        )
    )
    member = result.scalar_one_or_none()

    if not member:
        return False

    if require_manage and member.role not in [ProjectRole.OWNER, ProjectRole.ADMIN]:
        return False

    return True

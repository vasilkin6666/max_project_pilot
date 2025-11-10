# backend/app/api/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import User
from app.core.security import create_access_token
from datetime import timedelta
from app.config import settings
from pydantic import BaseModel, Field
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

class TokenRequest(BaseModel):
    max_id: str = Field(..., min_length=1, max_length=100, description="User MAX ID")
    full_name: str = Field(..., min_length=1, max_length=200, description="User full name")
    username: str = Field("", max_length=100, description="Username (optional)")

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

# Перенесем функцию get_current_user сюда, чтобы избежать циклического импорта
async def get_current_user_for_auth(
    authorization: str = None,
    db: AsyncSession = Depends(get_db)
) -> User:
    """Получить текущего аутентифицированного пользователя для auth модуля"""
    from app.core.security import verify_token

    if not authorization or not authorization.startswith("Bearer "):
        logger.warning("Missing or invalid authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.replace("Bearer ", "")
    user_max_id = verify_token(token)

    if not user_max_id:
        logger.warning("Invalid token provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    logger.info(f"Looking for user with max_id: {user_max_id}")

    result = await db.execute(select(User).where(User.max_id == user_max_id))
    user = result.scalar_one_or_none()

    if user is None:
        logger.error(f"User not found for max_id: {user_max_id}")
        raise HTTPException(status_code=404, detail="User not found")

    if not user.is_active:
        logger.warning(f"Inactive user attempted access: {user_max_id}")
        raise HTTPException(status_code=403, detail="User account is disabled")

    logger.info(f"Authenticated user: {user.max_id} (ID: {user.id})")
    return user

@router.post("/token", response_model=TokenResponse)
async def login_or_create_user(
    request: TokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """Аутентификация или создание пользователя"""
    logger.info(f"Received token request for user_id: {request.max_id}")

    try:
        # Поиск существующего пользователя
        result = await db.execute(select(User).where(User.max_id == request.max_id))
        user = result.scalar_one_or_none()

        if not user:
            logger.info(f"Creating new user with max_id: {request.max_id}")
            user = User(
                max_id=request.max_id,
                full_name=request.full_name,
                username=request.username or ""
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            logger.info(f"User created successfully with ID: {user.id}")
        else:
            logger.info(f"User found with ID: {user.id}")

            # Обновляем данные пользователя, если они изменились
            if (user.full_name != request.full_name or
                user.username != (request.username or "")):
                user.full_name = request.full_name
                user.username = request.username or ""
                await db.commit()
                await db.refresh(user)
                logger.info(f"User data updated for: {request.max_id}")

        # Создание токена
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.max_id},
            expires_delta=access_token_expires
        )

        logger.info(f"Token generated for user_id: {request.max_id}")

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user={
                "id": user.id,
                "max_id": user.max_id,
                "full_name": user.full_name,
                "username": user.username
            }
        )

    except Exception as e:
        logger.error(f"Error during authentication for {request.max_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed"
        )

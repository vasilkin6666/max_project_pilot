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

@router.post("/refresh")
async def refresh_token(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновление токена"""
    try:
        logger.info(f"Refreshing token for user: {current_user.max_id}")

        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": current_user.max_id},
            expires_delta=access_token_expires
        )

        logger.info(f"Token refreshed for user_id: {current_user.max_id}")

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user={
                "id": current_user.id,
                "max_id": current_user.max_id,
                "full_name": current_user.full_name,
                "username": current_user.username
            }
        )

    except Exception as e:
        logger.error(f"Error refreshing token for {current_user.max_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed"
        )

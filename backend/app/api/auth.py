from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import User
from app.core.security import create_access_token
from datetime import timedelta
from app.config import settings
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

class TokenRequest(BaseModel):
    max_id: str
    full_name: str
    username: str = ""  # Изменено на пустую строку вместо None

@router.post("/token")
async def login_or_create_user(request: TokenRequest, db: AsyncSession = Depends(get_db)):
    logger.info(f"Received token request for user_id: {request.max_id}")

    result = await db.execute(select(User).where(User.max_id == request.max_id))
    user = result.scalar_one_or_none()

    if not user:
        logger.info(f"Creating new user with max_id: {request.max_id}")
        user = User(max_id=request.max_id, full_name=request.full_name, username=request.username or "")
        db.add(user)
        await db.commit()
        await db.refresh(user)
        logger.info(f"User created successfully with ID: {user.id}")
    else:
        logger.info(f"User found with ID: {user.id}")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.max_id}, expires_delta=access_token_expires
    )

    logger.info(f"Token generated for user_id: {request.max_id}")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "max_id": user.max_id,
            "full_name": user.full_name,
            "username": user.username
        }
    }

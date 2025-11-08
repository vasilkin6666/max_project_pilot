# backend/app/api/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import User
from app.core.security import create_access_token
from datetime import timedelta
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/token")
async def login_or_create_user(max_id: str, full_name: str, username: str = None, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.max_id == max_id))
    user = result.scalar_one_or_none()
    if not user:
        user = User(max_id=max_id, full_name=full_name, username=username)
        db.add(user)
        await db.commit()
        await db.refresh(user)

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.max_id}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "user": {"id": user.max_id, "full_name": user.full_name}}

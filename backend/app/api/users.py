# backend/app/api/users.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import User, ProjectMember
from app.api.deps import get_current_user

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/{user_id}/projects")
async def get_user_projects(user_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.max_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this user's projects")
    result = await db.execute(
        select(ProjectMember).where(ProjectMember.user_id == current_user.id)
    )
    memberships = result.scalars().all()
    projects = [member.project for member in memberships]
    return {"projects": projects}

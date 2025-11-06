from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.services import (
    notify_task_completed,
    notify_task_assigned,
    notify_user_joined,
    get_project_by_hash
)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.post("/task_completed")
async def api_task_completed(
    task_id: int,
    completed_by_user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """API для отправки уведомлений о завершении задачи"""
    await notify_task_completed(task_id, completed_by_user_id)
    return {"status": "success", "message": "Уведомления отправлены"}

@router.post("/task_assigned")
async def api_task_assigned(
    task_id: int,
    assigned_to_user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """API для отправки уведомлений о назначении задачи"""
    await notify_task_assigned(task_id, assigned_to_user_id)
    return {"status": "success", "message": "Уведомление отправлено"}

@router.post("/user_joined")
async def api_user_joined(
    project_id: int,
    joined_user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """API для отправки уведомлений о новом участнике"""
    await notify_user_joined(project_id, joined_user_id)
    return {"status": "success", "message": "Уведомления отправлены"}

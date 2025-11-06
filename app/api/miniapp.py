from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.services import (
    get_or_create_user,
    get_user_projects,
    create_project,
    get_project_by_hash,
    create_task,
    get_project_tasks,
    add_user_to_project,
    notify_task_completed,
    notify_task_assigned
)
from app.models import Task, Project
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/api/miniapp", tags=["miniapp"])

# Модели запросов
class CreateProjectRequest(BaseModel):
    title: str
    description: str = ""
    is_private: bool = True

class CreateTaskRequest(BaseModel):
    project_hash: str
    title: str
    description: str = ""
    priority: str = "medium"
    due_date: datetime = None

class CompleteTaskRequest(BaseModel):
    task_id: int

# Получить проекты пользователя
@router.get("/user/{max_id}/projects")
async def get_user_projects_api(max_id: str, db: AsyncSession = Depends(get_db)):
    user = await get_or_create_user(max_id, "MiniApp User")
    projects_data = await get_user_projects(user.id)

    return {
        "user": {
            "id": user.id,
            "max_id": user.max_id,
            "full_name": user.full_name
        },
        "projects": [
            {
                "id": member.project.id,
                "hash": member.project.hash,
                "title": member.project.title,
                "description": member.project.description,
                "is_private": member.project.is_private,
                "created_at": member.project.created_at.isoformat(),
                "role": member.role,
                "stats": {
                    "members_count": len(member.project.members),
                    "tasks_count": len(member.project.tasks),
                    "tasks_todo": len([t for t in member.project.tasks if t.status == "todo"]),
                    "tasks_in_progress": len([t for t in member.project.tasks if t.status == "in_progress"]),
                    "tasks_done": len([t for t in member.project.tasks if t.status == "done"])
                }
            }
            for member in projects_data
        ]
    }

# Создать проект
@router.post("/user/{max_id}/projects")
async def create_project_api(
    max_id: str,
    request: CreateProjectRequest,
    db: AsyncSession = Depends(get_db)
):
    user = await get_or_create_user(max_id, "MiniApp User")
    project = await create_project(
        user,
        request.title,
        request.description,
        request.is_private
    )

    return {
        "status": "success",
        "project": {
            "id": project.id,
            "hash": project.hash,
            "title": project.title,
            "description": project.description,
            "is_private": project.is_private,
            "created_at": project.created_at.isoformat()
        }
    }

# Получить задачи проекта
@router.get("/projects/{project_hash}/tasks")
async def get_project_tasks_api(project_hash: str, db: AsyncSession = Depends(get_db)):
    project = await get_project_by_hash(project_hash)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    tasks = await get_project_tasks(project.id)

    return {
        "project": {
            "id": project.id,
            "title": project.title,
            "hash": project.hash
        },
        "tasks": [
            {
                "id": task.id,
                "title": task.title,
                "description": task.description,
                "priority": task.priority,
                "status": task.status,
                "due_date": task.due_date.isoformat() if task.due_date else None,
                "created_at": task.created_at.isoformat(),
                "assignees": [
                    {
                        "user_id": assignee.user.id,
                        "max_id": assignee.user.max_id,
                        "full_name": assignee.user.full_name
                    }
                    for assignee in task.assignees
                ]
            }
            for task in tasks
        ]
    }

# Создать задачу
@router.post("/tasks")
async def create_task_api(request: CreateTaskRequest, db: AsyncSession = Depends(get_db)):
    project = await get_project_by_hash(request.project_hash)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    task = await create_task(
        project.id,
        request.title,
        request.description,
        request.priority,
        request.due_date
    )

    return {
        "status": "success",
        "task": {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "priority": task.priority,
            "status": task.status,
            "project_hash": request.project_hash
        }
    }

# Завершить задачу
@router.post("/tasks/{task_id}/complete")
async def complete_task_api(
    task_id: int,
    request: CompleteTaskRequest,
    db: AsyncSession = Depends(get_db)
):
    # Здесь будет логика завершения задачи
    # Пока просто возвращаем успех
    return {
        "status": "success",
        "message": f"Task {task_id} completed",
        "task_id": task_id
    }

# Пригласить пользователя в проект
@router.post("/projects/{project_hash}/invite/{max_id}")
async def invite_to_project_api(
    project_hash: str,
    max_id: str,
    db: AsyncSession = Depends(get_db)
):
    project = await get_project_by_hash(project_hash)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user = await get_or_create_user(max_id, "Invited User")
    member = await add_user_to_project(user.id, project.id)

    return {
        "status": "success",
        "message": f"User {max_id} added to project",
        "project": project.title,
        "role": member.role
    }

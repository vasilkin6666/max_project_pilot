from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from app.services import (
    get_or_create_user,
    get_user_projects,
    create_project,
    get_project_by_hash,
    get_project_tasks,
    create_task,
    add_user_to_project,
    generate_hash
)
import json

router = APIRouter(prefix="/api/direct", tags=["direct"])

class BotResponse(BaseModel):
    success: bool
    data: dict = None
    error: str = None

@router.post("/user/{user_id}/data")
async def get_user_data(user_id: str, request: Request):
    """Прямой эндпоинт для получения данных пользователя от мини-приложения"""
    try:
        body = await request.json()
        action = body.get("action", "get_projects")

        print(f"Direct API call: user_id={user_id}, action={action}")

        if action == "get_projects":
            user = await get_or_create_user(user_id, "Web App User")
            projects_data = await get_user_projects(user.id)

            # Форматируем данные для мини-приложения
            formatted_projects = []
            for member in projects_data:
                project = member.project
                formatted_projects.append({
                    "id": project.id,
                    "hash": project.hash,
                    "title": project.title,
                    "description": project.description,
                    "is_private": project.is_private,
                    "role": member.role,
                    "stats": {
                        "members_count": len(project.members),
                        "tasks_count": len(project.tasks),
                        "tasks_todo": len([t for t in project.tasks if t.status == "todo"]),
                        "tasks_in_progress": len([t for t in project.tasks if t.status == "in_progress"]),
                        "tasks_done": len([t for t in project.tasks if t.status == "done"])
                    }
                })

            return {
                "success": True,
                "data": {
                    "user": {
                        "id": user.id,
                        "max_id": user.max_id,
                        "full_name": user.full_name
                    },
                    "projects": formatted_projects
                }
            }

        elif action == "create_project":
            user = await get_or_create_user(user_id, "Web App User")
            project_data = body.get("data", {})

            project = await create_project(
                user,
                project_data.get("title", "Новый проект"),
                project_data.get("description", ""),
                project_data.get("is_private", True)
            )

            return {
                "success": True,
                "data": {
                    "project": {
                        "id": project.id,
                        "hash": project.hash,
                        "title": project.title,
                        "description": project.description
                    }
                }
            }

        elif action == "get_project_tasks":
            project_hash = body.get("data", {}).get("project_hash")
            project = await get_project_by_hash(project_hash)

            if not project:
                return {"success": False, "error": "Project not found"}

            tasks = await get_project_tasks(project.id)

            formatted_tasks = []
            for task in tasks:
                formatted_tasks.append({
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
                })

            return {
                "success": True,
                "data": {
                    "project": {
                        "id": project.id,
                        "title": project.title,
                        "hash": project.hash
                    },
                    "tasks": formatted_tasks
                }
            }

        elif action == "create_task":
            project_hash = body.get("data", {}).get("project_hash")
            task_data = body.get("data", {})

            project = await get_project_by_hash(project_hash)
            if not project:
                return {"success": False, "error": "Project not found"}

            task = await create_task(
                project.id,
                task_data.get("title"),
                task_data.get("description", ""),
                task_data.get("priority", "medium"),
                None  # due_date можно добавить позже
            )

            return {
                "success": True,
                "data": {
                    "task": {
                        "id": task.id,
                        "title": task.title,
                        "project_hash": project_hash
                    }
                }
            }

        elif action == "invite_user":
            project_hash = body.get("data", {}).get("project_hash")
            target_user_id = body.get("data", {}).get("target_user_id")

            project = await get_project_by_hash(project_hash)
            if not project:
                return {"success": False, "error": "Project not found"}

            # Добавляем пользователя в проект
            target_user = await get_or_create_user(target_user_id, "Invited User")
            member = await add_user_to_project(target_user.id, project.id)

            return {
                "success": True,
                "data": {
                    "message": f"User {target_user_id} added to project",
                    "project": project.title,
                    "role": member.role
                }
            }

        elif action == "generate_invite":
            project_hash = body.get("data", {}).get("project_hash")
            project = await get_project_by_hash(project_hash)

            if not project:
                return {"success": False, "error": "Project not found"}

            # Генерируем инвайт-ссылку
            invite_link = f"https://vasilkin6666.github.io/max_project_pilot/webapp/?invite={project_hash}"

            return {
                "success": True,
                "data": {
                    "invite_link": invite_link,
                    "project_hash": project_hash,
                    "project_title": project.title
                }
            }

        else:
            return {"success": False, "error": f"Unknown action: {action}"}

    except Exception as e:
        print(f"Error in direct API: {e}")
        return {"success": False, "error": str(e)}

@router.get("/health")
async def health():
    return {"status": "bot_direct_api_ready", "message": "Direct API is working"}

@router.get("/user/{user_id}/ping")
async def ping_user(user_id: str):
    """Проверка связи с ботом для конкретного пользователя"""
    try:
        user = await get_or_create_user(user_id, "Test User")
        return {
            "success": True,
            "data": {
                "user_id": user_id,
                "bot_status": "online",
                "user_exists": True
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/config")
async def get_bot_config():
    """Возвращает конфигурацию бота для веб-приложения"""
    from app.config import settings

    return {
        "bot_public_url": settings.BOT_PUBLIC_URL,
        "miniapp_url": settings.MINIAPP_URL,
        "api_routes": {
            "user_data": "/api/direct/user/{user_id}/data",
            "health": "/api/direct/health"
        }
    }

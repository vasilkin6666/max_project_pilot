from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.services import get_project_by_hash, get_project_tasks, get_project_members

router = APIRouter(prefix="/api/projects", tags=["projects"])

@router.get("/health")
async def health():
    return {"status": "ok", "service": "MAX Project Pilot", "version": "1.0.0"}

@router.get("/{project_hash}/tasks")
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
                        "full_name": assignee.user.full_name
                    }
                    for assignee in task.assignees
                ]
            }
            for task in tasks
        ]
    }

@router.get("/{project_hash}/members")
async def get_project_members_api(project_hash: str, db: AsyncSession = Depends(get_db)):
    project = await get_project_by_hash(project_hash)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    members = await get_project_members(project.id)
    return {
        "project": {
            "id": project.id,
            "title": project.title,
            "hash": project.hash
        },
        "members": [
            {
                "user_id": member.user.id,
                "max_id": member.user.max_id,
                "full_name": member.user.full_name,
                "role": member.role,
                "joined_at": member.joined_at.isoformat()
            }
            for member in members
        ]
    }

@router.get("/{project_hash}/info")
async def get_project_info(project_hash: str, db: AsyncSession = Depends(get_db)):
    project = await get_project_by_hash(project_hash)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    tasks = await get_project_tasks(project.id)
    members = await get_project_members(project.id)

    return {
        "project": {
            "id": project.id,
            "title": project.title,
            "description": project.description,
            "hash": project.hash,
            "is_private": project.is_private,
            "created_at": project.created_at.isoformat(),
            "owner_id": project.owner_id
        },
        "stats": {
            "tasks_total": len(tasks),
            "tasks_todo": len([t for t in tasks if t.status == "todo"]),
            "tasks_in_progress": len([t for t in tasks if t.status == "in_progress"]),
            "tasks_done": len([t for t in tasks if t.status == "done"]),
            "members_count": len(members)
        }
    }

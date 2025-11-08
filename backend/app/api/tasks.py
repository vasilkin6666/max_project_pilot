from fastapi import APIRouter, Query, Depends
from sqlalchemy import select
from ...models import Task, Project
from ...db import get_db

router = APIRouter(prefix="/api")

@router.get("/tasks/{project_hash}")
async def get_tasks(project_hash: str, user_id: str = Query(...), db: Session = Depends(get_db)):
    result = await db.execute(
        select(Task).where(Task.project.has(hash=project_hash))
    )
    tasks = result.scalars().all()
    return {
        "tasks": [
            {
                "id": t.id,
                "title": t.title,
                "desc": t.desc or "",
                "column": t.column,
                "done": t.done,
                "assignee": t.assignee or "",
                "due": t.due.isoformat() if t.due else None,
                "subtasks": t.subtasks,
                "comments": t.comments,
                "files": t.files
            }
            for t in tasks
        ]
    }

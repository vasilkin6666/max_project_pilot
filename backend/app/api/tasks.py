# backend/app/api/tasks.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.database import get_db
from app.models import User, Project, ProjectMember, Task, TaskAssignee, Comment, TaskDependency
from app.api.deps import get_current_user
from app.models.enums import ProjectRole, TaskStatus, TaskPriority
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

router = APIRouter(prefix="/tasks", tags=["tasks"])

# Добавьте Pydantic модель для создания задачи
class TaskCreate(BaseModel):
    title: str
    project_hash: str
    description: str = ""
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    assigned_to_ids: List[int] = []
    parent_task_id: Optional[int] = None
    depends_on_ids: List[int] = []
    due_date: Optional[str] = None

async def check_project_access(project_id: int, user_id: int, db: AsyncSession) -> bool:
    membership = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id
        )
    )
    member = membership.scalar_one_or_none()
    return member is not None

async def check_project_manage_access(project_id: int, user_id: int, db: AsyncSession) -> bool:
    membership = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id
        )
    )
    member = membership.scalar_one_or_none()
    return member is not None and member.role in [ProjectRole.OWNER, ProjectRole.ADMIN]

@router.post("/")
async def create_task(
    task_data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Project).where(Project.hash == task_data.project_hash))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    has_access = await check_project_access(project.id, current_user.id, db)
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    # Проверка родительской задачи
    if task_data.parent_task_id:
        parent_task = await db.get(Task, task_data.parent_task_id)
        if not parent_task or parent_task.project_id != project.id:
            raise HTTPException(status_code=400, detail="Invalid parent task")

    task = Task(
        title=task_data.title,
        description=task_data.description,
        status=task_data.status,
        priority=task_data.priority,
        project_id=project.id,
        created_by=current_user.id,
        parent_task_id=task_data.parent_task_id
    )
    if task_data.due_date:
        task.due_date = datetime.fromisoformat(task_data.due_date.replace('Z', '+00:00'))

    db.add(task)
    await db.commit()
    await db.refresh(task)

    # Назначить исполнителей
    for user_id in task_data.assigned_to_ids:
        assignee = TaskAssignee(task_id=task.id, user_id=user_id)
        db.add(assignee)

    # Добавить зависимости
    for dep_id in task_data.depends_on_ids:
        dependency = TaskDependency(task_id=task.id, depends_on_id=dep_id)
        db.add(dependency)

    await db.commit()
    await db.refresh(task)

    return {"task": task}

@router.put("/{task_id}/status")
async def update_task_status(
    task_id: int,
    status: TaskStatus = Query(..., description="Новый статус задачи"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    has_access = await check_project_access(task.project_id, current_user.id, db)
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    # Проверка зависимостей
    if status == TaskStatus.DONE:
        dependencies = await db.execute(
            select(TaskDependency).where(TaskDependency.task_id == task_id)
        )
        deps = dependencies.scalars().all()

        for dep in deps:
            dependency_task = await db.get(Task, dep.depends_on_id)
            if dependency_task and dependency_task.status != TaskStatus.DONE:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot complete task. Dependency '{dependency_task.title}' is not done."
                )

    task.status = status
    await db.commit()
    await db.refresh(task)

    return {"task": task}

@router.get("/{task_id}/dependencies")
async def get_task_dependencies(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    has_access = await check_project_access(task.project_id, current_user.id, db)
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    # Получить зависимости
    dependencies = await db.execute(
        select(TaskDependency, Task)
        .join(Task, TaskDependency.depends_on_id == Task.id)
        .where(TaskDependency.task_id == task_id)
    )
    deps = dependencies.all()

    # Получить задачи, зависящие от этой
    dependents = await db.execute(
        select(TaskDependency, Task)
        .join(Task, TaskDependency.task_id == Task.id)
        .where(TaskDependency.depends_on_id == task_id)
    )
    dependent_tasks = dependents.all()

    return {
        "dependencies": [{"id": dep.Task.id, "title": dep.Task.title, "status": dep.Task.status} for dep in deps],
        "dependents": [{"id": dep.Task.id, "title": dep.Task.title, "status": dep.Task.status} for dep in dependent_tasks]
    }

@router.post("/{task_id}/dependencies")
async def add_task_dependency(
    task_id: int,
    depends_on_id: int = Query(..., description="ID задачи, от которой зависит"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    result = await db.execute(select(Task).where(Task.id == depends_on_id))
    dependency_task = result.scalar_one_or_none()
    if not dependency_task:
        raise HTTPException(status_code=404, detail="Dependency task not found")

    # Проверить, что обе задачи в одном проекте
    if task.project_id != dependency_task.project_id:
        raise HTTPException(status_code=400, detail="Tasks must be in the same project")

    has_access = await check_project_access(task.project_id, current_user.id, db)
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    # Проверить циклические зависимости
    if await check_circular_dependency(task_id, depends_on_id, db):
        raise HTTPException(status_code=400, detail="Circular dependency detected")

    dependency = TaskDependency(task_id=task_id, depends_on_id=depends_on_id)
    db.add(dependency)
    await db.commit()

    return {"status": "success", "message": "Dependency added"}

async def check_circular_dependency(task_id: int, depends_on_id: int, db: AsyncSession) -> bool:
    """Проверка циклических зависимостей"""
    if task_id == depends_on_id:
        return True

    # Рекурсивно проверяем зависимости
    visited = set()
    stack = [depends_on_id]

    while stack:
        current_id = stack.pop()
        if current_id == task_id:
            return True

        if current_id not in visited:
            visited.add(current_id)
            # Получить все зависимости текущей задачи
            result = await db.execute(
                select(TaskDependency).where(TaskDependency.task_id == current_id)
            )
            deps = result.scalars().all()
            stack.extend([dep.depends_on_id for dep in deps])

    return False

@router.get("/{task_id}/comments")
async def get_task_comments(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    has_access = await check_project_access(task.project_id, current_user.id, db)
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(Comment)
        .where(Comment.task_id == task_id)
        .order_by(Comment.created_at.asc())
    )
    comments = result.scalars().all()
    return {"comments": comments}

@router.post("/{task_id}/comments")
async def create_task_comment(
    task_id: int,
    content: str = Query(..., description="Текст комментария"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    has_access = await check_project_access(task.project_id, current_user.id, db)
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    comment = Comment(task_id=task_id, user_id=current_user.id, content=content)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    return {"comment": comment}

@router.delete("/{task_id}")
async def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    has_manage_access = await check_project_manage_access(task.project_id, current_user.id, db)
    if not has_manage_access:
        if task.created_by != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    await db.execute(TaskAssignee.__table__.delete().where(TaskAssignee.task_id == task.id))
    await db.execute(TaskDependency.__table__.delete().where(
        (TaskDependency.task_id == task_id) | (TaskDependency.depends_on_id == task_id)
    ))
    await db.delete(task)
    await db.commit()
    return {"status": "success", "message": "Task deleted"}

@router.get("/{task_id}")
async def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить задачу по ID"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    has_access = await check_project_access(task.project_id, current_user.id, db)
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    return {"task": task}

# backend/app/api/tasks.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import User, Project, ProjectMember, Task, TaskAssignee, Comment
from app.api.deps import get_current_user
from app.models.enums import ProjectRole, TaskStatus, TaskPriority

router = APIRouter(prefix="/tasks", tags=["tasks"])

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

@router.get("/")
async def get_tasks(
    user_id: str, # Для совместимости с MAX Web App
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Получить задачи, где пользователь является участником проекта или исполнителем
    result = await db.execute(
        select(Task)
        .join(Project)
        .join(ProjectMember, Project.id == ProjectMember.project_id)
        .where(ProjectMember.user_id == current_user.id)
        .order_by(Task.created_at.desc())
    )
    tasks = result.scalars().all()
    return {"tasks": tasks}

@router.get("/project/{project_hash}")
async def get_project_tasks(
    project_hash: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Project).where(Project.hash == project_hash))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    has_access = await check_project_access(project.id, current_user.id, db)
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(Task)
        .where(Task.project_id == project.id)
        .order_by(Task.created_at.desc())
    )
    tasks = result.scalars().all()
    return {"tasks": tasks}

@router.post("/")
async def create_task(
    title: str,
    project_hash: str,
    description: str = "",
    status: TaskStatus = TaskStatus.TODO,
    priority: TaskPriority = TaskPriority.MEDIUM,
    assigned_to_ids: list[int] = [], # IDs пользователей
    due_date: str = None, # ISO format string
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Project).where(Project.hash == project_hash))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    has_access = await check_project_access(project.id, current_user.id, db)
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    task = Task(
        title=title,
        description=description,
        status=status,
        priority=priority,
        project_id=project.id,
        created_by=current_user.id
    )
    if due_date:
        from datetime import datetime
        task.due_date = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
    db.add(task)
    await db.commit()
    await db.refresh(task)

    # Назначить исполнителей
    for user_id in assigned_to_ids:
        assignee = TaskAssignee(task_id=task.id, user_id=user_id)
        db.add(assignee)
    await db.commit()

    return {"task": task}

@router.put("/{task_id}/status")
async def update_task_status(
    task_id: int,
    status: TaskStatus,
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

    # Проверка зависимостей (упрощенно)
    if status == TaskStatus.DONE and task.depends_on_id:
        dependency = await db.get(Task, task.depends_on_id)
        if dependency and dependency.status != TaskStatus.DONE:
            raise HTTPException(status_code=400, detail=f"Cannot complete task. Dependency '{dependency.title}' is not done.")

    task.status = status
    await db.commit()
    await db.refresh(task)

    # Уведомление (реализация опциональна, см. в уведомлениях)
    # await notify_task_status_changed(task.id, status)

    return {"task": task}

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
    content: str,
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
        # Проверим, является ли пользователь создателем задачи
        if task.created_by != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    # Удаляем связанные назначения
    await db.execute(TaskAssignee.__table__.delete().where(TaskAssignee.task_id == task.id))
    # Удаляем задачу
    await db.delete(task)
    await db.commit()
    return {"status": "success", "message": "Task deleted"}

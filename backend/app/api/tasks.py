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
import logging

# Add logger
logger = logging.getLogger(__name__)

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

@router.get("/")
async def get_user_tasks(
    status: TaskStatus = Query(None, description="Фильтр по статусу"),
    project_hash: str = Query(None, description="Фильтр по проекту"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить задачи пользователя"""
    try:
        logger.info(f"Fetching tasks for user: {current_user.max_id}")

        # Базовый запрос для задач, где пользователь является участником проекта
        query = (
            select(Task)
            .join(Project, Task.project_id == Project.id)
            .join(ProjectMember, Project.id == ProjectMember.project_id)
            .where(ProjectMember.user_id == current_user.id)
        )

        # Применяем фильтры
        if status:
            query = query.where(Task.status == status)

        if project_hash:
            query = query.where(Project.hash == project_hash)

        # Сортируем по дате создания
        query = query.order_by(Task.created_at.desc())

        result = await db.execute(query)
        tasks = result.scalars().all()

        logger.info(f"Successfully fetched {len(tasks)} tasks for user: {current_user.max_id}")
        return {"tasks": tasks}

    except Exception as e:
        logger.error(f"Error fetching tasks for user {current_user.max_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/")
async def create_task(
    task_data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        logger.info(f"Creating task for user: {current_user.max_id}")

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

        logger.info(f"Task created successfully: {task.id}")
        return {"task": task}

    except Exception as e:
        logger.error(f"Error creating task: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.put("/{task_id}/status")
async def update_task_status(
    task_id: int,
    status: TaskStatus = Query(..., description="Новый статус задачи"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
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

        logger.info(f"Task {task_id} status updated to {status}")
        return {"task": task}

    except Exception as e:
        logger.error(f"Error updating task status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/{task_id}/dependencies")
async def get_task_dependencies(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
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

        logger.info(f"Fetched dependencies for task {task_id}")
        return {
            "dependencies": [{"id": dep.Task.id, "title": dep.Task.title, "status": dep.Task.status} for dep in deps],
            "dependents": [{"id": dep.Task.id, "title": dep.Task.title, "status": dep.Task.status} for dep in dependent_tasks]
        }

    except Exception as e:
        logger.error(f"Error fetching task dependencies: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/{task_id}/dependencies")
async def add_task_dependency(
    task_id: int,
    depends_on_id: int = Query(..., description="ID задачи, от которой зависит"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
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

        logger.info(f"Dependency added: task {task_id} depends on {depends_on_id}")
        return {"status": "success", "message": "Dependency added"}

    except Exception as e:
        logger.error(f"Error adding task dependency: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

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
    try:
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

        logger.info(f"Fetched {len(comments)} comments for task {task_id}")
        return {"comments": comments}

    except Exception as e:
        logger.error(f"Error fetching task comments: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/{task_id}/comments")
async def create_task_comment(
    task_id: int,
    content: str = Query(..., description="Текст комментария"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
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

        logger.info(f"Comment created for task {task_id}")
        return {"comment": comment}

    except Exception as e:
        logger.error(f"Error creating task comment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.delete("/{task_id}")
async def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
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

        logger.info(f"Task {task_id} deleted successfully")
        return {"status": "success", "message": "Task deleted"}

    except Exception as e:
        logger.error(f"Error deleting task: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/{task_id}")
async def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить задачу по ID"""
    try:
        result = await db.execute(select(Task).where(Task.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        has_access = await check_project_access(task.project_id, current_user.id, db)
        if not has_access:
            raise HTTPException(status_code=403, detail="Access denied")

        logger.info(f"Fetched task {task_id}")
        return {"task": task}

    except Exception as e:
        logger.error(f"Error fetching task: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/projects/{project_hash}/tasks")
async def get_project_tasks(
    project_hash: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить все задачи конкретного проекта по его hash"""
    try:
        # Найти проект по hash
        project_result = await db.execute(
            select(Project).where(Project.hash == project_hash)
        )
        project = project_result.scalar_one_or_none()

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Проверка доступа
        has_access = await check_project_access(project.id, current_user.id, db)
        if not has_access:
            raise HTTPException(status_code=403, detail="Access denied")

        # Получить задачи
        tasks_result = await db.execute(
            select(Task)
            .where(Task.project_id == project.id)
            .order_by(Task.created_at.desc())
        )
        tasks = tasks_result.scalars().all()

        logger.info(f"Fetched {len(tasks)} tasks for project {project_hash}")
        return {"tasks": tasks}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching project tasks: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

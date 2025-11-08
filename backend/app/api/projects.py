# backend/app/api/projects.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import User, Project, ProjectMember, JoinRequest, Task
from app.api.deps import get_current_user
from app.models.enums import ProjectRole
import secrets
import string

router = APIRouter(prefix="/projects", tags=["projects"])

def generate_invite_hash():
    return ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(12))

@router.post("/")
async def create_project(
    title: str = Query(..., description="Название проекта"),
    description: str = Query("", description="Описание проекта"),
    is_private: bool = Query(True, description="Приватный проект"),
    requires_approval: bool = Query(False, description="Требуется одобрение для вступления"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    invite_hash = generate_invite_hash()
    project = Project(
        title=title,
        description=description,
        hash=invite_hash,
        is_private=is_private,
        requires_approval=requires_approval,
        created_by=current_user.id
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    # Сделать создателя владельцем
    member = ProjectMember(
        project_id=project.id,
        user_id=current_user.id,
        role=ProjectRole.OWNER
    )
    db.add(member)
    await db.commit()

    return {"project": project}

@router.get("/{project_hash}")
async def get_project(
    project_hash: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Project).where(Project.hash == project_hash))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Проверка доступа: владелец, админ, участник или публичный
    membership = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == current_user.id
        )
    )
    member = membership.scalar_one_or_none()

    if project.is_private and not member:
        raise HTTPException(status_code=403, detail="Access denied")

    # Подсчет статистики
    stats_result = await db.execute(
        select(
            func.count(Task.id).label('total_tasks'),
            func.sum(func.iif(Task.status == 'done', 1, 0)).label('done_tasks'),
            func.sum(func.iif(Task.status == 'in_progress', 1, 0)).label('in_progress_tasks'),
            func.sum(func.iif(Task.status == 'todo', 1, 0)).label('todo_tasks')
        ).where(Task.project_id == project.id)
    )
    stats = stats_result.first()

    return {
        "project": project,
        "members": project.members,
        "stats": {
            "tasks_count": stats.total_tasks or 0,
            "tasks_done": stats.done_tasks or 0,
            "tasks_in_progress": stats.in_progress_tasks or 0,
            "tasks_todo": stats.todo_tasks or 0
        }
    }

@router.post("/{project_hash}/join")
async def join_project_request(
    project_hash: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Project).where(Project.hash == project_hash))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Проверка, является ли пользователь уже участником
    membership = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == current_user.id
        )
    )
    existing_member = membership.scalar_one_or_none()
    if existing_member:
        raise HTTPException(status_code=400, detail="Already a member of this project")

    if not project.requires_approval:
        # Прямое добавление
        member = ProjectMember(project_id=project.id, user_id=current_user.id, role=ProjectRole.MEMBER)
        db.add(member)
        await db.commit()
        return {"status": "joined", "message": "Successfully joined project"}
    else:
        # Проверка, нет ли уже запроса
        existing_request = await db.execute(
            select(JoinRequest).where(
                JoinRequest.project_id == project.id,
                JoinRequest.user_id == current_user.id,
                JoinRequest.status == "pending"
            )
        )
        if existing_request.scalar_one_or_none():
             raise HTTPException(status_code=400, detail="Join request already pending")

        # Создание запроса на присоединение
        join_request = JoinRequest(project_id=project.id, user_id=current_user.id)
        db.add(join_request)
        await db.commit()
        return {"status": "pending_approval", "message": "Join request sent for approval"}

@router.get("/{project_hash}/join-requests")
async def get_join_requests(
    project_hash: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Project).where(Project.hash == project_hash))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    membership = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == current_user.id
        )
    )
    member = membership.scalar_one_or_none()
    if not member or member.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(JoinRequest)
        .where(JoinRequest.project_id == project.id)
        .options(selectinload(JoinRequest.user))
    )
    requests = result.scalars().all()
    return {"requests": requests}

@router.post("/{project_hash}/join-requests/{request_id}/approve")
async def approve_join_request(
    project_hash: str,
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Project).where(Project.hash == project_hash))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    membership = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == current_user.id
        )
    )
    member = membership.scalar_one_or_none()
    if not member or member.role not in [ProjectRole.OWNER, ProjectRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(JoinRequest).where(
            JoinRequest.id == request_id,
            JoinRequest.project_id == project.id,
            JoinRequest.status == "pending"
        )
    )
    join_request = result.scalar_one_or_none()
    if not join_request:
        raise HTTPException(status_code=404, detail="Join request not found")

    # Добавить пользователя как участника
    new_member = ProjectMember(project_id=project.id, user_id=join_request.user_id, role=ProjectRole.MEMBER)
    db.add(new_member)

    # Обновить статус запроса
    join_request.status = "approved"
    join_request.processed_by_id = current_user.id
    join_request.processed_at = func.now()

    await db.commit()
    return {"status": "success", "message": "Join request approved"}

@router.post("/{project_hash}/join-requests/{request_id}/reject")
async def reject_join_request(
    project_hash: str,
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Project).where(Project.hash == project_hash))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    membership = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == current_user.id
        )
    )
    member = membership.scalar_one_or_none()
    if not member or member.role not in [ProjectRole.OWNER, ProjectRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(JoinRequest).where(
            JoinRequest.id == request_id,
            JoinRequest.project_id == project.id,
            JoinRequest.status == "pending"
        )
    )
    join_request = result.scalar_one_or_none()
    if not join_request:
        raise HTTPException(status_code=404, detail="Join request not found")

    # Обновить статус запроса
    join_request.status = "rejected"
    join_request.processed_by_id = current_user.id
    join_request.processed_at = func.now()

    await db.commit()
    return {"status": "success", "message": "Join request rejected"}

@router.post("/{project_hash}/regenerate-invite")
async def regenerate_invite(
    project_hash: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Project).where(Project.hash == project_hash))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    membership = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == current_user.id
        )
    )
    member = membership.scalar_one_or_none()
    if not member or member.role not in [ProjectRole.OWNER, ProjectRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Access denied")

    new_hash = generate_invite_hash()
    project.hash = new_hash
    await db.commit()
    return {"status": "success", "new_invite_hash": new_hash}

@router.get("/{project_hash}/summary")
async def get_project_summary(
    project_hash: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Эндпоинт для получения сводки проекта для бота"""
    result = await db.execute(select(Project).where(Project.hash == project_hash))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Получаем информацию о членстве пользователя
    membership = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == current_user.id
        )
    )
    member = membership.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    # Подсчет количества участников
    members_count_result = await db.execute(
        select(func.count(ProjectMember.id)).where(ProjectMember.project_id == project.id)
    )
    members_count = members_count_result.scalar()

    # Подсчет статистики задач
    stats_result = await db.execute(
        select(
            func.count(Task.id).label('total_tasks'),
            func.sum(func.iif(Task.status == 'done', 1, 0)).label('done_tasks'),
            func.sum(func.iif(Task.status == 'in_progress', 1, 0)).label('in_progress_tasks'),
            func.sum(func.iif(Task.status == 'todo', 1, 0)).label('todo_tasks')
        ).where(Task.project_id == project.id)
    )
    stats = stats_result.first()

    return {
        "id": project.id,
        "title": project.title,
        "description": project.description,
        "hash": project.hash,
        "is_private": project.is_private,
        "requires_approval": project.requires_approval,
        "members_count": members_count or 0,
        "tasks_count": stats.total_tasks or 0,
        "tasks_todo": stats.todo_tasks or 0,
        "tasks_in_progress": stats.in_progress_tasks or 0,
        "tasks_done": stats.done_tasks or 0,
        "user_role": member.role,
        "can_manage": member.role in [ProjectRole.OWNER, ProjectRole.ADMIN]
    }

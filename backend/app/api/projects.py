# backend/app/api/projects.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import User, Project, ProjectMember, JoinRequest, Task
from app.api.deps import get_current_user
from app.models.enums import ProjectRole
from pydantic import BaseModel
import secrets
import string

router = APIRouter(prefix="/projects", tags=["projects"])

# Добавьте Pydantic модель для создания проекта
class ProjectCreate(BaseModel):
    title: str
    description: str = ""
    is_private: bool = True
    requires_approval: bool = False

def generate_invite_hash():
    return ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(12))

@router.post("/")
async def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    invite_hash = generate_invite_hash()
    project = Project(
        title=project_data.title,
        description=project_data.description,
        hash=invite_hash,
        is_private=project_data.is_private,
        requires_approval=project_data.requires_approval,
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
    result = await db.execute(
        select(Project)
        .where(Project.hash == project_hash)
        .options(selectinload(Project.project_owner))
    )
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

    # Получаем информацию о членах проекта
    members_result = await db.execute(
        select(ProjectMember)
        .where(ProjectMember.project_id == project.id)
        .options(selectinload(ProjectMember.member_user))
    )
    project_members = members_result.scalars().all()

    # Подсчет статистики
    total_result = await db.execute(
        select(func.count(Task.id)).where(Task.project_id == project.id)
    )
    done_result = await db.execute(
        select(func.count(Task.id)).where(
            Task.project_id == project.id,
            Task.status == 'done'
        )
    )
    in_progress_result = await db.execute(
        select(func.count(Task.id)).where(
            Task.project_id == project.id,
            Task.status == 'in_progress'
        )
    )
    todo_result = await db.execute(
        select(func.count(Task.id)).where(
            Task.project_id == project.id,
            Task.status == 'todo'
        )
    )

    stats = {
        "tasks_count": total_result.scalar() or 0,
        "tasks_done": done_result.scalar() or 0,
        "tasks_in_progress": in_progress_result.scalar() or 0,
        "tasks_todo": todo_result.scalar() or 0
    }

    # Формируем ответ с упрощенными данными
    response_data = {
        "project": {
            "id": project.id,
            "title": project.title,
            "description": project.description,
            "hash": project.hash,
            "is_private": project.is_private,
            "requires_approval": project.requires_approval,
            "created_by": project.created_by,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
            "owner": {
                "id": project.project_owner.id,
                "max_id": project.project_owner.max_id,
                "full_name": project.project_owner.full_name,
                "username": project.project_owner.username
            } if project.project_owner else None
        },
        "members": [
            {
                "id": m.id,
                "project_id": m.project_id,
                "user_id": m.user_id,
                "role": m.role,
                "joined_at": m.joined_at,
                "user": {
                    "id": m.member_user.id,
                    "max_id": m.member_user.max_id,
                    "full_name": m.member_user.full_name,
                    "username": m.member_user.username
                } if m.member_user else None
            } for m in project_members
        ],
        "stats": stats,
        "current_user_role": member.role if member else None,
        "has_access": bool(member) or not project.is_private
    }

    return response_data

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
        .options(selectinload(JoinRequest.join_request_user))
    )
    requests = result.scalars().all()

    # Форматируем ответ
    formatted_requests = []
    for req in requests:
        formatted_requests.append({
            "id": req.id,
            "project_id": req.project_id,
            "user_id": req.user_id,
            "status": req.status,
            "requested_at": req.requested_at,
            "processed_by_id": req.processed_by_id,
            "processed_at": req.processed_at,
            "user": {
                "id": req.join_request_user.id,
                "max_id": req.join_request_user.max_id,
                "full_name": req.join_request_user.full_name,
                "username": req.join_request_user.username
            } if req.join_request_user else None
        })

    return {"requests": formatted_requests}

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
    total_result = await db.execute(
        select(func.count(Task.id)).where(Task.project_id == project.id)
    )
    done_result = await db.execute(
        select(func.count(Task.id)).where(
            Task.project_id == project.id,
            Task.status == 'done'
        )
    )
    in_progress_result = await db.execute(
        select(func.count(Task.id)).where(
            Task.project_id == project.id,
            Task.status == 'in_progress'
        )
    )
    todo_result = await db.execute(
        select(func.count(Task.id)).where(
            Task.project_id == project.id,
            Task.status == 'todo'
        )
    )

    return {
        "id": project.id,
        "title": project.title,
        "description": project.description,
        "hash": project.hash,
        "is_private": project.is_private,
        "requires_approval": project.requires_approval,
        "members_count": members_count or 0,
        "tasks_count": total_result.scalar() or 0,
        "tasks_todo": todo_result.scalar() or 0,
        "tasks_in_progress": in_progress_result.scalar() or 0,
        "tasks_done": done_result.scalar() or 0,
        "user_role": member.role,
        "can_manage": member.role in [ProjectRole.OWNER, ProjectRole.ADMIN]
    }

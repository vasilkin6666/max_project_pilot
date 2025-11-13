#/backend/app/api/project.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import User, Project, ProjectMember, JoinRequest, Task
from app.api.deps import get_current_user
from app.models.enums import ProjectRole
from pydantic import BaseModel
from typing import Optional, List
import secrets
import string
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["projects"])

# Pydantic модели
class ProjectCreate(BaseModel):
    title: str
    description: str = ""
    is_private: bool = True
    requires_approval: bool = False

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_private: Optional[bool] = None
    requires_approval: Optional[bool] = None

class MemberRoleUpdate(BaseModel):
    role: ProjectRole

def generate_invite_hash():
    return ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(12))

@router.post("/")
async def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Создание проекта"""
    try:
        logger.info(f"Creating project for user: {current_user.max_id}")

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

        # Получить полную информацию о созданном проекте
        result = await db.execute(
            select(Project)
            .where(Project.id == project.id)
            .options(selectinload(Project.project_owner))
        )
        project_with_owner = result.scalar_one_or_none()

        logger.info(f"Project created successfully with hash: {project.hash}")
        return {"project": project_with_owner}

    except Exception as e:
        logger.error(f"Error creating project: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/")
async def get_user_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить все проекты пользователя с базовой статистикой"""
    try:
        result = await db.execute(
            select(ProjectMember)
            .where(ProjectMember.user_id == current_user.id)
            .options(selectinload(ProjectMember.member_project))
        )
        memberships = result.scalars().all()

        projects_with_stats = []

        for member in memberships:
            project = member.member_project

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

            # Подсчет участников
            members_count_result = await db.execute(
                select(func.count(ProjectMember.id)).where(ProjectMember.project_id == project.id)
            )

            stats = {
                "tasks_count": total_result.scalar() or 0,
                "tasks_done": done_result.scalar() or 0,
                "tasks_in_progress": in_progress_result.scalar() or 0,
                "tasks_todo": todo_result.scalar() or 0,
                "members_count": members_count_result.scalar() or 0
            }

            project_data = {
                "id": project.id,
                "title": project.title,
                "description": project.description,
                "hash": project.hash,
                "is_private": project.is_private,
                "requires_approval": project.requires_approval,
                "created_by": project.created_by,
                "created_at": project.created_at,
                "updated_at": project.updated_at,
                "stats": stats,
                "user_role": member.role
            }
            projects_with_stats.append(project_data)

        return {"projects": projects_with_stats}

    except Exception as e:
        logger.error(f"Error fetching user projects: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

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

@router.put("/{project_hash}")
async def update_project(
    project_hash: str,
    project_data: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновление проекта"""
    result = await db.execute(select(Project).where(Project.hash == project_hash))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Проверка прав доступа
    membership = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == current_user.id
        )
    )
    member = membership.scalar_one_or_none()
    if not member or member.role not in [ProjectRole.OWNER, ProjectRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Access denied")

    # Обновление полей
    update_fields = {}
    if project_data.title is not None:
        update_fields["title"] = project_data.title
    if project_data.description is not None:
        update_fields["description"] = project_data.description
    if project_data.is_private is not None:
        update_fields["is_private"] = project_data.is_private
    if project_data.requires_approval is not None:
        update_fields["requires_approval"] = project_data.requires_approval

    for field, value in update_fields.items():
        setattr(project, field, value)

    await db.commit()
    await db.refresh(project)

    return {"project": project}

@router.delete("/{project_hash}")
async def delete_project(
    project_hash: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Удаление проекта"""
    result = await db.execute(select(Project).where(Project.hash == project_hash))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Проверка прав доступа - только владелец
    membership = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == current_user.id,
            ProjectMember.role == ProjectRole.OWNER
        )
    )
    member = membership.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="Only project owner can delete project")

    # Удаление проекта (каскадное удаление настроено в моделях)
    await db.delete(project)
    await db.commit()

    return {"status": "success", "message": "Project deleted successfully"}

@router.get("/{project_hash}/members")
async def get_project_members(
    project_hash: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить участников проекта"""
    result = await db.execute(select(Project).where(Project.hash == project_hash))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Проверка доступа
    membership = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == current_user.id
        )
    )
    current_user_member = membership.scalar_one_or_none()
    if not current_user_member:
        raise HTTPException(status_code=403, detail="Access denied")

    # Получаем участников
    members_result = await db.execute(
        select(ProjectMember)
        .where(ProjectMember.project_id == project.id)
        .options(selectinload(ProjectMember.member_user))
    )
    project_members = members_result.scalars().all()

    members_data = [
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
            } if m.member_user else None,
            "can_manage": current_user_member.role in [ProjectRole.OWNER, ProjectRole.ADMIN]
        } for m in project_members
    ]

    return {"members": members_data}

@router.delete("/{project_hash}/members/{user_id}")
async def remove_project_member(
    project_hash: str,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Удалить участника из проекта"""
    result = await db.execute(select(Project).where(Project.hash == project_hash))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Проверка прав доступа
    membership = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == current_user.id
        )
    )
    current_user_member = membership.scalar_one_or_none()
    if not current_user_member or current_user_member.role not in [ProjectRole.OWNER, ProjectRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Access denied")

    # Нельзя удалить владельца
    if user_id == project.created_by:
        raise HTTPException(status_code=400, detail="Cannot remove project owner")

    # Найти участника для удаления
    member_to_remove = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user_id
        )
    )
    member = member_to_remove.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    await db.delete(member)
    await db.commit()

    return {"status": "success", "message": "Member removed from project"}

@router.put("/{project_hash}/members/{user_id}")
async def update_member_role(
    project_hash: str,
    user_id: int,
    role_data: MemberRoleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Изменить роль участника"""
    result = await db.execute(select(Project).where(Project.hash == project_hash))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Проверка прав доступа - только владелец
    membership = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == current_user.id,
            ProjectMember.role == ProjectRole.OWNER
        )
    )
    current_user_member = membership.scalar_one_or_none()
    if not current_user_member:
        raise HTTPException(status_code=403, detail="Only project owner can change roles")

    # Найти участника для изменения роли
    member_to_update = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user_id
        )
    )
    member = member_to_update.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Обновление роли
    member.role = role_data.role
    await db.commit()
    await db.refresh(member)

    return {"status": "success", "message": "Member role updated", "member": member}

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

@router.get("/{project_hash}/join-requests/all")
async def get_all_join_requests(
    project_hash: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить все заявки на вступление (включая обработанные)"""
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
        .order_by(JoinRequest.requested_at.desc())
        .options(selectinload(JoinRequest.join_request_user))
    )
    requests = result.scalars().all()

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

@router.delete("/{project_hash}/join-requests/{request_id}")
async def delete_join_request(
    project_hash: str,
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Удалить заявку на вступление (только обработанные)"""
    try:
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
                JoinRequest.project_id == project.id
            )
        )
        join_request = result.scalar_one_or_none()

        if not join_request:
            raise HTTPException(status_code=404, detail="Join request not found")

        # Разрешаем удалять только обработанные заявки
        if join_request.status == "pending":
            raise HTTPException(
                status_code=400,
                detail="Cannot delete pending join request"
            )

        await db.delete(join_request)
        await db.commit()

        return {"status": "success", "message": "Join request deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting join request {request_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/search/public")
async def search_public_projects(
    query: str = Query(None, description="Поисковый запрос"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Поиск публичных проектов"""
    try:
        # Базовый запрос для публичных проектов
        stmt = select(Project).where(Project.is_private == False)

        if query:
            # Поиск по названию, описанию или хэшу
            stmt = stmt.where(
                or_(
                    Project.title.ilike(f"%{query}%"),
                    Project.description.ilike(f"%{query}%"),
                    Project.hash.ilike(f"%{query}%")
                )
            )

        # Исключаем проекты, в которых пользователь уже состоит
        user_project_ids = await db.execute(
            select(ProjectMember.project_id).where(ProjectMember.user_id == current_user.id)
        )
        user_project_ids = [row[0] for row in user_project_ids.fetchall()]

        if user_project_ids:
            stmt = stmt.where(Project.id.notin_(user_project_ids))

        # Сортировка по дате создания
        stmt = stmt.order_by(Project.created_at.desc())

        result = await db.execute(stmt)
        projects = result.scalars().all()

        # Форматируем ответ
        projects_data = []
        for project in projects:
            # Получаем владельца
            owner_result = await db.execute(select(User).where(User.id == project.created_by))
            owner = owner_result.scalar_one_or_none()

            # Статистика задач
            total_tasks = await db.execute(select(func.count(Task.id)).where(Task.project_id == project.id))
            done_tasks = await db.execute(select(func.count(Task.id)).where(
                Task.project_id == project.id, Task.status == 'done'
            ))

            projects_data.append({
                "id": project.id,
                "title": project.title,
                "description": project.description,
                "hash": project.hash,
                "is_private": project.is_private,
                "requires_approval": project.requires_approval,
                "created_at": project.created_at,
                "owner": {
                    "id": owner.id,
                    "max_id": owner.max_id,
                    "full_name": owner.full_name,
                    "username": owner.username
                } if owner else None,
                "stats": {
                    "tasks_count": total_tasks.scalar() or 0,
                    "tasks_done": done_tasks.scalar() or 0
                }
            })

        return {"projects": projects_data}

    except Exception as e:
        logger.error(f"Error searching public projects: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/by-hash/{project_hash}")
async def get_project_by_hash_exact(
    project_hash: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить проект по точному совпадению хэша"""
    try:
        result = await db.execute(
            select(Project).where(Project.hash == project_hash)
        )
        project = result.scalar_one_or_none()

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Проверяем, является ли пользователь уже участником
        is_member = await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project.id,
                ProjectMember.user_id == current_user.id
            )
        )
        is_member = is_member.scalar_one_or_none() is not None

        # Получаем владельца
        owner_result = await db.execute(select(User).where(User.id == project.created_by))
        owner = owner_result.scalar_one_or_none()

        # Статистика
        total_tasks = await db.execute(select(func.count(Task.id)).where(Task.project_id == project.id))
        done_tasks = await db.execute(select(func.count(Task.id)).where(
            Task.project_id == project.id, Task.status == 'done'
        ))
        members_count = await db.execute(
            select(func.count(ProjectMember.id)).where(ProjectMember.project_id == project.id)
        )

        return {
            "project": {
                "id": project.id,
                "title": project.title,
                "description": project.description,
                "hash": project.hash,
                "is_private": project.is_private,
                "requires_approval": project.requires_approval,
                "created_at": project.created_at,
                "owner": {
                    "id": owner.id,
                    "max_id": owner.max_id,
                    "full_name": owner.full_name,
                    "username": owner.username
                } if owner else None,
                "stats": {
                    "tasks_count": total_tasks.scalar() or 0,
                    "tasks_done": done_tasks.scalar() or 0,
                    "members_count": members_count.scalar() or 0
                }
            },
            "is_member": is_member,
            "can_join": not is_member and (not project.is_private or project.requires_approval)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project by hash: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/{project_hash}/join-requests/{request_id}/approve")
async def approve_join_request(
    project_hash: str,
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Одобрить заявку на вступление в проект"""
    try:
        logger.info(f"Approving join request {request_id} for project {project_hash}")

        # Находим проект
        result = await db.execute(select(Project).where(Project.hash == project_hash))
        project = result.scalar_one_or_none()
        if not project:
            logger.error(f"Project not found: {project_hash}")
            raise HTTPException(status_code=404, detail="Project not found")

        # Проверяем права доступа
        membership = await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project.id,
                ProjectMember.user_id == current_user.id
            )
        )
        member = membership.scalar_one_or_none()
        if not member or member.role not in [ProjectRole.OWNER, ProjectRole.ADMIN]:
            logger.error(f"User {current_user.id} doesn't have permission to approve requests")
            raise HTTPException(status_code=403, detail="Access denied")

        # Находим заявку (ищем по ID и проекту, без проверки статуса)
        result = await db.execute(
            select(JoinRequest).where(
                JoinRequest.id == request_id,
                JoinRequest.project_id == project.id
            )
        )
        join_request = result.scalar_one_or_none()

        if not join_request:
            logger.error(f"Join request {request_id} not found for project {project.id}")
            raise HTTPException(status_code=404, detail="Join request not found")

        # Проверяем, не обработана ли уже заявка
        if join_request.status != "pending":
            logger.warning(f"Join request {request_id} already processed with status: {join_request.status}")
            raise HTTPException(
                status_code=400,
                detail=f"Join request already {join_request.status}"
            )

        # Проверяем, не является ли пользователь уже участником
        existing_member = await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project.id,
                ProjectMember.user_id == join_request.user_id
            )
        )
        if existing_member.scalar_one_or_none():
            logger.warning(f"User {join_request.user_id} is already a member of project {project.id}")
            # Помечаем заявку как отклоненную (дублирующая)
            join_request.status = "rejected"
            join_request.processed_by_id = current_user.id
            join_request.processed_at = func.now()
            await db.commit()
            raise HTTPException(status_code=400, detail="User is already a member")

        # Добавляем пользователя как участника
        new_member = ProjectMember(
            project_id=project.id,
            user_id=join_request.user_id,
            role=ProjectRole.MEMBER
        )
        db.add(new_member)

        # Обновляем статус заявки
        join_request.status = "approved"
        join_request.processed_by_id = current_user.id
        join_request.processed_at = func.now()

        await db.commit()

        logger.info(f"Join request {request_id} approved successfully")
        return {"status": "success", "message": "Join request approved"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving join request {request_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/{project_hash}/join-requests/{request_id}/reject")
async def reject_join_request(
    project_hash: str,
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Отклонить заявку на вступление в проект"""
    try:
        logger.info(f"Rejecting join request {request_id} for project {project_hash}")

        # Находим проект
        result = await db.execute(select(Project).where(Project.hash == project_hash))
        project = result.scalar_one_or_none()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Проверяем права доступа
        membership = await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project.id,
                ProjectMember.user_id == current_user.id
            )
        )
        member = membership.scalar_one_or_none()
        if not member or member.role not in [ProjectRole.OWNER, ProjectRole.ADMIN]:
            raise HTTPException(status_code=403, detail="Access denied")

        # Находим заявку
        result = await db.execute(
            select(JoinRequest).where(
                JoinRequest.id == request_id,
                JoinRequest.project_id == project.id
            )
        )
        join_request = result.scalar_one_or_none()

        if not join_request:
            raise HTTPException(status_code=404, detail="Join request not found")

        # Проверяем, не обработана ли уже заявка
        if join_request.status != "pending":
            raise HTTPException(
                status_code=400,
                detail=f"Join request already {join_request.status}"
            )

        # Обновляем статус заявки
        join_request.status = "rejected"
        join_request.processed_by_id = current_user.id
        join_request.processed_at = func.now()

        await db.commit()

        logger.info(f"Join request {request_id} rejected successfully")
        return {"status": "success", "message": "Join request rejected"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rejecting join request {request_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

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

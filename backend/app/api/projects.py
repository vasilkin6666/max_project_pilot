from fastapi import APIRouter, Query, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from ...models import Project, ProjectMember, User
from ...utils import rand_hash
from ...db import get_db
from ...config import settings

router = APIRouter(prefix="/api")

async def get_or_create_user(db: Session, max_id: str):
    result = await db.execute(select(User).where(User.max_id == max_id))
    user = result.scalar_one_or_none()
    if not user:
        user = User(max_id=max_id, full_name="MAX User")
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user

@router.post("/projects")
async def create_project(
    title: str = Query(...),
    emoji: str = "🚀",
    user_id: str = Query(...),
    db: Session = Depends(get_db)
):
    user = await get_or_create_user(db, user_id)
    project = Project(
        hash=rand_hash(),
        title=title,
        emoji=emoji,
        invite_hash=rand_hash(),
        owner_id=user.id
    )
    db.add(project)
    await db.flush()
    member = ProjectMember(project_id=project.id, user_id=user.id, role="owner")
    db.add(member)
    await db.commit()
    await db.refresh(project)
    return {
        "project": {
            "hash": project.hash,
            "title": project.title,
            "emoji": project.emoji,
            "invite_link": f"{settings.SITE_URL}/?join={project.invite_hash}"
        }
    }

@router.get("/projects")
async def list_projects(user_id: str = Query(...), db: Session = Depends(get_db)):
    result = await db.execute(
        select(Project, ProjectMember.role)
        .join(ProjectMember, Project.id == ProjectMember.project_id)
        .where(ProjectMember.user_id == (
            select(User.id).where(User.max_id == user_id).scalar_subquery()
        ))
    )
    projects = [
        {"hash": p.hash, "title": p.title, "emoji": p.emoji, "role": role}
        for p, role in result.all()
    ]
    return {"projects": projects}

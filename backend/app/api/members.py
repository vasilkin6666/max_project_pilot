from fastapi import APIRouter, Query, Depends
from sqlalchemy import select
from ...models import ProjectMember, User, Project
from ...db import get_db

router = APIRouter(prefix="/api")

@router.get("/members/{project_hash}")
async def get_members(project_hash: str, user_id: str = Query(...), db: Session = Depends(get_db)):
    result = await db.execute(
        select(User.full_name, ProjectMember.role)
        .join(ProjectMember, ProjectMember.user_id == User.id)
        .join(Project, Project.id == ProjectMember.project_id)
        .where(Project.hash == project_hash)
    )
    members = [{"name": name, "role": role} for name, role in result.all()]
    return {"members": members}

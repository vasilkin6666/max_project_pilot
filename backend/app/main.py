# backend/app/main.py
from fastapi import FastAPI
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.projects import router as projects_router
from app.api.tasks import router as tasks_router
from app.api.notifications import router as notifications_router
from app.models import Base
from app.database import engine
from sqlalchemy import select

app = FastAPI(title="MAX Project Pilot API", version="1.0.0")

# Инициализация БД (в реальности используйте Alembic)
@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        # await conn.run_sync(Base.metadata.drop_all) # Не удалять в проде!
        await conn.run_sync(Base.metadata.create_all)

# Health check
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "MAX Project Pilot Backend", "version": "1.0.0"}

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(projects_router)
app.include_router(tasks_router)
app.include_router(notifications_router)

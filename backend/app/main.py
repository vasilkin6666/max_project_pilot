# backend/app/main.py
from fastapi import FastAPI
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.projects import router as projects_router
from app.api.tasks import router as tasks_router
from app.api.notifications import router as notifications_router
from app.models import Base
from app.database import engine
import logging

from fastapi.middleware.cors import CORSMiddleware

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="MAX Project Pilot API", version="1.0.0")

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Инициализация БД
@app.on_event("startup")
async def startup():
    logger.info("Starting up application...")
    try:
        async with engine.begin() as conn:
            logger.info("Creating database tables...")
            await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        raise

# Health check
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "MAX Project Pilot Backend", "version": "1.0.0"}

# API Health check
@app.get("/api/health")
async def api_health_check():
    return {"status": "ok", "service": "MAX Project Pilot API", "version": "1.0.0"}

# Включение роутеров с префиксом /api
app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(projects_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")

# Root endpoint
@app.get("/")
async def root():
    return {"message": "MAX Project Pilot API", "version": "1.0.0"}

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(title="MAX Project Pilot API", version="1.0.0")

# Настройка CORS для мини-приложения
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене укажите конкретный домен
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Создаем директории если их нет
os.makedirs("app/static", exist_ok=True)
os.makedirs("app/templates", exist_ok=True)

# Статические файлы и шаблоны
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

# Подключаем роуты
from app.api.projects import router as projects_router
from app.api.notifications import router as notifications_router
from app.api.miniapp import router as miniapp_router

app.include_router(projects_router)
app.include_router(notifications_router)
app.include_router(miniapp_router)

@app.get("/")
async def root():
    return {"message": "MAX Project Pilot API", "status": "running"}

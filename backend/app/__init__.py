from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import projects, tasks, members

app = FastAPI(title="MAX Pilot v4.0 — PostgreSQL")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(members.router)

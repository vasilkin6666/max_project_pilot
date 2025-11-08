from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from .db import engine
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    max_id = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String)
    projects = relationship("ProjectMember", back_populates="user")

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True)
    hash = Column(String, unique=True, index=True)
    title = Column(String, nullable=False)
    emoji = Column(String, default="📋")
    invite_hash = Column(String, unique=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    members = relationship("ProjectMember", back_populates="project")
    tasks = relationship("Task", back_populates="project")

class ProjectMember(Base):
    __tablename__ = "project_members"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    role = Column(String, default="member")
    project = relationship("Project")
    user = relationship("User")

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    title = Column(String, nullable=False)
    desc = Column(Text)
    column = Column(String, default="todo")
    assignee = Column(String)
    blocked_by = Column(Integer)
    done = Column(Boolean, default=False)
    due = Column(DateTime)
    subtasks = Column(JSON, default=list)
    comments = Column(JSON, default=list)
    files = Column(JSON, default=list)
    project = relationship("Project")

# Создание таблиц
import asyncio
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

asyncio.run(init_db())

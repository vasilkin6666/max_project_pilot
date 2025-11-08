# backend/app/models/project.py
from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base
from .enums import ProjectRole

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    hash = Column(String, unique=True, index=True, nullable=False) # Уникальный хэш для приглашений
    is_private = Column(Boolean, default=True)
    requires_approval = Column(Boolean, default=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", back_populates="owned_projects")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    join_requests = relationship("JoinRequest", back_populates="project", cascade="all, delete-orphan")

class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String, default=ProjectRole.MEMBER) # Хранение строки, не Enum
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="projects")

    __table_args__ = (UniqueConstraint('project_id', 'user_id', name='unique_project_user'),)

class JoinRequest(Base):
    __tablename__ = "join_requests"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False) # Кто подал запрос
    status = Column(String, default="pending") # pending, approved, rejected
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Кто обработал
    processed_at = Column(DateTime(timezone=True), nullable=True)

    project = relationship("Project", back_populates="join_requests")
    user = relationship("User", back_populates="join_requests")
    processor = relationship("User", foreign_keys=[processed_by_id], back_populates="processed_join_requests")

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
    hash = Column(String, unique=True, index=True, nullable=False)
    is_private = Column(Boolean, default=True)
    requires_approval = Column(Boolean, default=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Упрощенные отношения
    members = relationship("ProjectMember", backref="member_project")
    tasks = relationship("Task", backref="task_project")
    join_requests = relationship("JoinRequest", backref="join_request_project")

class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String, default=ProjectRole.MEMBER)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint('project_id', 'user_id', name='unique_project_user'),)

class JoinRequest(Base):
    __tablename__ = "join_requests"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="pending")
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)

# backend/app/models/user.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    max_id = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    username = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Добавляем отношения с явным указанием foreign_keys
    owned_projects = relationship("Project", back_populates="owner", foreign_keys="Project.created_by")
    projects = relationship("ProjectMember", back_populates="user")

    # Исправляем отношения для join_requests
    join_requests = relationship(
        "JoinRequest",
        back_populates="user",
        foreign_keys="JoinRequest.user_id"
    )
    processed_join_requests = relationship(
        "JoinRequest",
        back_populates="processor",
        foreign_keys="JoinRequest.processed_by_id"
    )

    notifications = relationship("Notification", back_populates="user")

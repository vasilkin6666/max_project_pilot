# backend/app/models/notification.py
from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base
from .enums import NotificationType

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True) # Опционально
    type = Column(String, nullable=False) # Хранение строки
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    data = Column(Text, nullable=True) # JSON-строка
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="notifications")
    project = relationship("Project")

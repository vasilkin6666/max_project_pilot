# backend/app/schemas/dashboard.py
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class ProjectStats(BaseModel):
    total_tasks: int
    done_tasks: int
    in_progress_tasks: int
    todo_tasks: int
    members_count: int

class ProjectResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    hash: str
    is_private: bool
    requires_approval: bool
    created_by: int
    created_at: datetime
    updated_at: Optional[datetime]
    total_tasks: int
    done_tasks: int
    in_progress_tasks: int
    todo_tasks: int
    members_count: int

class UserSettingsResponse(BaseModel):
    id: int
    user_id: int
    theme: str
    language: str
    notifications_enabled: bool
    email_notifications: bool
    push_notifications: bool
    compact_view: bool
    show_completed_tasks: bool
    default_project_view: str
    timezone: str
    date_format: str
    time_format: str
    items_per_page: int
    custom_settings: Dict[str, Any]
    created_at: datetime
    updated_at: Optional[datetime]

class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: str
    priority: str
    project_id: int
    created_by: int
    assigned_to_id: Optional[int]
    due_date: Optional[datetime]
    parent_task_id: Optional[int]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

class DashboardResponse(BaseModel):
    settings: UserSettingsResponse
    projects: List[ProjectResponse]
    recent_tasks: List[TaskResponse]

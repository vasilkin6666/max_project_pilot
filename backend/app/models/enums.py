# backend/app/models/enums.py
from enum import Enum

class ProjectRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    GUEST = "guest"

class TaskStatus(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"

class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

class NotificationType(str, Enum):
    TASK_CREATED = "task_created"
    TASK_ASSIGNED = "task_assigned"
    TASK_STATUS_CHANGED = "task_status_changed"
    TASK_COMPLETED = "task_completed"
    JOIN_REQUEST = "join_request"
    JOIN_APPROVED = "join_approved"
    JOIN_REJECTED = "join_rejected"
    PROJECT_INVITE = "project_invite"

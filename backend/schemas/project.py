from datetime import datetime

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    category: str | None = None
    source_language: str
    target_language: str
    status: str | None = None  # not_started | in_progress | done | on_hold


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: str | None
    category: str | None
    source_language: str
    target_language: str
    status: str | None = None
    assigned_to_user_id: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    deleted_at: datetime | None = None

    class Config:
        from_attributes = True
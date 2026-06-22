
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SessionCreate(BaseModel):
    workspace_id: UUID
    task_type_id: UUID | None = None


class SessionUpdate(BaseModel):
    title: str | None = None
 
class SessionResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    task_type_id: UUID | None = None
    task_type_name: str | None = None
    title: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class SessionListResponse(BaseModel):
    items: list[SessionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

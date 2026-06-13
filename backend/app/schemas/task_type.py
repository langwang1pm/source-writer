from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TaskTypeCreate(BaseModel):
    name: str = Field(..., max_length=100)
    description: str | None = None


class TaskTypeUpdate(BaseModel):
    name: str | None = Field(None, max_length=100)
    description: str | None = None
    is_active: bool | None = None


class TaskTypeResponse(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class TaskTypeListResponse(BaseModel):
    items: list[TaskTypeResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

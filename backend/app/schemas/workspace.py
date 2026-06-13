from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class WorkspaceCreate(BaseModel):
    name: str = Field(..., max_length=255)
    client_enterprise_id: UUID


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)


class WorkspaceResponse(BaseModel):
    id: UUID
    name: str
    client_enterprise_id: UUID
    created_at: datetime
    updated_at: datetime | None = None
    client_enterprise_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class WorkspaceListResponse(BaseModel):
    items: list[WorkspaceResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

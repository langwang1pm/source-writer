from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class EnterpriseCreate(BaseModel):
    name: str = Field(..., max_length=255)


class EnterpriseUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)


class EnterpriseResponse(BaseModel):
    id: UUID
    name: str
    created_at: datetime
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class EnterpriseListResponse(BaseModel):
    items: list[EnterpriseResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

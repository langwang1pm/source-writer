
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ResponseDocResponse(BaseModel):
    id: UUID
    session_id: UUID
    chat_message_id: UUID
    title: str | None = None
    body_markdown: str | None = None
    body_html: str | None = None
    revision: int
    created_at: datetime
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ResponseDocUpdate(BaseModel):
    title: str | None = Field(None, max_length=500)
    body_markdown: str | None = None


class ResponseDocListResponse(BaseModel):
    items: list[ResponseDocResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

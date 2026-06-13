
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ChatMessageSend(BaseModel):
    content: str = Field(..., min_length=1)
    task_type_id: UUID | None = None


class ChatMessageResponse(BaseModel):
    id: UUID
    session_id: UUID
    task_type_id: UUID | None = None
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatMessageListResponse(BaseModel):
    items: list[ChatMessageResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

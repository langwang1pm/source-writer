
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UploadedFileResponse(BaseModel):
    id: UUID
    client_enterprise_id: UUID
    dify_document_id: str | None = None
    file_name: str
    file_size: int
    mime_type: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class UploadedFileListResponse(BaseModel):
    items: list[UploadedFileResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class UploadedFileCreateResponse(BaseModel):
    id: UUID
    file_name: str
    file_size: int
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

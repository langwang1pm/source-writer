
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SourceRefResponse(BaseModel):
    id: UUID
    response_doc_id: UUID
    message_block_id: UUID | None = None
    card_ordinal: int
    ordinal: int
    source_name: str
    dify_document_id: str | None = None
    uploaded_file_id: UUID | None = None
    chunk_id: str | None = None
    snippet: str | None = None
    relevance_score: float | None = None
    char_position: int | None = None

    model_config = ConfigDict(from_attributes=True)


class SourceRefListResponse(BaseModel):
    items: list[SourceRefResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

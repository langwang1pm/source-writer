
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class MessageBlockResponse(BaseModel):
    id: UUID
    session_id: UUID
    user_message_id: UUID
    card_ordinal: int
    block_type: str
    content: str
    ordinal: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

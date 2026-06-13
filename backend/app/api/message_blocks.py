
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.message_block import MessageBlock
from app.schemas.message_block import MessageBlockResponse

router = APIRouter(prefix="/api/v1/message-blocks", tags=["Message Blocks"])


@router.get("", response_model=list[MessageBlockResponse])
async def list_message_blocks(
    user_message_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MessageBlock)
        .where(MessageBlock.user_message_id == user_message_id)
        .order_by(MessageBlock.card_ordinal, MessageBlock.ordinal)
    )
    items = result.scalars().all()
    return items

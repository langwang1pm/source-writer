
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.chat_message import ChatMessage
from app.models.session import Session
from app.schemas.chat_message import (
    ChatMessageSend, ChatMessageResponse, ChatMessageListResponse,
)

router = APIRouter(prefix="/api/v1/sessions", tags=["Chat Messages"])


@router.get("/{session_id}/messages", response_model=ChatMessageListResponse)
async def list_messages(
    session_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(Session, session_id)
    if not session or session.deleted_at is not None:
        raise HTTPException(404, detail="Session not found")
    q = select(ChatMessage).where(
        ChatMessage.session_id == session_id,
        ChatMessage.deleted_at.is_(None),
    )
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar()
    result = await db.execute(
        q.order_by(ChatMessage.created_at.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = result.scalars().all()
    return ChatMessageListResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.post("/{session_id}/messages", response_model=ChatMessageResponse, status_code=201)
async def send_message(
    session_id: UUID,
    body: ChatMessageSend,
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(Session, session_id)
    if not session or session.deleted_at is not None:
        raise HTTPException(404, detail="Session not found")
    msg = ChatMessage(
        session_id=session_id,
        content=body.content,
        task_type_id=body.task_type_id,
    )
    db.add(msg)
    # Auto-generate session title from first message
    if not session.title:
        session.title = body.content[:30]
    await db.commit()
    await db.refresh(msg)
    return msg

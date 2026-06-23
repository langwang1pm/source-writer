
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.session import Session
from app.models.workspace import Workspace
from app.models.chat_message import ChatMessage
from app.models.task_type import TaskType
from app.schemas.session import (
    SessionCreate, SessionUpdate, SessionResponse, SessionListResponse,
)

router = APIRouter(prefix="/api/v1/sessions", tags=["Sessions"], redirect_slashes=False)


@router.post("/", response_model=SessionResponse, status_code=201)
@router.post("", response_model=SessionResponse, status_code=201)
async def create_session(body: SessionCreate, db: AsyncSession = Depends(get_db)):
    ws = await db.get(Workspace, body.workspace_id)
    if not ws or ws.deleted_at is not None:
        raise HTTPException(404, detail="Workspace not found")
    if body.task_type_id:
        tt = await db.get(TaskType, body.task_type_id)
        if not tt or tt.deleted_at is not None:
            raise HTTPException(404, detail="Task type not found")
    session = Session(workspace_id=body.workspace_id)
    if body.task_type_id:
        session.task_type_id = body.task_type_id
    db.add(session)
    await db.commit()
    from sqlalchemy.orm import selectinload
    from sqlalchemy import select
    result = await db.execute(
        select(Session).options(selectinload(Session.task_type)).where(Session.id == session.id)
    )
    session = result.scalar_one()
    return session


@router.get("/", response_model=SessionListResponse)
@router.get("", response_model=SessionListResponse)
async def list_sessions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    workspace_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload
    q = select(Session).where(Session.deleted_at.is_(None))
    if workspace_id:
        q = q.where(Session.workspace_id == workspace_id)
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar()
    result = await db.execute(
        q.options(selectinload(Session.task_type))
        .order_by(Session.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = result.scalars().all()
    return SessionListResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: UUID, db: AsyncSession = Depends(get_db)):
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Session).options(selectinload(Session.task_type)).where(
            Session.id == session_id,
            Session.deleted_at.is_(None),
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, detail="Session not found")
    return session


@router.put("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: UUID,
    body: SessionUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
            Session.deleted_at.is_(None),
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, detail="Session not found")
    if body.title is not None:
        session.title = body.title
    await db.commit()
    from sqlalchemy.orm import selectinload
    from sqlalchemy import select
    result = await db.execute(
        select(Session).options(selectinload(Session.task_type)).where(Session.id == session.id)
    )
    session = result.scalar_one()
    return session


@router.delete("/{session_id}", status_code=204)
async def delete_session(session_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
            Session.deleted_at.is_(None),
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, detail="Session not found")
    session.deleted_at = datetime.now(timezone.utc)
    await db.commit()


@router.get("/{session_id}/stream")
async def stream_chat(
    session_id: UUID,
    user_message_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    from fastapi.responses import StreamingResponse

    session = await db.get(Session, session_id)
    if not session or session.deleted_at is not None:
        raise HTTPException(404, detail="Session not found")

    msg = await db.get(ChatMessage, user_message_id)
    if not msg or msg.deleted_at is not None:
        raise HTTPException(404, detail="Message not found")
    if msg.session_id != session_id:
        raise HTTPException(400, detail="Message not in this session")

    from app.services.stream_svc import create_stream_service
    svc = create_stream_service(db, session_id, user_message_id)
    return StreamingResponse(
        svc.stream(msg.content),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

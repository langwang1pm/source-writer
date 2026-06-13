
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.response_doc import ResponseDoc
from app.schemas.response_doc import (
    ResponseDocResponse, ResponseDocUpdate, ResponseDocListResponse,
)

router = APIRouter(prefix="/api/v1/response-docs", tags=["Response Docs"])


@router.get("", response_model=ResponseDocListResponse)
async def list_response_docs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    q = select(ResponseDoc).where(ResponseDoc.deleted_at.is_(None))
    if session_id:
        q = q.where(ResponseDoc.session_id == session_id)
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar()
    result = await db.execute(
        q.order_by(ResponseDoc.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = result.scalars().all()
    return ResponseDocListResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{doc_id}", response_model=ResponseDocResponse)
async def get_response_doc(doc_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ResponseDoc).where(
            ResponseDoc.id == doc_id,
            ResponseDoc.deleted_at.is_(None),
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, detail="Document not found")
    return doc


@router.put("/{doc_id}", response_model=ResponseDocResponse)
async def update_response_doc(
    doc_id: UUID,
    body: ResponseDocUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ResponseDoc).where(
            ResponseDoc.id == doc_id,
            ResponseDoc.deleted_at.is_(None),
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, detail="Document not found")
    import markdown
    if body.title is not None:
        doc.title = body.title
    if body.body_markdown is not None:
        doc.body_markdown = body.body_markdown
        doc.body_html = markdown.markdown(body.body_markdown, extensions=["extra"])
    doc.revision += 1
    await db.commit()
    await db.refresh(doc)
    return doc


@router.get("/{doc_id}/export")
async def export_docx(doc_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ResponseDoc).where(
            ResponseDoc.id == doc_id,
            ResponseDoc.deleted_at.is_(None),
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, detail="Document not found")
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(
        content=doc.body_markdown or "",
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{doc.title or "export"}.md"'},
    )

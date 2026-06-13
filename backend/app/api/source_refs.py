
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.source_ref import SourceRef
from app.schemas.source_ref import SourceRefListResponse

router = APIRouter(prefix="/api/v1/source-refs", tags=["Source Refs"])


@router.get("", response_model=SourceRefListResponse)
async def list_source_refs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    doc_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    q = select(SourceRef)
    if doc_id:
        q = q.where(SourceRef.response_doc_id == doc_id)
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar()
    result = await db.execute(
        q.order_by(SourceRef.card_ordinal, SourceRef.ordinal)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = result.scalars().all()
    return SourceRefListResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )

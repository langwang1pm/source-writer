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
    """
    Return source refs for a response doc, deduplicated per card:
    - Within each card (same card_ordinal), duplicate (dify_document_id, chunk_id)
      pairs are merged: only the first occurrence is kept.
    - Ordinals are re-numbered globally starting from 1, in card order.
    - Each card retains its own independent ordinal sequence.
    """
    if doc_id:
        result = await db.execute(
            select(SourceRef)
            .where(SourceRef.response_doc_id == doc_id)
            .order_by(SourceRef.card_ordinal, SourceRef.char_position, SourceRef.id)
        )
        all_items = list(result.scalars().all())

        # Deduplicate per card: (card_ordinal, dify_document_id, chunk_id) → keep first
        seen: dict[tuple, int] = {}  # (card_ordinal, doc_id, chunk_id) → first position
        deduped: list[SourceRef] = []
        for item in all_items:
            key = (item.card_ordinal, item.dify_document_id, item.chunk_id)
            if key not in seen:
                seen[key] = len(deduped)
                deduped.append(item)

        # Re-number ordinals: per-card, starting from 1 for each card
        card_ordinal_counts: dict[int, int] = {}  # card_ordinal -> next ordinal
        for item in deduped:
            card_ord = item.card_ordinal
            if card_ord not in card_ordinal_counts:
                card_ordinal_counts[card_ord] = 1
            item.ordinal = card_ordinal_counts[card_ord]
            card_ordinal_counts[card_ord] += 1

        total = len(deduped)
        start = (page - 1) * page_size
        end = start + page_size
        page_items = deduped[start:end]

        return SourceRefListResponse(
            items=page_items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size if total > 0 else 1,
        )

    # No doc_id filter: return as-is (no deduplication)
    q = select(SourceRef)
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

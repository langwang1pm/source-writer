from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.clients.dify_dataset_client import dify_dataset_client

router = APIRouter(prefix="/api/v1/dify", tags=["Dify Proxy"])


@router.get("/segments/{document_id}/{chunk_id}")
async def get_segment_detail(document_id: str, chunk_id: str):
    """Fetch a Dify document segment (chunk) detail by document_id and chunk_id."""
    result = await dify_dataset_client.get_segment_detail(document_id, chunk_id)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Segment not found or Dify API error",
        )
    return result

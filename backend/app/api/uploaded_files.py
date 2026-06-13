
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.uploaded_file import UploadedFile
from app.schemas.uploaded_file import (
    UploadedFileResponse, UploadedFileListResponse,
)

router = APIRouter(prefix="/api/v1/uploaded-files", tags=["Uploaded Files"])


@router.get("", response_model=UploadedFileListResponse)
async def list_uploaded_files(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    enterprise_id: UUID | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    q = select(UploadedFile).where(UploadedFile.deleted_at.is_(None))
    if enterprise_id:
        q = q.where(UploadedFile.client_enterprise_id == enterprise_id)
    if search:
        q = q.where(UploadedFile.file_name.ilike(f"%{search}%"))
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar()
    result = await db.execute(
        q.order_by(UploadedFile.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = result.scalars().all()
    return UploadedFileListResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{file_id}", response_model=UploadedFileResponse)
async def get_uploaded_file(file_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UploadedFile).where(
            UploadedFile.id == file_id,
            UploadedFile.deleted_at.is_(None),
        )
    )
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(404, detail="File not found")
    return f


@router.delete("/{file_id}", status_code=204)
async def delete_uploaded_file(file_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UploadedFile).where(
            UploadedFile.id == file_id,
            UploadedFile.deleted_at.is_(None),
        )
    )
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(404, detail="File not found")
    from datetime import datetime, timezone
    f.deleted_at = datetime.now(timezone.utc)
    await db.commit()

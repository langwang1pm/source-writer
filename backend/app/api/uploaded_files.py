
from __future__ import annotations

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.uploaded_file import UploadedFile
from sqlalchemy import select, func
from app.schemas.uploaded_file import (
    UploadedFileResponse, UploadedFileListResponse, UploadedFileCreateResponse,
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


@router.post("", response_model=UploadedFileCreateResponse, status_code=201)
async def create_uploaded_file(
    enterprise_id: UUID = Query(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    from app.services.upload_svc import upload_file
    try:
        uploaded = await upload_file(db, file, enterprise_id)
    except ValueError as e:
        raise HTTPException(400, detail=str(e))
    return UploadedFileCreateResponse(
        id=uploaded.id,
        file_name=uploaded.file_name,
        file_size=uploaded.file_size,
        status=uploaded.status,
        created_at=uploaded.created_at,
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


@router.get("/{file_id}/download")
async def download_uploaded_file(file_id: UUID, db: AsyncSession = Depends(get_db)):
    from fastapi.responses import FileResponse
    result = await db.execute(
        select(UploadedFile).where(
            UploadedFile.id == file_id,
            UploadedFile.deleted_at.is_(None),
        )
    )
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(404, detail="File not found")
    if not f.local_path:
        raise HTTPException(404, detail="File not available on disk")
    from app.config import settings
    file_path = Path(settings.upload_dir) / f.local_path
    if not file_path.exists():
        raise HTTPException(404, detail="File not found on disk")
    return FileResponse(
        path=str(file_path),
        filename=f.file_name,
        media_type=f.mime_type or "application/octet-stream",
    )


@router.delete("/{file_id}", status_code=204)
async def delete_uploaded_file(file_id: UUID, db: AsyncSession = Depends(get_db)):
    from app.services.upload_svc import delete_file_with_dify
    result = await db.execute(
        select(UploadedFile).where(
            UploadedFile.id == file_id,
            UploadedFile.deleted_at.is_(None),
        )
    )
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(404, detail="File not found")
    await delete_file_with_dify(db, f)


@router.post("/{file_id}/refresh-status")
async def refresh_file_status_endpoint(file_id: UUID, db: AsyncSession = Depends(get_db)):
    """Refresh a single file's status from Dify."""
    from app.services.upload_svc import refresh_file_status
    result = await db.execute(
        select(UploadedFile).where(
            UploadedFile.id == file_id,
            UploadedFile.deleted_at.is_(None),
        )
    )
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(404, detail="File not found")
    status = await refresh_file_status(db, f)
    return {"status": status or f.status}

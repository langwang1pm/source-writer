
from __future__ import annotations

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from starlette.requests import Request
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
    # Sync non-final statuses from Dify (in-memory only)
    import httpx, asyncio
    from app.config import settings
    dify_h = {'Authorization': 'Bearer ' + (settings.dify_dataset_api_key or settings.dify_app_api_key)}
    async def _fetch(f):
        try:
            url = settings.dify_base_url + "/v1/datasets/" + settings.dify_dataset_id + "/documents/" + f.dify_document_id
            async with httpx.AsyncClient() as c:
                r = await c.get(url, headers=dify_h, timeout=10)
                if r.status_code == 200:
                    s = r.json().get("indexing_status")
                    if s and s != f.status:
                        f.status = s
        except:
            pass
    tasks = []
    for f in items:
        if f.dify_document_id and f.status not in ("available", "completed", "error"):
            tasks.append(_fetch(f))
    if tasks:
        await asyncio.gather(*tasks)
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


@router.get("/{file_id}/preview")
async def preview_uploaded_file(file_id: UUID, db: AsyncSession = Depends(get_db)):
    """Preview a file (inline disposition for browser viewing)."""
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
        media_type=f.mime_type or "application/octet-stream",
        headers={"Content-Disposition": "inline"},
    )



@router.get("/{file_id}/office-preview")
async def office_preview_file(file_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    """Preview a file using OnlyOffice Document Server."""
    from starlette.responses import HTMLResponse
    from app.config import settings
    import json
    import jwt
    result = await db.execute(select(UploadedFile).where(UploadedFile.id == file_id, UploadedFile.deleted_at.is_(None)))
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(404, detail="File not found")
    base_url = settings.dify_public_url or str(request.base_url).rstrip('/')
    doc_url = base_url + "/api/v1/uploaded-files/" + str(file_id) + "/download"
    onlyoffice_url = settings.dify_office_base_url or "http://192.168.2.121:8080"
    ext = f.file_name.split(".")[-1].lower() if "." in f.file_name else ""
    dc = {
        "document": {
            "fileType": ext,
            "key": str(file_id),
            "title": f.file_name,
            "url": doc_url
        },
        "documentType": "word",
        "editorConfig": {
            "mode": "view",
            "user": {"name": "Preview", "id": "preview"}
        }
    }
    if settings.dify_office_secret:
        dc["token"] = jwt.encode(dc, settings.dify_office_secret, algorithm="HS256")
    cjson = json.dumps(dc, ensure_ascii=False)
    h  = '<!DOCTYPE html><html><head><meta charset=utf-8>'
    h += '<script src="' + onlyoffice_url + '/web-apps/apps/api/documents/api.js"></script>'
    h += '</head><body style=margin:0;height:100vh>'
    h += '<div id=placeholder style=height:100%></div><script>'
    h += 'new DocsAPI.DocEditor("placeholder",' + cjson + ');'
    h += '</script></body></html>'
    return HTMLResponse(content=h)


@router.post("/{file_id}/refresh-status")
async def refresh_file_status_endpoint(file_id: UUID, db: AsyncSession = Depends(get_db)):
    """Refresh a single file's status from Dify."""
    try:
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
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}, 500

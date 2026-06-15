
from __future__ import annotations

import os
import uuid
from pathlib import Path
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.clients.dify_dataset_client import dify_dataset_client
from app.models.uploaded_file import UploadedFile
from app.models.client_enterprise import ClientEnterprise

ALLOWED_MIMES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


async def upload_file(
    db: AsyncSession,
    file: UploadFile,
    enterprise_id: UUID,
) -> UploadedFile:
    """Upload a file: save locally, sync to Dify, create DB record."""
    # Validate enterprise
    ent = await db.get(ClientEnterprise, enterprise_id)
    if not ent or ent.deleted_at is not None:
        raise ValueError("Enterprise not found")

    # Validate file type
    if file.content_type and file.content_type not in ALLOWED_MIMES:
        raise ValueError(f"File type {file.content_type} not allowed")

    # Validate file size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise ValueError("File too large (max 50MB)")

    file_id = uuid.uuid4()
    file_name = file.filename or f"unnamed_{file_id}"

    # Save locally
    upload_root = Path(settings.upload_dir)
    local_dir = upload_root / str(enterprise_id) / str(file_id)
    local_dir.mkdir(parents=True, exist_ok=True)
    local_path = local_dir / f"original{Path(file_name).suffix or '.bin'}"
    local_path.write_bytes(contents)

    # Upload to Dify
    dify_result = await dify_dataset_client.upload_file(
        file_path=str(local_path),
        file_name=file_name,
    )

    dify_doc_id = None
    status = "pending"
    if dify_result:
        dify_doc_id = dify_result["dify_document_id"]
        status = dify_result["status"]
        # Set metadata (company tag)
        await dify_dataset_client.set_metadata(
            dify_doc_id, str(enterprise_id),
        )

    # Create DB record
    uploaded = UploadedFile(
        client_enterprise_id=enterprise_id,
        dify_document_id=dify_doc_id,
        file_name=file_name,
        file_size=len(contents),
        mime_type=file.content_type or "application/octet-stream",
        local_path=str(local_path.relative_to(upload_root)),
        status=status,
    )
    db.add(uploaded)
    await db.commit()
    await db.refresh(uploaded)
    return uploaded


async def delete_file_with_dify(
    db: AsyncSession, uploaded_file: UploadedFile,
) -> None:
    """Delete file locally and from Dify."""
    # Delete from Dify
    if uploaded_file.dify_document_id:
        await dify_dataset_client.delete_document(uploaded_file.dify_document_id)

    # Delete local file
    upload_root = Path(settings.upload_dir)
    local_path = upload_root / uploaded_file.local_path if uploaded_file.local_path else None
    if local_path and local_path.exists():
        local_path.unlink(missing_ok=True)

    # Soft delete in DB
    from datetime import datetime, timezone
    uploaded_file.deleted_at = datetime.now(timezone.utc)
    await db.commit()


async def refresh_file_status(
    db: AsyncSession, uploaded_file: UploadedFile,
) -> str | None:
    """Query Dify for current indexing status and update DB."""
    if not uploaded_file.dify_document_id:
        return None
    status = await dify_dataset_client.get_document_status(uploaded_file.dify_document_id)
    if status and status != uploaded_file.status:
        uploaded_file.status = status
        await db.commit()
    return status

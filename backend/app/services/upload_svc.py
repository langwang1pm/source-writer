from __future__ import annotations


import os

import uuid

from datetime import datetime, timezone

from pathlib import Path

from uuid import UUID


from fastapi import UploadFile

from sqlalchemy import update as sa_update

from sqlalchemy.ext.asyncio import AsyncSession


from app.config import settings
from app.clients.dify_workflow_client import dify_workflow_client


from app.clients.dify_dataset_client import dify_dataset_client

from app.models.uploaded_file import UploadedFile, UploadFileStatus

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


async def upload_file_local(

    db: AsyncSession,

    file: UploadFile,

    enterprise_id: UUID,

) -> UploadedFile:

    """Phase 1: Save file locally and create DB record.

    
    Creates a DB record with status "æ¬å°æä»¶ä¸ä¼ ä¸?,

    saves the file to disk, then updates status to "æ¬å°æä»¶ä¸ä¼ å·²å®æ?.

    """

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


    # 1. Create DB record with status "æ¬å°æä»¶ä¸ä¼ ä¸?

    upload_root = Path(settings.upload_dir)

    uploaded = UploadedFile(

        id=file_id,

        client_enterprise_id=enterprise_id,

        dify_document_id=None,

        file_name=file_name,

        file_size=len(contents),

        mime_type=file.content_type or "application/octet-stream",

        local_path=None,

        status=UploadFileStatus.LOCAL_UPLOADING,

    )

    db.add(uploaded)

    await db.commit()

    await db.refresh(uploaded)


    try:

        # 2. Save locally

        local_dir = upload_root / str(enterprise_id) / str(file_id)

        local_dir.mkdir(parents=True, exist_ok=True)

        local_path = local_dir / f"original{Path(file_name).suffix or '.bin'}"

        local_path.write_bytes(contents)


        # 3. Update DB: set local_path and status to "æ¬å°æä»¶ä¸ä¼ å·²å®æ?

        await db.execute(

            sa_update(UploadedFile)

            .where(UploadedFile.id == file_id)

            .values(

                local_path=str(local_path.relative_to(upload_root)),

                status=UploadFileStatus.LOCAL_COMPLETED,

            )

        )

        await db.commit()

        await db.refresh(uploaded)

    except Exception:

        # On failure, mark as error

        await db.execute(

            sa_update(UploadedFile)

            .where(UploadedFile.id == file_id)

            .values(status=UploadFileStatus.ERROR)

        )

        await db.commit()

        await db.refresh(uploaded)

        raise


    return uploaded


async def sync_to_dify(
    db: AsyncSession,
    uploaded_file: UploadedFile,
) -> UploadedFile:
    """Phase 2: Upload local file to Dify knowledge base.

    Uses the Dify Dataset API directly (not the chatflow workflow)
    to upload the file to the knowledge base.  The Dataset API returns
    the document_id immediately before indexing completes, so there's
    no timeout risk for large documents.
    """
    if uploaded_file.dify_document_id is not None:
        raise ValueError("File already synced to Dify")
    if uploaded_file.status != UploadFileStatus.LOCAL_COMPLETED:
        raise ValueError("File must be in LOCAL_COMPLETED status before syncing to Dify")

    upload_root = Path(settings.upload_dir)
    local_path = upload_root / uploaded_file.local_path if uploaded_file.local_path else None
    if not local_path or not local_path.exists():
        raise ValueError("Local file not found on disk")

    # 1. Update status to DIFY_SYNCING
    await db.execute(
        sa_update(UploadedFile)
        .where(UploadedFile.id == uploaded_file.id)
        .values(status=UploadFileStatus.DIFY_SYNCING)
    )
    await db.commit()
    await db.refresh(uploaded_file)

    try:
        # 2. Upload file to Dify's file storage via the workflow client
        file_info = await dify_workflow_client.upload_file_to_dify(
            file_path=str(local_path),
            file_name=uploaded_file.file_name,
        )
        if not file_info:
            raise RuntimeError("Failed to upload file to Dify storage")

        # 3. Run the document processing workflow chatflow.
        #    This workflow applies the custom segmentation rules configured
        #    in Dify's "\u4e0a\u4f20\u6587\u6863\u89e3\u6790\u5904\u7406workflow".
        dify_result = await dify_workflow_client.run_chatflow(
            enterprise_id=str(uploaded_file.client_enterprise_id),
            file_info=file_info,
        )
        if not dify_result:
            raise RuntimeError("Failed to run Dify chatflow")

        dify_doc_id = dify_result["dify_document_id"]

        # 4. Query Dify for the document's indexing status
        dify_status = await dify_dataset_client.get_document_status(dify_doc_id)
        mapped_status = _map_dify_status(dify_status) if dify_status else UploadFileStatus.INDEXING

        # 5. Set enterprise metadata on the document (non-critical)
        try:
            await dify_dataset_client.set_metadata(
                dify_document_id=dify_doc_id,
                enterprise_id=str(uploaded_file.client_enterprise_id),
            )
        except Exception:
            pass

        # 6. Update DB record with Dify document ID and status
        await db.execute(
            sa_update(UploadedFile)
            .where(UploadedFile.id == uploaded_file.id)
            .values(
                dify_document_id=dify_doc_id,
                status=mapped_status,
            )
        )
        await db.commit()
        await db.refresh(uploaded_file)

    except Exception:
        # On failure, mark as error
        await db.execute(
            sa_update(UploadedFile)
            .where(UploadedFile.id == uploaded_file.id)
            .values(status=UploadFileStatus.ERROR)
        )
        await db.commit()
        await db.refresh(uploaded_file)
        raise


def _map_dify_status(dify_status: str) -> str:
    """Map Dify indexing_status to our status values."""
    mapping = {
        "completed": UploadFileStatus.COMPLETED,
        "available": UploadFileStatus.COMPLETED,
        "error": UploadFileStatus.ERROR,
        "waiting": UploadFileStatus.WAITING,
        "parsing": UploadFileStatus.PARSING,
        "cleaning": UploadFileStatus.CLEANING,
        "splitting": UploadFileStatus.SPLITTING,
        "indexing": UploadFileStatus.INDEXING,
        "paused": UploadFileStatus.WAITING,
    }
    return mapping.get(dify_status, dify_status)


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

    uploaded_file.deleted_at = datetime.now(timezone.utc)

    await db.commit()


async def refresh_file_status(

    db: AsyncSession, uploaded_file: UploadedFile,

) -> str | None:

    """Query Dify for current indexing status and update DB.

    
    Maps Dify statuses to our values:

    - completed -> å·²å®æ?    - error -> error

    - others stored as-is

    """

    if not uploaded_file.dify_document_id:

        return None

    
    # Only refresh if file is in a non-terminal Dify-related status

    terminal_statuses = {UploadFileStatus.COMPLETED, UploadFileStatus.ERROR}

    if uploaded_file.status in terminal_statuses:

        return uploaded_file.status


    dify_status = await dify_dataset_client.get_document_status(uploaded_file.dify_document_id)

    if not dify_status:

        return uploaded_file.status


    mapped = _map_dify_status(dify_status)

    if mapped != uploaded_file.status:

        await db.execute(

            sa_update(UploadedFile)

            .where(UploadedFile.id == uploaded_file.id)

            .values(status=mapped)

        )

        await db.commit()

        uploaded_file.status = mapped

    return mapped


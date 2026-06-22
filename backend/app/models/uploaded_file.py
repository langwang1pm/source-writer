from __future__ import annotations

from sqlalchemy import BigInteger, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class UploadFileStatus:
    """File upload status constants."""
    # Local file phases
    LOCAL_UPLOADING = "本地文件上传中"
    LOCAL_COMPLETED = "本地文件上传已完成"
    DIFY_SYNCING = "文件同步dify知识库中"
    # Dify indexing statuses (stored as-is from Dify API)
    WAITING = "waiting"
    PARSING = "parsing"
    CLEANING = "cleaning"
    SPLITTING = "splitting"
    INDEXING = "indexing"
    ERROR = "error"
    # Terminal status
    COMPLETED = "已完成"


class UploadedFile(TimestampMixin, Base):
    __tablename__ = "uploaded_file"
    __table_args__ = {"schema": "sourcewriter"}

    client_enterprise_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sourcewriter.client_enterprise.id"), nullable=False
    )
    dify_document_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    local_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default=UploadFileStatus.LOCAL_UPLOADING
    )

    # relationships
    client_enterprise: Mapped["ClientEnterprise"] = relationship(back_populates="uploaded_files")
    source_refs: Mapped[list["SourceRef"]] = relationship(back_populates="uploaded_file")

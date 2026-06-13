from __future__ import annotations

from sqlalchemy import BigInteger, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


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
        String(20), nullable=False, default="pending"
    )  # pending / indexing / available / error

    # relationships
    client_enterprise: Mapped["ClientEnterprise"] = relationship(back_populates="uploaded_files")
    source_refs: Mapped[list["SourceRef"]] = relationship(back_populates="uploaded_file")

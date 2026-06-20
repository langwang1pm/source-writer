from __future__ import annotations

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class SourceRef(TimestampMixin, Base):
    __tablename__ = "source_ref"
    __table_args__ = {"schema": "sourcewriter"}

    __mapper_args__ = {"exclude_properties": ["updated_at"]}

    response_doc_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sourcewriter.response_doc.id"), nullable=True
    )
    message_block_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sourcewriter.message_block.id"), nullable=True
    )
    card_ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    source_name: Mapped[str] = mapped_column(String(500), nullable=False)
    dify_document_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    uploaded_file_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sourcewriter.uploaded_file.id"), nullable=True
    )
    chunk_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    relevance_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    char_position: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # relationships
    response_doc: Mapped["ResponseDoc"] = relationship(back_populates="source_refs")
    message_block: Mapped["MessageBlock"] = relationship(back_populates="source_refs")
    uploaded_file: Mapped["UploadedFile"] = relationship(back_populates="source_refs")

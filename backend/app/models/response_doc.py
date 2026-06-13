from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ResponseDoc(TimestampMixin, Base):
    __tablename__ = "response_doc"
    __table_args__ = {"schema": "sourcewriter"}

    session_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sourcewriter.session.id"), nullable=False
    )
    chat_message_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sourcewriter.chat_message.id"), nullable=False
    )
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    body_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # relationships
    session: Mapped["Session"] = relationship(back_populates="response_docs")
    chat_message: Mapped["ChatMessage"] = relationship(
        back_populates="response_docs",
        foreign_keys=[chat_message_id],
    )
    source_refs: Mapped[list["SourceRef"]] = relationship(back_populates="response_doc")

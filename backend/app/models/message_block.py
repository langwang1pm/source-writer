from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class MessageBlock(TimestampMixin, Base):
    __tablename__ = "message_block"
    __table_args__ = {"schema": "sourcewriter"}

    __mapper_args__ = {"exclude_properties": ["updated_at", "deleted_at"]}

    session_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sourcewriter.session.id"), nullable=False
    )
    user_message_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sourcewriter.chat_message.id"), nullable=False
    )
    card_ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    block_type: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)

    session: Mapped["Session"] = relationship(back_populates="message_blocks")
    user_message: Mapped["ChatMessage"] = relationship(
        back_populates="message_blocks", foreign_keys=[user_message_id]
    )
    source_refs: Mapped[list["SourceRef"]] = relationship(back_populates="message_block")

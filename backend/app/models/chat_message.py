from __future__ import annotations

from sqlalchemy import ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ChatMessage(TimestampMixin, Base):
    __tablename__ = "chat_message"
    __table_args__ = {"schema": "sourcewriter"}

    __mapper_args__ = {"exclude_properties": ["updated_at"]}

    session_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sourcewriter.session.id"), nullable=False
    )
    task_type_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sourcewriter.task_type.id"), nullable=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # relationships
    session: Mapped["Session"] = relationship(back_populates="chat_messages")
    message_blocks: Mapped[list["MessageBlock"]] = relationship(
        back_populates="user_message",
        foreign_keys="MessageBlock.user_message_id",
    )
    response_docs: Mapped[list["ResponseDoc"]] = relationship(
        back_populates="chat_message",
        foreign_keys="ResponseDoc.chat_message_id",
    )

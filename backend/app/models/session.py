from __future__ import annotations

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Session(TimestampMixin, Base):
    __tablename__ = "session"
    __table_args__ = {"schema": "sourcewriter"}

    workspace_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sourcewriter.workspace.id"), nullable=False
    )
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # relationships
    workspace: Mapped["Workspace"] = relationship(back_populates="sessions")
    chat_messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="session", order_by="ChatMessage.created_at"
    )
    response_docs: Mapped[list["ResponseDoc"]] = relationship(back_populates="session")
    message_blocks: Mapped[list["MessageBlock"]] = relationship(back_populates="session")

from __future__ import annotations

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Workspace(TimestampMixin, Base):
    __tablename__ = "workspace"
    __table_args__ = {"schema": "sourcewriter"}

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_enterprise_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sourcewriter.client_enterprise.id"), nullable=False
    )

    # relationships
    client_enterprise: Mapped["ClientEnterprise"] = relationship(back_populates="workspaces")
    sessions: Mapped[list["Session"]] = relationship(back_populates="workspace")

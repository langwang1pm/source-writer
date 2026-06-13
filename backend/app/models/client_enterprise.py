from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ClientEnterprise(TimestampMixin, Base):
    __tablename__ = "client_enterprise"
    __table_args__ = {"schema": "sourcewriter"}

    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)

    # relationships
    workspaces: Mapped[list["Workspace"]] = relationship(back_populates="client_enterprise")
    uploaded_files: Mapped[list["UploadedFile"]] = relationship(back_populates="client_enterprise")

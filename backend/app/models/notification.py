import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    event_type: Mapped[str] = mapped_column(String(48), nullable=False)
    subject_type: Mapped[str | None] = mapped_column(String(16), nullable=True)
    subject_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    link: Mapped[str] = mapped_column(Text, nullable=False)
    coalesce_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    actor_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("1")
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index(
            "ix_notifications_recipient_read_created",
            "recipient_id",
            "read_at",
            text("created_at DESC"),
        ),
        Index(
            "notifications_coalesce_uniq",
            "recipient_id",
            "coalesce_key",
            unique=True,
            postgresql_where=text("coalesce_key IS NOT NULL AND read_at IS NULL"),
        ),
    )

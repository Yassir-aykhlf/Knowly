import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.question import Question
    from app.models.user import User


class Answer(Base):
    __tablename__ = "answers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_ai_assisted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    moderation_status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=text("'approved'")
    )
    moderation_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    question: Mapped["Question"] = relationship(
        back_populates="answers", foreign_keys=[question_id]
    )
    author: Mapped["User"] = relationship(
        back_populates="answers", foreign_keys=[author_id]
    )

    __table_args__ = (
        CheckConstraint(
            "char_length(body) BETWEEN 30 AND 30000", name="ck_answers_body_len"
        ),
        CheckConstraint(
            "moderation_status IN ('pending','approved','rejected')",
            name="ck_answers_mod_status",
        ),
    )

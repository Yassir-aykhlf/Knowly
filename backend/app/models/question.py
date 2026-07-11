import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.answer import Answer
    from app.models.user import User


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default=text("'{}'")
    )
    accepted_answer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "answers.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_questions_accepted_answer",
        ),
        nullable=True,
    )
    view_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    moderation_status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=text("'approved'")
    )
    moderation_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    search_vector: Mapped[str | None] = mapped_column(TSVECTOR, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    author: Mapped["User"] = relationship(
        back_populates="questions", foreign_keys=[author_id]
    )
    answers: Mapped[list["Answer"]] = relationship(
        back_populates="question",
        foreign_keys="Answer.question_id",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    accepted_answer: Mapped["Answer | None"] = relationship(
        foreign_keys=[accepted_answer_id], post_update=True
    )

    __table_args__ = (
        CheckConstraint(
            "char_length(title) BETWEEN 10 AND 200", name="ck_questions_title_len"
        ),
        CheckConstraint(
            "char_length(body) BETWEEN 30 AND 30000", name="ck_questions_body_len"
        ),
        CheckConstraint("cardinality(tags) <= 5", name="ck_questions_tags_count"),
        CheckConstraint(
            "moderation_status IN ('pending','approved','rejected')",
            name="ck_questions_mod_status",
        ),
        Index("ix_questions_search_vector", "search_vector", postgresql_using="gin"),
        Index("ix_questions_tags", "tags", postgresql_using="gin"),
    )

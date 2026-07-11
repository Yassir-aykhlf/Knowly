import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.ai import AiConversation
    from app.models.answer import Answer
    from app.models.comment import Comment
    from app.models.question import Question
    from app.models.session import Session

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str | None] = mapped_column(String(254), unique=True, nullable=True)
    username: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    role: Mapped[str] = mapped_column(String(16), nullable=False, server_default=text("'user'"))
    oauth_provider: Mapped[str | None] = mapped_column(Text, nullable=True)
    oauth_subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_anonymized: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    last_seen: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
    
    questions: Mapped[list["Question"]] = relationship(back_populates="author", foreign_keys="Question.author_id")
    answers: Mapped[list["Answer"]] = relationship(back_populates="author", foreign_keys="Answer.author_id")
    comments: Mapped[list["Comment"]] = relationship(back_populates="author", foreign_keys="Comment.author_id")
    sessions: Mapped[list["Session"]] = relationship(back_populates="user", cascade="all, delete-orphan", passive_deletes=True)
    ai_conversations: Mapped[list["AiConversation"]] = relationship(back_populates="user", cascade="all, delete-orphan", passive_deletes=True)

    __table_args__ = (
        UniqueConstraint("oauth_provider", "oauth_subject", name="uq_users_oauth"),
        CheckConstraint(
            "(oauth_provider IS NULL AND oauth_subject IS NULL) OR "
            "(oauth_provider IS NOT NULL AND oauth_subject is NOT NULL)",
            name="ck_users_oauth_pair", 
        ),
        CheckConstraint(
            "char_length(username) BETWEEN 3 AND 30", name="ck_users_username_len"
        ),
        CheckConstraint(
            "bio IS NULL OR char_length(bio) <= 500", name="ck_users_bio_len"
        ),
        CheckConstraint("role IN ('user', 'admin')", name="ck_users_role"),
    )
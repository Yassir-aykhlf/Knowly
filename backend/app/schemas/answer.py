import uuid

from pydantic import BaseModel, ConfigDict, Field
from typing import TYPE_CHECKING

from app.schemas.user import AuthorOut
from app.schemas.comment import CommentOut
from app.schemas.attachment import AttachmentOut
from app.services.content import viewer_votes, vote_totals

if TYPE_CHECKING:
    from app.models import Answer, Comment


class AnswerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    body: str
    author: AuthorOut
    is_ai_assisted: bool
    vote_total: int
    my_vote: int
    moderation_status: str
    moderation_note: str | None = None
    created_at: str
    updated_at: str
    comments: list[CommentOut] = Field(default_factory=list)
    attachments: list[AttachmentOut] = Field(default_factory=list)

    @classmethod
    def from_answer(
        cls, answer, vote_total=0, my_vote=0, comments=None, attachments=None
    ) -> "AnswerOut":
        return cls(
            id=str(answer.id),
            body=answer.body,
            author=AuthorOut.from_user(answer.author),
            is_ai_assisted=answer.is_ai_assisted,
            vote_total=vote_total,
            my_vote=my_vote,
            moderation_status=answer.moderation_status,
            moderation_note=answer.moderation_note,
            created_at=answer.created_at.isoformat(),
            updated_at=answer.updated_at.isoformat(),
            comments=comments or [],
            attachments=attachments or [],
        )


class AnswerCreate(BaseModel):
    body: str
    is_ai_assisted: bool = False
    from_conversation_id: str | None = None
    attachment_ids: list[uuid.UUID] = Field(default_factory=list)


class AnswerUpdate(BaseModel):
    body: str
    attachment_ids: list[uuid.UUID] = Field(default_factory=list)

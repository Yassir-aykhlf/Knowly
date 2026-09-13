import uuid
from types import SimpleNamespace

from sqlalchemy import or_, true
from sqlalchemy.ext.asyncio import AsyncSession

def visible_filter(model, user):
    """SQL visibility rule shared by questions, answers, and profile counts.

    Approved content is public. Authors can see their own held content, and
    admins can see held content regardless of author.
    """
    if user is None:
        return model.moderation_status == "approved"
    if user.role == "admin":
        return true()
    return or_(
        model.moderation_status == "approved",
        model.author_id == user.id,
    )

def can_view(content, user) -> bool:
    if content.moderation_status == "approved":
        return True
    if user is None:
        return False
    return user.role == "admin" or content.author_id == user.id


async def load_owned(db: AsyncSession, model, obj_id: uuid.UUID, user, kind: str):
    return None


async def vote_totals(db: AsyncSession, target_type: str, ids: list) -> dict:
    return {}


async def viewer_votes(db: AsyncSession, user, target_type: str, ids: list) -> dict:
    return {}


async def apply_vote(db: AsyncSession, user, target_type: str, target_id, value: int):
    return SimpleNamespace(vote_total=0, my_vote=0)


async def question_context(db: AsyncSession, parent_type: str, parent_id: uuid.UUID):
    return None


async def delete_comments_for(db: AsyncSession, parent_type: str, parent_ids: list) -> None:
    return None

async def delete_votes_for(db: AsyncSession, target_type: str, target_ids: list) -> None:
    return None
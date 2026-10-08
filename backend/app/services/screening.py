from sqlalchemy.ext.asyncio import AsyncSession

from app.services import moderation


async def screen_and_stage(
    db: AsyncSession,
    *,
    kind: str,
    obj,
    text: str,
    question_id=None,
    parent_author_id=None,
    editing: bool = False,
    question_author_id=None,
) -> None:
    await moderation.screen_and_stage(
        db,
        kind=kind,
        obj=obj,
        text=text,
        question_id=question_id,
        parent_author_id=parent_author_id,
        editing=editing,
        question_author_id=question_author_id,
    )

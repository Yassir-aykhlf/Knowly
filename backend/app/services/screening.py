from sqlalchemy.ext.asyncio import AsyncSession

from app.services import moderation, notifications


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
    was_approved = editing and obj.moderation_status == "approved"

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

    if kind == "question":
        question_id = obj.id
    if question_id is None:
        return

    # STUB: drop once D-02 stages notifications itself
    await notifications.emit_content_approved(
        db, kind=kind, obj=obj, question_id=question_id, parent_author_id=parent_author_id
    )

    # STUB: drop once D-02 stages notifications itself
    if was_approved and obj.moderation_status == "approved":
        await notifications.notify_content_edited(
            db,
            kind=kind,
            obj=obj,
            question_id=question_id,
            question_author_id=question_author_id,
            actor_id=obj.author_id,
        )

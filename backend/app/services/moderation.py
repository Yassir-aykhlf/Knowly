from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class ModerationResult:
    flagged: bool
    categories: dict = field(default_factory=dict)
    reason: str | None = None


def evaluate_scores(categories: dict) -> tuple[bool, str | None]:
    return False, None


async def moderate(text: str) -> ModerationResult:
    return ModerationResult(flagged=False)


async def screen(text: str) -> tuple[str, str | None]:
    return "approved", None


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
    obj.moderation_status = "approved"
    obj.moderation_note = None
    await db.flush()
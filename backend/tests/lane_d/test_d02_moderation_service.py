"""D-02 — Moderation service (screening seam B calls).

Lane-local: asserts the verdict written onto content. The notifications the
verdict *implies* are staged through Lane C's seam (a no-op stub in a D build),
so those are asserted in milestone m4, not here.
"""
from app.models.question import Question
from app.services import moderation


def test_evaluate_scores_threshold_rule():
    # Default MODERATION_THRESHOLD is 0.5.
    flagged, reason = moderation.evaluate_scores({"harassment": 0.9, "hate": 0.1})
    assert flagged is True
    assert "harassment" in reason

    ok, none = moderation.evaluate_scores({"harassment": 0.2})
    assert ok is False and none is None


async def test_screen_maps_flagged_to_pending(moderation_flags):
    status, note = await moderation.screen("a perfectly nice sentence")
    assert (status, note) == ("approved", None)

    status, note = await moderation.screen(f"contains {moderation_flags.sentinel} bad stuff")
    assert status == "pending"
    assert note


async def test_screen_and_stage_writes_verdict_onto_content(moderation_flags, factory, db):
    author = await factory.user()
    q = Question(author_id=author.id, title="A totally fine question title here please",
                 body=f"This body contains {moderation_flags.sentinel} which trips moderation.")
    db.add(q)
    await moderation.screen_and_stage(db, kind="question", obj=q, text=q.body)
    assert q.moderation_status == "pending"
    assert q.moderation_note

    clean = Question(author_id=author.id, title="A totally fine question title here please",
                     body="This body is completely clean and should be approved fine.")
    db.add(clean)
    await moderation.screen_and_stage(db, kind="question", obj=clean, text=clean.body)
    assert clean.moderation_status == "approved"

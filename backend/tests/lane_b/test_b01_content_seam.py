"""B-01 — Content service (visibility, votes, ownership, cascades).

Direct unit tests of the seam A/C/D consume. Lane B owns these functions, so
they are exercised for real here (not stubbed).
"""
import pytest
from fastapi import HTTPException

from app.models.question import Question
from app.services import content


async def test_can_view_visibility_rules(factory):
    author = await factory.user()
    stranger = await factory.user()
    admin = await factory.user(role="admin")
    approved = await factory.question(author=author, moderation_status="approved")
    held = await factory.question(author=author, moderation_status="pending")

    assert content.can_view(approved, None) is True                               
    assert content.can_view(held, None) is False                                   
    assert content.can_view(held, stranger) is False                                
    assert content.can_view(held, author) is True                               
    assert content.can_view(held, admin) is True                              


async def test_apply_vote_upsert_then_clear(factory, db):
    voter = await factory.user()
    author = await factory.user()
    q = await factory.question(author=author)

    up = await content.apply_vote(db, voter, "question", q.id, 1)
    assert (up.vote_total, up.my_vote) == (1, 1)
                                    
    cleared = await content.apply_vote(db, voter, "question", q.id, 0)
    assert (cleared.vote_total, cleared.my_vote) == (0, 0)


async def test_load_owned_404_and_403(factory, db):
    owner = await factory.user()
    other = await factory.user()
    q = await factory.question(author=owner)

    import uuid
    with pytest.raises(HTTPException) as missing:
        await content.load_owned(db, Question, uuid.uuid4(), owner, "question")
    assert missing.value.status_code == 404

    with pytest.raises(HTTPException) as forbidden:
        await content.load_owned(db, Question, q.id, other, "question")
    assert forbidden.value.status_code == 403


async def test_question_context_resolves_answer_comment_chain(factory, db):
    qauthor = await factory.user()
    aauthor = await factory.user()
    q = await factory.question(author=qauthor)
    a = await factory.answer(question=q, author=aauthor)

    ctx = await content.question_context(db, "answer", a.id)
    assert ctx == (q.id, qauthor.id, aauthor.id)

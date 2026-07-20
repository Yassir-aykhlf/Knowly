"""C-01 — Notification write-seam (the contract B and D call).

Direct unit tests of the service Lane C owns. These functions *stage* rows in the
caller's transaction (they never commit), so each test commits then re-queries.
"""
from sqlalchemy import func, select

from app.models.notification import Notification
from app.services import notifications
from app.services.mentions import extract_mentions


async def _count(db) -> int:
    return (await db.execute(select(func.count()).select_from(Notification))).scalar_one()


async def test_self_action_never_notifies(factory, db):
    alice = await factory.user()
    await notifications.create_notification(
        db, recipient_id=alice.id, actor_id=alice.id,
        event_type="friend_request", link="/x",
    )
    await db.commit()
    assert await _count(db) == 0


async def test_idempotent_creation_events_insert_once(factory, db):
    owner = await factory.user()
    actor = await factory.user()
    subject_id = (await factory.question(author=owner)).id
    for _ in range(2):
        await notifications.create_notification(
            db, recipient_id=owner.id, actor_id=actor.id,
            event_type="answer_created", subject_type="answer",
            subject_id=subject_id, link="/q",
        )
    await db.commit()
    assert await _count(db) == 1


async def test_vote_events_coalesce_into_one_growing_row(factory, db):
    owner = await factory.user()
    a1 = await factory.user()
    a2 = await factory.user()
    key = "vote:question:abc"
    for actor in (a1, a2):
        await notifications.create_notification(
            db, recipient_id=owner.id, actor_id=actor.id, event_type="vote_cast",
            link="/q", coalesce_key=key,
        )
    await db.commit()
    rows = (await db.execute(select(Notification))).scalars().all()
    assert len(rows) == 1
    assert rows[0].actor_count == 2


async def test_only_first_vote_notifies(factory, db):
    owner = await factory.user()
    voter = await factory.user()
    q = await factory.question(author=owner)
                                                             
    await notifications.notify_vote_if_new(
        db, actor=voter, target_type="question", target_id=q.id,
        target_author_id=owner.id, question_id=q.id, value=1,
    )
    await db.commit()
    assert await _count(db) == 1

                                                               
    await factory.vote(voter=voter, target_type="question", target_id=q.id, value=1)
    await notifications.notify_vote_if_new(
        db, actor=voter, target_type="question", target_id=q.id,
        target_author_id=owner.id, question_id=q.id, value=-1,
    )
    await db.commit()
    assert await _count(db) == 1


def test_extract_mentions_ignores_code_spans():
    assert extract_mentions("hey @alice and @bob_ here") == {"alice", "bob_"}
    assert extract_mentions("`@alice` in code") == set()
    assert extract_mentions("email bob@example.com") == set()                 

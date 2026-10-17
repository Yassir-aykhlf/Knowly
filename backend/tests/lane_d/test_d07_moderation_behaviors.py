import asyncio
import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy import event, select

from app.models.answer import Answer
from app.models.comment import Comment
from app.models.notification import Notification
from app.models.question import Question
from app.services import notifications


async def pending_content(factory, kind, author, question):
    if kind == 'question':
        return await factory.question(author=author, moderation_status='pending')
    if kind == 'answer':
        return await factory.answer(author=author, question=question, moderation_status='pending')
    return await factory.comment(author=author, parent_type='question', parent_id=question.id,
                                 moderation_status='pending')


@pytest.mark.parametrize('authenticated,expected', [(False, 401), (True, 403)])
async def test_every_route_is_admin_only(auth_client, client, authenticated, expected):
    caller = (await auth_client())[0] if authenticated else client
    path = f'/api/moderation/question/{uuid.uuid4()}'
    assert (await caller.get('/api/moderation/pending')).status_code == expected
    assert (await caller.put(path + '/approve')).status_code == expected
    assert (await caller.put(path + '/reject', json={'note': 'Reason'})).status_code == expected


async def test_queue_unifies_types_resolves_comments_and_obeys_limit(auth_client, factory):
    author = await factory.user()
    root = await factory.question(author=author)
    parent = await factory.answer(question=root, author=author)
    base = datetime.utcnow() - timedelta(days=1)
    question = await factory.question(author=author, moderation_status='pending', created_at=base)
    answer = await factory.answer(question=root, author=author, moderation_status='pending', created_at=base + timedelta(seconds=1))
    comment = await factory.comment(author=author, parent_type='answer', parent_id=parent.id,
                                    moderation_status='pending', created_at=base + timedelta(seconds=2))
    direct = await factory.comment(author=author, parent_type='question', parent_id=root.id,
                                   moderation_status='pending', created_at=base + timedelta(seconds=3))
    await factory.question(author=author, moderation_status='rejected')
    caller, _ = await auth_client(role='admin')
    response = await caller.get('/api/moderation/pending?limit=3')
    assert response.status_code == 200
    rows = response.json()
    assert [(row['type'], row['id']) for row in rows] == [('question', str(question.id)), ('answer', str(answer.id)), ('comment', str(comment.id))]
    assert [row['question_id'] for row in rows] == [str(question.id), str(root.id), str(root.id)]
    assert rows[0]['title'] == question.title
    assert rows[1]['title'] is None and rows[2]['title'] is None
    assert rows[2]['author']['id'] == str(author.id)
    assert 'email' not in rows[2]['author']
    rows = (await caller.get('/api/moderation/pending?limit=4')).json()
    assert rows[-1]['id'] == str(direct.id) and rows[-1]['question_id'] == str(root.id)


async def test_comment_queue_query_count_does_not_grow_per_row(auth_client, factory, db):
    author = await factory.user()
    question = await factory.question(author=author)
    answer = await factory.answer(question=question, author=author)
    await factory.comment(author=author, parent_type='answer', parent_id=answer.id, moderation_status='pending')
    caller, _ = await auth_client(role='admin')
    counts = []
    for count in [1, 16]:
        if count == 16:
            for _ in range(15):
                await factory.comment(author=author, parent_type='answer', parent_id=answer.id, moderation_status='pending')
        queries = []
        def capture(conn, cursor, statement, parameters, context, executemany):
            if statement.lstrip().upper().startswith('SELECT'):
                queries.append(statement)
        event.listen(db.bind.sync_engine, 'before_cursor_execute', capture)
        try:
            response = await caller.get('/api/moderation/pending')
            assert response.status_code == 200
            assert len(response.json()) == count
        finally:
            event.remove(db.bind.sync_engine, 'before_cursor_execute', capture)
        counts.append(len(queries))
    assert counts[0] == counts[1]


@pytest.mark.parametrize('kind', ['question', 'answer', 'comment'])
async def test_rejection_reversal_and_system_notifications(auth_client, factory, db, kind):
    author = await factory.user()
    owner = await factory.user()
    root = await factory.question(author=owner)
    obj = await pending_content(factory, kind, author, root)
    caller, admin = await auth_client(role='admin')
    path = f'/api/moderation/{kind}/{obj.id}'
    rejected = await caller.put(path + '/reject', json={'note': '  Please clarify.  '})
    assert rejected.status_code == 200
    await db.refresh(obj)
    assert obj.moderation_status == 'rejected' and obj.moderation_note == 'Please clarify.'
    assert (await caller.put(path + '/reject', json={'note': 'Again'})).status_code == 409
    approved = await caller.put(path + '/approve')
    assert approved.status_code == 200
    await db.refresh(obj)
    assert obj.moderation_status == 'approved' and obj.moderation_note is None
    assert (await caller.put(path + '/approve')).status_code == 409
    notices = (await db.scalars(select(Notification).where(Notification.subject_id == obj.id))).all()
    verdicts = [n for n in notices if n.event_type.startswith('moderation_')]
    assert sorted(n.event_type for n in verdicts) == ['moderation_approved', 'moderation_rejected']
    assert all(n.actor_id is None and n.recipient_id == author.id for n in verdicts)
    assert all(n.link == f'/questions/{obj.id if kind == "question" else root.id}' for n in verdicts)


@pytest.mark.parametrize('note', [None, '', '  ', '\n\t', 'x'*1001, 123])
async def test_invalid_rejection_note_does_not_mutate_content(auth_client, factory, db, note):
    author = await factory.user()
    obj = await factory.question(author=author, moderation_status='pending')
    caller, _ = await auth_client(role='admin')
    payload = {} if note is None else {'note': note}
    assert (await caller.put(f'/api/moderation/question/{obj.id}/reject', json=payload)).status_code == 400
    await db.refresh(obj)
    assert obj.moderation_status == 'pending'
    assert not (await db.scalars(select(Notification).where(Notification.subject_id == obj.id))).all()


async def test_maximum_trimmed_note_is_accepted(auth_client, factory, db):
    obj = await factory.question(author=await factory.user(), moderation_status='pending')
    caller, _ = await auth_client(role='admin')
    assert (await caller.put(f'/api/moderation/question/{obj.id}/reject', json={'note': '  ' + 'x'*1000 + '  '})).status_code == 200
    await db.refresh(obj)
    assert obj.moderation_note == 'x'*1000


@pytest.mark.parametrize('kind', ['unknown', 'question', 'answer', 'comment'])
async def test_missing_and_unknown_content_are_404(auth_client, kind):
    caller, _ = await auth_client(role='admin')
    path = f'/api/moderation/{kind}/{uuid.uuid4()}'
    assert (await caller.put(path + '/approve')).status_code == 404
    assert (await caller.put(path + '/reject', json={'note': 'Reason'})).status_code == 404


async def test_approval_releases_owner_and_mentions_exactly_once(auth_client, factory, db, moderation_flags):
    owner = await factory.user()
    author_c, author = await auth_client()
    mentioned = await factory.user(username='queue_mentioned')
    root = await factory.question(author=owner)
    response = await author_c.post(f'/api/questions/{root.id}/answers', json={
        'body': f'A detailed answer mentioning @queue_mentioned and containing {moderation_flags.sentinel} for review.',
    })
    assert response.status_code == 201 and response.json()['moderation_status'] == 'pending'
    answer_id = uuid.UUID(response.json()['id'])
    assert not (await db.scalars(select(Notification).where(Notification.subject_id == answer_id, Notification.event_type.in_(['answer_created', 'mentioned'])))).all()
    caller, _ = await auth_client(role='admin')
    path = f'/api/moderation/answer/{answer_id}/approve'
    assert (await caller.put(path)).status_code == 200
    assert (await caller.put(path)).status_code == 409
    answer = await db.get(Answer, answer_id)
    await notifications.emit_content_approved(db, kind='answer', obj=answer, question_id=root.id, parent_author_id=owner.id)
    await db.commit()
    notices = (await db.scalars(select(Notification).where(Notification.subject_id == answer_id))).all()
    assert len([n for n in notices if n.event_type == 'answer_created' and n.recipient_id == owner.id]) == 1
    assert len([n for n in notices if n.event_type == 'mentioned' and n.recipient_id == mentioned.id]) == 1
    assert len([n for n in notices if n.event_type == 'moderation_approved' and n.recipient_id == author.id and n.actor_id is None]) == 1


async def test_comment_approval_notifies_immediate_parent_owner(auth_client, factory, db):
    question_owner = await factory.user()
    answer_owner = await factory.user()
    author = await factory.user()
    question = await factory.question(author=question_owner)
    answer = await factory.answer(question=question, author=answer_owner)
    comment = await factory.comment(author=author, parent_type='answer', parent_id=answer.id, moderation_status='pending')
    caller, _ = await auth_client(role='admin')
    assert (await caller.put(f'/api/moderation/comment/{comment.id}/approve')).status_code == 200
    notices = (await db.scalars(select(Notification).where(Notification.subject_id == comment.id))).all()
    created = [n for n in notices if n.event_type == 'comment_created']
    assert len(created) == 1 and created[0].recipient_id == answer_owner.id
    assert created[0].link == f'/questions/{question.id}'


async def test_rejection_never_releases_owner_or_mentions(auth_client, factory, db):
    owner = await factory.user()
    mentioned = await factory.user(username='never_mentioned')
    root = await factory.question(author=owner)
    answer = await factory.answer(question=root, author=await factory.user(), moderation_status='pending', body='An answer mentioning @never_mentioned which has not been approved.')
    caller, _ = await auth_client(role='admin')
    assert (await caller.put(f'/api/moderation/answer/{answer.id}/reject', json={'note': 'Not relevant'})).status_code == 200
    notices = (await db.scalars(select(Notification).where(Notification.subject_id == answer.id))).all()
    assert [n.event_type for n in notices] == ['moderation_rejected']


async def test_concurrent_approvals_act_only_once(auth_client, factory, db):
    question = await factory.question(author=await factory.user(), moderation_status='pending')
    caller, _ = await auth_client(role='admin')
    path = f'/api/moderation/question/{question.id}/approve'
    responses = await asyncio.gather(caller.put(path), caller.put(path))
    assert sorted(r.status_code for r in responses) == [200, 409]
    notices = (await db.scalars(select(Notification).where(Notification.subject_id == question.id, Notification.event_type == 'moderation_approved'))).all()
    assert len(notices) == 1


async def test_notification_failure_rolls_back_verdict(auth_client, factory, db, monkeypatch):
    question = await factory.question(author=await factory.user(), moderation_status='pending')
    caller, _ = await auth_client(role='admin')
    async def fail(*args, **kwargs):
        raise RuntimeError('Notification staging failed')
    monkeypatch.setattr(notifications, 'emit_content_approved', fail)
    with pytest.raises(RuntimeError, match='Notification staging failed'):
        await caller.put(f'/api/moderation/question/{question.id}/approve')
    await db.refresh(question)
    assert question.moderation_status == 'pending'
    assert not (await db.scalars(select(Notification).where(Notification.subject_id == question.id))).all()

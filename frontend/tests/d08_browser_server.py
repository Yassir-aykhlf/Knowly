import asyncio
import json
import secrets
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import uvicorn
from app.config import settings
from app.db.session import AsyncSessionLocal, engine
from app.models.answer import Answer
from app.models.comment import Comment
from app.models.question import Question
from app.models.session import Session
from app.models.user import User


async def seed():
    assert settings.DATABASE_URL.endswith('/knowly_d08_test')
    assert not settings.LLM_API_KEY
    async with AsyncSessionLocal() as db:
        users=[User(username='d08_admin', email=None, role='admin'), User(username='d08_author', email=None, role='user')]
        db.add_all(users)
        await db.flush()
        tokens=[]
        for user in users:
            raw=secrets.token_urlsafe(32)
            session=Session(user_id=user.id, expires_at=datetime.utcnow()+timedelta(hours=1))
            session.set_token(raw)
            db.add(session)
            tokens.append(raw)
        start=datetime.utcnow()-timedelta(hours=1)
        question=Question(author_id=users[1].id,title='First held question for the moderation screen',body='This question body awaits a decision from the moderation screen.',moderation_status='pending',moderation_note='Question flagged by automated review',created_at=start)
        db.add(question)
        await db.flush()
        answer=Answer(author_id=users[1].id,question_id=question.id,body='This answer is pending and must show its automated explanation.',moderation_status='pending',moderation_note='Answer flagged by automated review',created_at=start+timedelta(seconds=1))
        db.add(answer)
        await db.flush()
        comment=Comment(author_id=users[1].id,parent_type='answer',parent_id=answer.id,body='This comment is awaiting review.',moderation_status='pending',moderation_note='Comment flagged by automated review',created_at=start+timedelta(seconds=2))
        refill=Question(author_id=users[1].id,title='Refill item waiting behind the first page',body='This question should enter the queue after an earlier item is cleared.',moderation_status='pending',moderation_note='Refill item flagged by automated review',created_at=start+timedelta(seconds=3))
        db.add_all([comment,refill])
        await db.commit()
        Path('/tmp/knowly-d08-fixture.json').write_text(json.dumps({'tokens':tokens,'question':str(question.id),'answer':str(answer.id),'comment':str(comment.id),'refill':str(refill.id)}))
    await engine.dispose()


asyncio.run(seed())
uvicorn.run('app.main:app',host='0.0.0.0',port=8000,log_level='warning')

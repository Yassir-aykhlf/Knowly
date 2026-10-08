import asyncio
import json
import secrets
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import uvicorn
from app.config import settings
from app.db.session import AsyncSessionLocal, engine
from app.models.ai import AiConversation
from app.models.question import Question
from app.models.session import Session
from app.models.user import User
from app.services import llm


async def provider(messages):
    if messages[-1].content == 'error':
        raise llm.LLMUnavailable('not exposed to users')
    for token in ['Hello ', '**world**', '\n\n', '```python\n', 'print(1)\n', '```', '\n\n'] + ['More text. ']*20:
        await asyncio.sleep(0.12)
        yield token


async def seed():
    async with AsyncSessionLocal() as db:
        user = User(username='d05_' + uuid.uuid4().hex[:10], email=None)
        db.add(user)
        await db.flush()
        token = secrets.token_urlsafe(32)
        session = Session(user_id=user.id, expires_at=datetime.utcnow() + timedelta(hours=1))
        session.set_token(token)
        question = Question(author_id=user.id, title='D05 browser question', body='This question provides context for the assistant browser checks.')
        db.add_all([session, question])
        await db.flush()
        conversation = AiConversation(user_id=user.id, question_id=question.id, title='Help with: D05 browser question')
        db.add(conversation)
        await db.commit()
        Path('/tmp/knowly-d05-fixture.json').write_text(json.dumps({'token': token, 'conversation': str(conversation.id), 'question': str(question.id)}))
    await engine.dispose()


asyncio.run(seed())
llm.chat_stream = provider
settings.LLM_RATE_LIMIT_PER_HOUR = 100
uvicorn.run('app.main:app', host='0.0.0.0', port=8001, log_level='warning')

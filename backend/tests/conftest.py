"""Knowly executable-spec test harness.

Design notes:

* The app is **async** (SQLAlchemy AsyncSession + asyncpg), and there is no sync
  Postgres driver in the project, so the client is httpx's ``AsyncClient`` driving
  the ASGI app in-process — the async-native equivalent of FastAPI's TestClient.
  Tests are ``async def`` and ``await`` the client; ``asyncio_mode = "auto"``
  (already set in pyproject) means no per-test decorator is needed.

* **Fresh empty database every test.** The real schema (including the
  ``search_vector`` trigger, which lives only in the migration) is built once per
  session by running the real Alembic migrations, then every table is
  ``TRUNCATE … RESTART IDENTITY CASCADE``-d before each test. The app therefore
  runs its *real* commit logic (faithful behavior) and every test starts from a
  clean slate.

* A dedicated **NullPool** engine backs both the request path (via a ``get_db``
  dependency override) and the ``db`` fixture, so no pooled asyncpg connection is
  ever reused across event loops.

Environment: set ``DATABASE_URL`` (asyncpg URL for a disposable test database)
and ``SECRET_KEY`` before running, e.g.::

    DATABASE_URL=postgresql+asyncpg://postgres@127.0.0.1:5433/knowly \
    SECRET_KEY=test pytest tests/lane_b
"""
from __future__ import annotations

import os
import secrets
import subprocess
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest
import pytest_asyncio
from httpx import ASGITransport
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

# A SECRET_KEY is required by config; provide a deterministic default for tests
# so the OAuth-token HMAC and the app import succeed without extra setup.
os.environ.setdefault("SECRET_KEY", "test-secret-key-do-not-use-in-prod")

BACKEND_DIR = Path(__file__).resolve().parents[1]

# Imported after the env defaults above so app.config picks them up.
import app.models  # noqa: E402,F401  (registers every model on Base.metadata)
from app.config import settings  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402  (aliased: `app` is the package)
from app.models.answer import Answer  # noqa: E402
from app.models.ai import AiConversation, AiMessage  # noqa: E402
from app.models.attachment import Attachment  # noqa: E402
from app.models.comment import Comment  # noqa: E402
from app.models.friendship import Friendship  # noqa: E402
from app.models.message import Message  # noqa: E402
from app.models.notification import Notification  # noqa: E402
from app.models.question import Question  # noqa: E402
from app.models.session import Session as UserSession  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.vote import Vote  # noqa: E402
from app.services.security import hash_password  # noqa: E402

# Every data table (alembic_version is intentionally excluded).
_TABLES = (
    "ai_messages",
    "ai_conversations",
    "attachments",
    "notifications",
    "messages",
    "friendships",
    "votes",
    "comments",
    "answers",
    "questions",
    "sessions",
    "users",
)

# One NullPool engine for the whole session: request path + direct DB access.
test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)


async def _get_db_override():
    async with TestSessionLocal() as session:
        yield session


# The app uses the test database for every request.
fastapi_app.dependency_overrides[get_db] = _get_db_override

DEFAULT_PASSWORD = "Passw0rd1"


# ── schema + per-test reset ───────────────────────────────────────────────────


@pytest.fixture(scope="session", autouse=True)
def _apply_migrations():
    """Build the real schema (models + search_vector trigger) once per session."""
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=str(BACKEND_DIR),
        env={**os.environ},
        check=True,
        capture_output=True,
    )
    yield


@pytest_asyncio.fixture(autouse=True)
async def _clean_db():
    """A completely fresh, empty database for every test."""
    async with test_engine.begin() as conn:
        await conn.execute(
            text(f"TRUNCATE {', '.join(_TABLES)} RESTART IDENTITY CASCADE")
        )
    yield


# ── core fixtures ─────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def db():
    """A direct AsyncSession for arranging state and asserting DB side effects.

    Always re-query (``await db.get(...)`` / ``select``) in assertions rather than
    trusting the identity map — the app commits on a *separate* session.
    """
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client():
    """An unauthenticated AsyncClient bound to the ASGI app (one cookie jar)."""
    transport = ASGITransport(app=fastapi_app)
    async with httpx.AsyncClient(
        transport=transport, base_url="https://testserver"
    ) as c:
        yield c


@pytest_asyncio.fixture
async def client_factory():
    """Make additional independent clients (each its own cookie jar / identity)."""
    made: list[httpx.AsyncClient] = []

    async def _make() -> httpx.AsyncClient:
        c = httpx.AsyncClient(
            transport=ASGITransport(app=fastapi_app), base_url="https://testserver"
        )
        made.append(c)
        return c

    yield _make
    for c in made:
        await c.aclose()


# ── data factories (one `factory` object, all async, all commit) ──────────────


class Factory:
    """Insert rows directly. Uses the shared schema only — never another lane's
    HTTP endpoints — so lane tests can arrange state without cross-lane code."""

    def __init__(self, db):
        self.db = db

    async def user(
        self,
        *,
        username: str | None = None,
        email: str | None = "auto",
        password: str | None = DEFAULT_PASSWORD,
        role: str = "user",
        **kw,
    ) -> User:
        uname = username or f"u{uuid.uuid4().hex[:10]}"
        if email == "auto":
            email = f"{uname}@example.com"
        u = User(
            username=uname,
            email=email,
            password_hash=hash_password(password) if password else None,
            role=role,
            **kw,
        )
        self.db.add(u)
        await self.db.commit()
        await self.db.refresh(u)
        return u

    async def session_token(self, user: User) -> str:
        raw = secrets.token_urlsafe(32)
        self.db.add(
            UserSession(
                user_id=user.id,
                token_hash=UserSession.hash_token(raw),
                expires_at=datetime.utcnow() + timedelta(days=14),
            )
        )
        await self.db.commit()
        return raw

    async def question(
        self,
        *,
        author: User,
        title: str = "How do I center a div in modern CSS layouts?",
        body: str = "I have tried several approaches over the years and still get it wrong sometimes.",
        tags: list[str] | None = None,
        moderation_status: str = "approved",
        accepted_answer_id=None,
        **kw,
    ) -> Question:
        q = Question(
            author_id=author.id,
            title=title,
            body=body,
            tags=tags or ["css"],
            moderation_status=moderation_status,
            accepted_answer_id=accepted_answer_id,
            **kw,
        )
        self.db.add(q)
        await self.db.commit()
        await self.db.refresh(q)
        return q

    async def answer(
        self,
        *,
        question: Question,
        author: User,
        body: str = "Use display:flex on the parent and margin:auto on the child. That works well.",
        moderation_status: str = "approved",
        is_ai_assisted: bool = False,
        **kw,
    ) -> Answer:
        a = Answer(
            question_id=question.id,
            author_id=author.id,
            body=body,
            moderation_status=moderation_status,
            is_ai_assisted=is_ai_assisted,
            **kw,
        )
        self.db.add(a)
        await self.db.commit()
        await self.db.refresh(a)
        return a

    async def comment(
        self,
        *,
        author: User,
        parent_type: str,
        parent_id: uuid.UUID,
        body: str = "Nice, thanks for this.",
        moderation_status: str = "approved",
        **kw,
    ) -> Comment:
        c = Comment(
            author_id=author.id,
            parent_type=parent_type,
            parent_id=parent_id,
            body=body,
            moderation_status=moderation_status,
            **kw,
        )
        self.db.add(c)
        await self.db.commit()
        await self.db.refresh(c)
        return c

    async def vote(self, *, voter: User, target_type: str, target_id: uuid.UUID, value: int):
        v = Vote(voter_id=voter.id, target_type=target_type, target_id=target_id, value=value)
        self.db.add(v)
        await self.db.commit()
        return v

    async def friendship(self, *, requester: User, addressee: User, status: str = "pending") -> Friendship:
        f = Friendship(requester_id=requester.id, addressee_id=addressee.id, status=status)
        self.db.add(f)
        await self.db.commit()
        await self.db.refresh(f)
        return f

    async def message(self, *, sender: User, receiver: User, body: str = "hey there", read: bool = False) -> Message:
        m = Message(
            sender_id=sender.id,
            receiver_id=receiver.id,
            body=body,
            read_at=datetime.utcnow() if read else None,
        )
        self.db.add(m)
        await self.db.commit()
        await self.db.refresh(m)
        return m

    async def notification(self, *, recipient: User, event_type: str, actor: User | None = None, link: str = "/home", **kw) -> Notification:
        n = Notification(
            recipient_id=recipient.id,
            actor_id=actor.id if actor else None,
            event_type=event_type,
            link=link,
            **kw,
        )
        self.db.add(n)
        await self.db.commit()
        await self.db.refresh(n)
        return n

    async def ai_conversation(self, *, user: User, question: Question | None = None, title: str | None = "Chat", **kw) -> AiConversation:
        c = AiConversation(
            user_id=user.id,
            question_id=question.id if question else None,
            title=title,
            **kw,
        )
        self.db.add(c)
        await self.db.commit()
        await self.db.refresh(c)
        return c

    async def ai_message(self, *, conversation: AiConversation, role: str, content: str) -> AiMessage:
        m = AiMessage(conversation_id=conversation.id, role=role, content=content)
        self.db.add(m)
        await self.db.commit()
        await self.db.refresh(m)
        return m

    async def attachment(self, *, uploader: User, parent_type=None, parent_id=None, mime_type="image/png", filename="pic.png", stored_path=None, size_bytes=10) -> Attachment:
        a = Attachment(
            uploader_id=uploader.id,
            parent_type=parent_type,
            parent_id=parent_id,
            original_filename=filename,
            stored_path=stored_path or f"/data/uploads/{uuid.uuid4().hex}.png",
            mime_type=mime_type,
            size_bytes=size_bytes,
        )
        self.db.add(a)
        await self.db.commit()
        await self.db.refresh(a)
        return a


@pytest_asyncio.fixture
async def factory(db) -> Factory:
    return Factory(db)


@pytest_asyncio.fixture
async def auth_client(client_factory, factory):
    """Factory → an authenticated client + its user.

    Authentication is a real session row + the ``knowly_session`` cookie (no
    dependency on Lane A's endpoints), so it works against the completed codebase
    and against any lane build with real auth wired in.

        client, user = await auth_client()                 # a fresh 'user'
        admin_c, admin = await auth_client(role="admin")   # an admin
    """

    async def _make(user=None, role: str = "user", **user_kw):
        if user is None:
            user = await factory.user(role=role, **user_kw)
        c = await client_factory()
        raw = await factory.session_token(user)
        c.cookies.set("knowly_session", raw)
        return c, user

    return _make


@pytest_asyncio.fixture
async def alice(auth_client):
    """Convenience: a ready authenticated client + user named to read well."""
    c, user = await auth_client(username="alice")
    return SimpleNamespace(client=c, user=user)


# ── seams that call external providers (monkeypatched so tests are hermetic) ──


@pytest.fixture
def fake_llm(monkeypatch):
    """Replace the LLM stream with deterministic tokens. Returns a controller you
    can reconfigure: ``fake_llm.tokens = [...]`` or ``fake_llm.raise_ = llm.LLMError``."""
    from app.services import llm

    ctl = SimpleNamespace(tokens=["Hello", ", ", "world", "!"], raise_=None, seen=None)

    def _chat_stream(messages):
        ctl.seen = messages

        async def _gen():
            if ctl.raise_ is not None:
                raise ctl.raise_
            for t in ctl.tokens:
                yield t

        return _gen()

    monkeypatch.setattr(llm, "chat_stream", _chat_stream)
    return ctl


@pytest.fixture
def moderation_flags(monkeypatch):
    """Force moderation to flag any text containing the sentinel ``@@FLAG@@``.

    Content without the sentinel is approved (matching the real fail-open default
    when no LLM key is configured), so most tests need no monkeypatch at all.
    """
    from app.services import moderation

    SENTINEL = "@@FLAG@@"

    async def _moderate(text_: str):
        flagged = SENTINEL in text_
        return moderation.ModerationResult(
            flagged=flagged,
            categories={"harassment": 0.99} if flagged else {},
            reason="Flagged by automated moderation: harassment (0.99)" if flagged else None,
        )

    monkeypatch.setattr(moderation, "moderate", _moderate)
    return SimpleNamespace(sentinel=SENTINEL)

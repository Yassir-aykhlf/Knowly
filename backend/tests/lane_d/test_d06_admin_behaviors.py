import os
import subprocess
import sys

import pytest
from sqlalchemy import select
from app.config import settings
from app.main import app
from app.models.user import User
from app.services import admin


@pytest.mark.parametrize('configured,email,expected', [
    ('Boss@Example.com', 'boss@example.COM', True),
    ('boss@example.com', 'BOSS@EXAMPLE.COM', True),
    ('boss@example.com', 'someone@example.com', False),
    ('', '', False),
    ('   ', 'boss@example.com', False),
    (' boss@example.com ', ' boss@example.com ', True),
    ('boss@example.com', None, False),
])
def test_shared_helper(monkeypatch, configured, email, expected):
    monkeypatch.setattr(settings, 'INITIAL_ADMIN_EMAIL', configured)
    assert admin.is_initial_admin(email) is expected


async def test_promotion_is_staged_without_committing(factory, db):
    user = await factory.user(email='BOSS@example.com')
    assert (await admin.promote_to_admin(db, 'boss@EXAMPLE.COM')).id == user.id
    await db.rollback()
    assert (await db.scalar(select(User).where(User.email == 'BOSS@example.com'))).role == 'user'


async def test_startup_promotes_existing_account(factory, db, monkeypatch):
    user = await factory.user(email='boss@example.com')
    other = await factory.user(email='other@example.com')
    monkeypatch.setattr(settings, 'INITIAL_ADMIN_EMAIL', 'BOSS@EXAMPLE.COM')
    async with app.router.lifespan_context(app):
        await db.refresh(user)
        await db.refresh(other)
        assert user.role == 'admin'
        assert other.role == 'user'
    from app.db.session import engine
    await engine.dispose()


async def test_boot_before_registration(client, monkeypatch):
    monkeypatch.setattr(settings, 'INITIAL_ADMIN_EMAIL', 'BOSS@EXAMPLE.COM')
    async with app.router.lifespan_context(app):
        response = await client.post('/api/auth/register', json={
            'email': 'boss@example.com', 'username': 'initial_boss', 'password': 'Passw0rd1',
        })
        assert response.status_code == 201
        assert response.json()['role'] == 'admin'
    from app.db.session import engine
    await engine.dispose()


async def test_missing_initial_account_does_not_promote_other_registrations(client, monkeypatch):
    monkeypatch.setattr(settings, 'INITIAL_ADMIN_EMAIL', 'missing@example.com')
    async with app.router.lifespan_context(app):
        response = await client.post('/api/auth/register', json={
            'email': 'ordinary@example.com', 'username': 'ordinary_user', 'password': 'Passw0rd1',
        })
        assert response.status_code == 201
        assert response.json()['role'] == 'user'
    from app.db.session import engine
    await engine.dispose()


async def test_empty_setting_never_opens_startup_session(monkeypatch):
    import app.main as main
    def forbidden():
        raise AssertionError('Empty admin configuration must not open a session')
    monkeypatch.setattr(settings, 'INITIAL_ADMIN_EMAIL', '   ')
    monkeypatch.setattr(main, 'AsyncSessionLocal', forbidden)
    async with app.router.lifespan_context(app):
        pass


async def test_empty_email_does_not_promote_email_less_user(factory, db):
    user = await factory.user(email=None)
    assert await admin.promote_to_admin(db, '  ') is None
    await db.refresh(user)
    assert user.role == 'user'


async def test_cli_persists_promotion_and_is_idempotent(factory, db):
    user = await factory.user(email='cli@example.com')
    for email in ['CLI@EXAMPLE.COM', 'cli@example.com']:
        process = subprocess.run([sys.executable, '-m', 'app.cli', 'promote-admin', email],
            env=os.environ.copy(), capture_output=True, text=True, timeout=15)
        assert process.returncode == 0, process.stderr
        assert 'admin' in process.stdout
        assert 'Traceback' not in process.stderr
        await db.refresh(user)
        assert user.role == 'admin'


async def test_cli_unknown_email_has_clean_error():
    process = subprocess.run([sys.executable, '-m', 'app.cli', 'promote-admin', 'ghost@example.com'],
        env=os.environ.copy(), capture_output=True, text=True, timeout=15)
    assert process.returncode == 1
    assert 'No such user' in process.stderr
    assert 'Traceback' not in process.stderr

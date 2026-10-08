import asyncio
import io
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import pytest
from fastapi import HTTPException
from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.config import settings
from app.models.attachment import Attachment
from app.models.user import User
from app.schemas.attachment import AttachmentOut
from app.services import files


def image_bytes(format="PNG"):
    buffer = io.BytesIO()
    Image.new("RGB", (10, 10), (20, 100, 50)).save(buffer, format=format)
    return buffer.getvalue()


@pytest.fixture(autouse=True)
def upload_directory(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))


@pytest.mark.parametrize("format,mime", [
    ("PNG", "image/png"), ("JPEG", "image/jpeg"),
    ("WEBP", "image/webp"), ("GIF", "image/gif"),
])
def test_image_allowlist_uses_content(format, mime):
    assert files.detect_mime(image_bytes(format)) == mime


@pytest.mark.parametrize("raw,mime", [
    (b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF", "application/pdf"),
    ("Du texte avec des accents : été.\n".encode(), "text/plain"),
    (b"# Notes\n\nSome **markdown** documentation.\n", "text/plain"),
])
def test_document_allowlist(raw, mime):
    assert files.detect_mime(raw) == mime


@pytest.mark.parametrize("raw", [b"", b"\x00\x01\x02BOGUS", b"\x89PNG\r\n\x1a\n"])
def test_empty_binary_and_truncated_files_rejected(raw):
    with pytest.raises(HTTPException) as failure:
        files.detect_mime(raw)
    assert failure.value.status_code == 400
    assert "file" in failure.value.detail["fields"]


async def test_all_endpoints_require_auth(client):
    id = uuid.uuid4()
    assert (await client.post("/api/files", files={"file": ("a.png", image_bytes())})).status_code == 401
    assert (await client.get(f"/api/files/{id}")).status_code == 401
    assert (await client.delete(f"/api/files/{id}")).status_code == 401


async def test_size_limit_error_and_no_disk_write(alice, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_MAX_BYTES", 10)
    response = await alice.client.post("/api/files", files={"file": ("a.png", image_bytes())})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"
    assert "file" in response.json()["error"]["fields"]
    assert not list(Path(settings.UPLOAD_DIR).iterdir())


@pytest.mark.parametrize("data,status", [
    ({"parent_type": "question"}, 400),
    ({"parent_id": str(uuid.uuid4())}, 400),
    ({"parent_type": "other", "parent_id": str(uuid.uuid4())}, 400),
    ({"parent_type": "question", "parent_id": str(uuid.uuid4())}, 404),
])
async def test_optional_parent_validation(alice, data, status):
    response = await alice.client.post("/api/files", data=data, files={"file": ("a.png", image_bytes())})
    assert response.status_code == status
    assert not list(Path(settings.UPLOAD_DIR).iterdir())


async def test_foreign_parent_is_forbidden(alice, factory):
    question = await factory.question(author=await factory.user())
    response = await alice.client.post("/api/files", data={
        "parent_type": "question", "parent_id": str(question.id),
    }, files={"file": ("a.png", image_bytes())})
    assert response.status_code == 403


@pytest.mark.parametrize("kind", ["question", "answer"])
async def test_bound_file_obeys_parent_visibility(alice, auth_client, factory, db, kind):
    question = await factory.question(author=alice.user)
    parent = question if kind == "question" else await factory.answer(question=question, author=alice.user)
    response = await alice.client.post("/api/files", data={
        "parent_type": kind, "parent_id": str(parent.id),
    }, files={"file": ("diagram.png", image_bytes())})
    assert response.status_code == 201
    assert response.json()["parent_id"] == str(parent.id)
    url = response.json()["url"]
    stranger, _ = await auth_client()
    admin, _ = await auth_client(role="admin")
    assert (await stranger.get(url)).status_code == 200
    question.moderation_status = "pending"
    await db.commit()
    assert (await stranger.get(url)).status_code == 404
    assert (await alice.client.get(url)).status_code == 200
    assert (await admin.get(url)).status_code == 200


async def test_unattached_admin_read_and_delete_restriction(alice, auth_client):
    uploaded = await alice.client.post("/api/files", files={"file": ("a.png", image_bytes())})
    url = uploaded.json()["url"]
    admin, _ = await auth_client(role="admin")
    assert (await admin.get(url)).status_code == 200
    assert (await admin.delete(url)).status_code == 403


async def test_utf8_filename_disposition_and_physical_delete(alice, db):
    response = await alice.client.post("/api/files", files={
        "file": ("résumé.txt", b"Some plain text content here.\n", "text/plain"),
    })
    assert response.status_code == 201
    id = uuid.UUID(response.json()["id"])
    row = await db.get(Attachment, id)
    path = Path(row.stored_path)
    assert path.parent == Path(settings.UPLOAD_DIR)
    uuid.UUID(path.stem)
    read = await alice.client.get(response.json()["url"])
    assert read.status_code == 200
    assert read.headers["content-disposition"].startswith("attachment;")
    assert "filename*=utf-8''r%C3%A9sum%C3%A9.txt" in read.headers["content-disposition"]
    assert read.headers["cache-control"] == "private, no-store"
    assert path.exists()
    assert (await alice.client.delete(response.json()["url"])).status_code == 204
    assert not path.exists()
    assert (await alice.client.get(response.json()["url"])).status_code == 404


async def test_image_served_inline_and_missing_file_is_404(alice, db):
    response = await alice.client.post("/api/files", files={"file": ("a.png", image_bytes())})
    url = response.json()["url"]
    read = await alice.client.get(url)
    assert read.headers["content-disposition"].startswith("inline;")
    assert read.headers["content-type"] == "image/png"
    row = await db.get(Attachment, uuid.UUID(response.json()["id"]))
    Path(row.stored_path).unlink()
    assert (await alice.client.get(url)).status_code == 404


async def test_binding_additive_deduplicated_and_capped(factory, db):
    user = await factory.user()
    question = await factory.question(author=user)
    attachments = [await factory.attachment(uploader=user) for _ in range(11)]
    await files.bind_attachments(db, attachment_ids=[a.id for a in attachments[:10]],
                                 parent_type="question", parent_id=question.id, user=user)
    await files.bind_attachments(db, attachment_ids=[attachments[0].id] * 2,
                                 parent_type="question", parent_id=question.id, user=user)
    await files.bind_attachments(db, attachment_ids=[], parent_type="question", parent_id=question.id, user=user)
    assert len((await files.attachments_for(db, "question", [question.id]))[question.id]) == 10
    with pytest.raises(HTTPException) as failure:
        await files.bind_attachments(db, attachment_ids=[attachments[10].id],
                                     parent_type="question", parent_id=question.id, user=user)
    assert failure.value.status_code == 400
    assert attachments[10].parent_id is None


@pytest.mark.parametrize("case", ["unknown", "foreign", "bound_elsewhere"])
async def test_binding_invalid_batch_does_not_partially_bind(factory, db, case):
    user = await factory.user()
    question = await factory.question(author=user)
    good = await factory.attachment(uploader=user)
    if case == "unknown":
        bad_id = uuid.uuid4()
    elif case == "foreign":
        bad_id = (await factory.attachment(uploader=await factory.user())).id
    else:
        other = await factory.question(author=user)
        bad_id = (await factory.attachment(uploader=user, parent_type="question", parent_id=other.id)).id
    with pytest.raises(HTTPException) as failure:
        await files.bind_attachments(db, attachment_ids=[good.id, bad_id],
                                     parent_type="question", parent_id=question.id, user=user)
    assert failure.value.status_code == 400
    assert good.parent_id is None


async def test_binding_and_deletion_are_staged_and_grouped_oldest_first(factory, db):
    user = await factory.user()
    question = await factory.question(author=user)
    first = await factory.attachment(uploader=user)
    second = await factory.attachment(uploader=user)
    first.created_at = datetime.utcnow() - timedelta(days=1)
    await db.commit()
    ids = [first.id, second.id]
    qid, uid = question.id, user.id
    await files.bind_attachments(db, attachment_ids=ids, parent_type="question", parent_id=qid, user=user)
    grouped = await files.attachments_for(db, "question", [qid])
    assert [a.id for a in grouped[qid]] == ids
    assert all(AttachmentOut.model_validate(a).url == f"/api/files/{a.id}" for a in grouped[qid])
    await db.rollback()
    assert all(row.parent_id is None for row in (await db.scalars(select(Attachment))).all())
    user = await db.get(User, uid)
    await files.bind_attachments(db, attachment_ids=ids, parent_type="question", parent_id=qid, user=user)
    await db.commit()
    paths = await files.delete_attachments_for(db, "question", [qid])
    assert len(paths) == 2
    assert not await files.attachments_for(db, "question", [qid])
    await db.rollback()
    assert len((await files.attachments_for(db, "question", [qid]))[qid]) == 2


def test_delete_file_cannot_remove_outside_upload_directory(tmp_path):
    outside = tmp_path.parent / f"{uuid.uuid4()}.txt"
    outside.write_text("keep")
    try:
        files.delete_file(str(outside))
        assert outside.exists()
    finally:
        outside.unlink()


async def test_upload_commit_failure_removes_written_file(alice, monkeypatch, db):
    from app.db.session import get_db
    from app.main import app
    async def failing_commit():
        raise RuntimeError("commit failed")
    async def override():
        yield db
    original = app.dependency_overrides[get_db]
    app.dependency_overrides[get_db] = override
    monkeypatch.setattr(db, "commit", failing_commit)
    try:
        with pytest.raises(RuntimeError, match="commit failed"):
            await alice.client.post("/api/files", files={"file": ("a.png", image_bytes())})
        assert not list(Path(settings.UPLOAD_DIR).iterdir())
    finally:
        app.dependency_overrides[get_db] = original
        await db.rollback()


async def test_associated_upload_cap_does_not_leave_orphan_file(alice, factory, db):
    question = await factory.question(author=alice.user)
    for _ in range(10):
        await factory.attachment(uploader=alice.user, parent_type="question", parent_id=question.id)
    response = await alice.client.post("/api/files", data={
        "parent_type": "question", "parent_id": str(question.id),
    }, files={"file": ("a.png", image_bytes())})
    assert response.status_code == 400
    assert not list(Path(settings.UPLOAD_DIR).iterdir())
    rows = (await db.scalars(select(Attachment))).all()
    assert len(rows) == 10


async def test_concurrent_binding_cannot_exceed_cap(factory, db):
    user = await factory.user()
    question = await factory.question(author=user)
    for _ in range(9):
        await factory.attachment(uploader=user, parent_type="question", parent_id=question.id)
    first = await factory.attachment(uploader=user)
    second = await factory.attachment(uploader=user)
    ids, qid = [first.id, second.id], question.id
    sessions = async_sessionmaker(db.bind, expire_on_commit=False)
    async def bind(id):
        async with sessions() as session:
            try:
                await files.bind_attachments(session, attachment_ids=[id],
                                             parent_type="question", parent_id=qid, user=user)
                await session.commit()
                return 200
            except HTTPException as error:
                await session.rollback()
                return error.status_code
    assert sorted(await asyncio.gather(*(bind(id) for id in ids))) == [200, 400]
    db.expire_all()
    assert len((await files.attachments_for(db, "question", [qid]))[qid]) == 10


def test_physical_delete_is_best_effort(monkeypatch, caplog):
    path = files.store_file(image_bytes(), "image/png")
    def deny(*args, **kwargs):
        raise PermissionError("blocked")
    with monkeypatch.context() as patch:
        patch.setattr(Path, "unlink", deny)
        files.delete_file(path)
    assert Path(path).exists()
    assert "Could not remove" in caplog.text

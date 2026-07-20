"""Milestone 6 — D-09 file binding replaces B's empty-attachments stub.

FAILS while ``files.bind_attachments`` / ``attachments_for`` are the empty stubs:
a question's ``attachments`` array stays ``[]`` even after a file is attached.
Once files are wired, the uploaded attachment appears in the question detail.
"""
import io

from PIL import Image


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (12, 12), (10, 10, 200)).save(buf, format="PNG")
    return buf.getvalue()


async def test_uploaded_file_binds_and_appears_in_question_detail(auth_client):
    author_c, _ = await auth_client(username="attacher")

    up = await author_c.post("/api/files", files={"file": ("diagram.png", _png(), "image/png")})
    assert up.status_code == 201
    attachment_id = up.json()["id"]

    created = await author_c.post("/api/questions", json={
        "title": "A question that ships with an attached diagram image here",
        "body": "See the attached diagram which explains the whole architecture nicely.",
        "tags": [],
        "attachment_ids": [attachment_id],
    })
    assert created.status_code == 201
    qid = created.json()["id"]

    detail = await author_c.get(f"/api/questions/{qid}")
    attachments = detail.json()["attachments"]
    assert len(attachments) == 1
    assert attachments[0]["id"] == attachment_id
    assert attachments[0]["url"] == f"/api/files/{attachment_id}"

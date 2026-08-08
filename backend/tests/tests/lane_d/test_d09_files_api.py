"""D-09 — Files: upload / serve / delete."""
import io

from PIL import Image


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (10, 10), (0, 128, 0)).save(buf, format="PNG")
    return buf.getvalue()


async def test_upload_returns_authgated_url(alice):
    r = await alice.client.post("/api/files", files={"file": ("pic.png", _png(), "image/png")})
    assert r.status_code == 201
    body = r.json()
    assert body["url"] == f"/api/files/{body['id']}"
    assert body["mime_type"] == "image/png"


async def test_upload_disallowed_type_is_rejected(alice):
    # Content sniffing: raw bytes are not an allowed type regardless of extension.
    r = await alice.client.post("/api/files", files={"file": ("evil.png", b"\x00\x01\x02BOGUS", "image/png")})
    assert r.status_code == 400
    assert "file" in r.json()["error"]["fields"]


async def test_uploader_can_read_unattached_file_but_others_cannot(auth_client):
    alice_c, _ = await auth_client(username="uploader")
    up = await alice_c.post("/api/files", files={"file": ("pic.png", _png(), "image/png")})
    file_id = up.json()["id"]

    mine = await alice_c.get(f"/api/files/{file_id}")
    assert mine.status_code == 200

    bob_c, _ = await auth_client(username="peeker")
    # Unattached files are private to their uploader → 404 (existence not leaked).
    assert (await bob_c.get(f"/api/files/{file_id}")).status_code == 404


async def test_only_uploader_can_delete(auth_client):
    alice_c, _ = await auth_client(username="fileowner")
    up = await alice_c.post("/api/files", files={"file": ("pic.png", _png(), "image/png")})
    file_id = up.json()["id"]

    bob_c, _ = await auth_client(username="notowner_files")
    # 403 (not 404) for a non-uploader delete, per the task.
    assert (await bob_c.delete(f"/api/files/{file_id}")).status_code == 403
    assert (await alice_c.delete(f"/api/files/{file_id}")).status_code == 204

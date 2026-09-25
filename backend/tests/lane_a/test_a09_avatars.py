"""A-09 — Avatars (upload / remove)."""
import io

from PIL import Image


def _png_bytes(size=(300, 300), color=(120, 20, 20)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


async def test_upload_valid_image_sets_avatar_url(alice):
    files = {"file": ("me.png", _png_bytes(), "image/png")}
    r = await alice.client.post("/api/users/me/avatar", files=files)
    assert r.status_code == 200
    url = r.json()["avatar_url"]
    assert url and url.startswith("/avatars/") and url.endswith(".png")


async def test_upload_non_image_is_rejected(alice):
    files = {"file": ("evil.txt", b"i am plain text, not an image", "text/plain")}
    r = await alice.client.post("/api/users/me/avatar", files=files)
    assert r.status_code == 400
    assert "avatar" in r.json()["error"]["fields"]


async def test_delete_avatar_resets_to_default(alice):
    await alice.client.post("/api/users/me/avatar", files={"file": ("me.png", _png_bytes(), "image/png")})
    r = await alice.client.delete("/api/users/me/avatar")
    assert r.status_code == 200
    assert r.json()["avatar_url"] is None

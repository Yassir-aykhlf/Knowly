from __future__ import annotations

import io
import logging
import uuid
from pathlib import Path

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import settings


logger = logging.getLogger("knowly.avatar")


def _validation_error(message: str) -> HTTPException:
    return HTTPException(
        status_code=400,
        detail={
            "code": "validation_error",
            "message": "Invalid avatar",
            "fields": {
                "avatar": message,
            },
        },
    )


def _has_supported_magic(raw: bytes) -> bool:
    # PNG
    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        return True

    # JPEG
    if raw.startswith(b"\xff\xd8\xff"):
        return True

    # WebP = RIFF....WEBP
    if len(raw) >= 12 and raw.startswith(b"RIFF") and raw[8:12] == b"WEBP":
        return True

    return False


def normalize_and_store_avatar(raw: bytes) -> str:
    if not raw:
        raise _validation_error("Avatar file is empty")

    if len(raw) > settings.AVATAR_MAX_BYTES:
        raise _validation_error("Avatar must be 2 MB or smaller")

    if not _has_supported_magic(raw):
        raise _validation_error(
            "Avatar must be a PNG, JPEG, or WebP image"
        )

    try:
        with Image.open(io.BytesIO(raw)) as image:
            if image.format not in {"PNG", "JPEG", "WEBP"}:
                raise _validation_error(
                    "Avatar must be a PNG, JPEG, or WebP image"
                )

            # Force Pillow to actually decode the image.
            image.load()

            normalized = ImageOps.fit(
                image.convert("RGB"),
                (256, 256),
                method=Image.Resampling.LANCZOS,
                centering=(0.5, 0.5),
            )

    except HTTPException:
        raise

    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise _validation_error(
            "Avatar is not a valid image"
        ) from exc

    avatar_dir = Path(settings.AVATAR_DIR)
    avatar_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex}.png"
    destination = avatar_dir / filename

    normalized.save(
        destination,
        format="PNG",
        optimize=True,
    )

    return f"/avatars/{filename}"


def delete_avatar_file(avatar_path: str | None) -> None:
    if not avatar_path:
        return

    filename = Path(avatar_path).name

    if not filename:
        return

    try:
        (Path(settings.AVATAR_DIR) / filename).unlink(
            missing_ok=True
        )
    except OSError:
        # Old-avatar cleanup must never make the request fail.
        logger.warning(
            "Failed to delete avatar file %s",
            avatar_path,
            exc_info=True,
        )
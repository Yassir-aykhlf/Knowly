import io
import logging
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User


logger = logging.getLogger(__name__)

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
JPEG_MAGIC = b"\xff\xd8\xff"


def invalid_avatar(message: str) -> HTTPException:
    return HTTPException(
        status_code=400,
        detail={
            "code": "validation_error",
            "message": "Invalid avatar",
            "fields": {"avatar": message},
        },
    )


def sniff_image(data: bytes) -> str | None:
    if data.startswith(PNG_MAGIC):
        return "PNG"

    if data.startswith(JPEG_MAGIC):
        return "JPEG"

    if (
        len(data) >= 12
        and data[:4] == b"RIFF"
        and data[8:12] == b"WEBP"
    ):
        return "WEBP"

    return None


def normalized_png(raw: bytes) -> bytes:
    expected = sniff_image(raw)

    if expected is None:
        raise invalid_avatar(
            "File must be a PNG, JPEG or WebP image"
        )

    try:
        with Image.open(io.BytesIO(raw)) as img:
            if img.format != expected:
                raise invalid_avatar(
                    "Image format does not match file signature"
                )

            if img.width <= 0 or img.height <= 0:
                raise invalid_avatar("Invalid image dimensions")

            if img.width * img.height > 16_000_000:
                raise invalid_avatar("Image dimensions are too large")

            img.load()

            img = ImageOps.exif_transpose(img)

            img = ImageOps.fit(
                img.convert("RGB"),
                (256, 256),
                method=Image.Resampling.LANCZOS,
            )

            output = io.BytesIO()
            img.save(output, format="PNG")

            return output.getvalue()

    except HTTPException:
        raise

    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        SyntaxError,
        Image.DecompressionBombError,
    ) as exc:
        raise invalid_avatar("Could not decode image") from exc


def avatar_directory() -> Path:
    folder = Path(settings.AVATAR_DIR)
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def safe_remove_avatar(path: str | None) -> None:
    if not path:
        return

    if not path.startswith("/avatars/"):
        logger.warning("Invalid avatar path: %s", path)
        return

    name = path.removeprefix("/avatars/")

    try:
        parsed = uuid.UUID(name.removesuffix(".png"))

        if (
            not name.endswith(".png")
            or parsed.hex + ".png" != name
        ):
            raise ValueError("Invalid filename")

    except ValueError:
        logger.warning("Invalid avatar filename: %s", path)
        return

    try:
        (Path(settings.AVATAR_DIR) / name).unlink(
            missing_ok=True
        )
    except OSError:
        logger.exception(
            "Could not delete avatar: %s",
            path,
        )


async def upload_avatar(
    db: AsyncSession,
    user: User,
    file: UploadFile,
) -> User:

    raw = await file.read(
        settings.AVATAR_MAX_BYTES + 1
    )

    if not raw:
        raise invalid_avatar("Image cannot be empty")

    if len(raw) > settings.AVATAR_MAX_BYTES:
        raise invalid_avatar(
            "Image must be at most 2 MB"
        )

    png = normalized_png(raw)

    folder = avatar_directory()
    filename = uuid.uuid4().hex + ".png"
    destination = folder / filename

    old_path = user.avatar_path

    try:
        with destination.open("xb") as output:
            output.write(png)

        user.avatar_path = f"/avatars/{filename}"

        await db.commit()

    except Exception:
        try:
            await db.rollback()
        finally:
            try:
                destination.unlink(missing_ok=True)
            except OSError:
                logger.exception(
                    "Could not clean up failed upload: %s",
                    destination,
                )
        raise

    safe_remove_avatar(old_path)

    await db.refresh(user)

    return user


async def remove_avatar(
    db: AsyncSession,
    user: User,
) -> User:

    old_path = user.avatar_path

    user.avatar_path = None

    await db.commit()

    safe_remove_avatar(old_path)

    await db.refresh(user)

    return user
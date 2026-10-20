import base64
import hashlib
import hmac
import json
import re
import secrets
import time
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User
from app.services.session import create_session


GOOGLE_STATE_COOKIE = "knowly_google_state"
GOOGLE_LINK_COOKIE = "knowly_google_link"

GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"

STATE_LIFETIME_SECONDS = 600
LINK_LIFETIME_SECONDS = 300


def google_is_configured() -> bool:
    return bool(
        settings.GOOGLE_OAUTH_CLIENT_ID
        and settings.GOOGLE_OAUTH_CLIENT_SECRET
    )


def _encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(
        value + "=" * (-len(value) % 4)
    )


def sign_oauth_cookie(
    purpose: str,
    payload: dict,
    lifetime_seconds: int,
) -> str:
    data = {
        "purpose": purpose,
        "exp": int(time.time()) + lifetime_seconds,
        **payload,
    }

    encoded = _encode(
        json.dumps(
            data,
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
    )

    signature = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        encoded.encode("ascii"),
        hashlib.sha256,
    ).digest()

    return f"{encoded}.{_encode(signature)}"


def verify_oauth_cookie(
    token: str,
    purpose: str,
) -> dict | None:
    try:
        encoded, signature = token.split(".")

        expected_signature = hmac.new(
            settings.SECRET_KEY.encode("utf-8"),
            encoded.encode("ascii"),
            hashlib.sha256,
        ).digest()

        received_signature = _decode(signature)

        if not hmac.compare_digest(
            received_signature,
            expected_signature,
        ):
            return None

        data = json.loads(_decode(encoded))

        if not isinstance(data, dict):
            return None

        if data.get("purpose") != purpose:
            return None

        expiry = data.get("exp")

        if type(expiry) is not int:
            return None

        if time.time() >= expiry:
            return None

        return data

    except (
        ValueError,
        TypeError,
        KeyError,
        UnicodeError,
        json.JSONDecodeError,
    ):
        return None


def create_google_state() -> str:
    return sign_oauth_cookie(
        purpose="google_state",
        payload={"nonce": secrets.token_urlsafe(32)},
        lifetime_seconds=STATE_LIFETIME_SECONDS,
    )


def valid_google_state(
    query_state: str | None,
    cookie_state: str | None,
) -> bool:
    if not query_state or not cookie_state:
        return False

    if not hmac.compare_digest(
        query_state,
        cookie_state,
    ):
        return False

    return verify_oauth_cookie(
        cookie_state,
        "google_state",
    ) is not None


def google_authorization_url(state: str) -> str:
    params = {
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
    }

    return f"{GOOGLE_AUTHORIZE_URL}?{urlencode(params)}"


def create_pending_link_cookie(
    email: str,
    subject: str,
) -> str:
    return sign_oauth_cookie(
        purpose="google_link",
        payload={
            "email": email,
            "sub": subject,
        },
        lifetime_seconds=LINK_LIFETIME_SECONDS,
    )


async def fetch_google_userinfo(code: str) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        token_response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
                "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        token_response.raise_for_status()

        tokens = token_response.json()
        access_token = tokens.get("access_token")

        if not isinstance(access_token, str) or not access_token:
            raise ValueError("Google did not return an access token")

        userinfo_response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={
                "Authorization": f"Bearer {access_token}",
            },
        )
        userinfo_response.raise_for_status()

        userinfo = userinfo_response.json()

        if not isinstance(userinfo, dict):
            raise ValueError("Invalid Google userinfo response")

        return userinfo


def google_identity(userinfo: dict) -> tuple[str, str] | None:
    subject = userinfo.get("sub")
    email = userinfo.get("email")

    if (
        not isinstance(subject, str)
        or not subject
        or not isinstance(email, str)
        or not email
        or userinfo.get("email_verified") is not True
    ):
        return None

    return subject, email.strip().lower()


async def unique_google_username(
    db: AsyncSession,
    email: str,
) -> str:
    local_part = email.split("@", 1)[0]

    base = re.sub(
        r"[^A-Za-z0-9_-]",
        "",
        local_part,
    )[:30]

    if len(base) < 3:
        base = (base + "user")[:3]

    username = base
    suffix = 2

    while True:
        result = await db.execute(
            select(User.id).where(
                User.username == username
            )
        )

        if result.scalar_one_or_none() is None:
            return username

        suffix_text = str(suffix)
        username = (
            base[:30 - len(suffix_text)]
            + suffix_text
        )
        suffix += 1


async def resolve_google_account(
    db: AsyncSession,
    subject: str,
    email: str,
) -> tuple[str, str | None]:
    # Returning Google user: match the stable Google identity,
    # not the email address.
    result = await db.execute(
        select(User).where(
            User.oauth_provider == "google",
            User.oauth_subject == subject,
        )
    )

    user = result.scalar_one_or_none()

    if user is not None:
        if user.is_anonymized:
            return "conflict", None

        token = await create_session(db, user.id)
        await db.commit()

        return "signed_in", token

    # No Google identity matched. Check whether this email
    # already belongs to an existing Knowly account.
    result = await db.execute(
        select(User).where(User.email == email)
    )

    existing_user = result.scalar_one_or_none()

    if existing_user is not None:
        if (
            existing_user.is_anonymized
            or existing_user.password_hash is None
            or existing_user.oauth_provider is not None
            or existing_user.oauth_subject is not None
        ):
            return "conflict", None

        # The owner must prove their password in A-14.
        return "link_required", None

    username = await unique_google_username(db, email)

    role = (
        "admin"
        if (
            settings.INITIAL_ADMIN_EMAIL
            and email.lower()
            == settings.INITIAL_ADMIN_EMAIL.lower()
        )
        else "user"
    )

    user = User(
        username=username,
        email=email,
        password_hash=None,
        oauth_provider="google",
        oauth_subject=subject,
        role=role,
    )

    db.add(user)
    await db.flush()

    token = await create_session(db, user.id)
    await db.commit()

    return "signed_in", token

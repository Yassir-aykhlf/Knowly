from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.auth import GoogleLinkIn, LoginIn, RegisterIn
from app.schemas.user import UserMeOut
from app.services.auth import login_user, logout_user, register_user
from app.services.session import SESSION_COOKIE_NAME, set_session_cookie

import httpx

from fastapi.responses import RedirectResponse

from app.services.oauth import (
    GOOGLE_LINK_COOKIE,
    GOOGLE_STATE_COOKIE,
    LINK_LIFETIME_SECONDS,
    STATE_LIFETIME_SECONDS,
    create_google_state,
    create_pending_link_cookie,
    fetch_google_userinfo,
    google_authorization_url,
    google_identity,
    google_is_configured,
    link_google_account,
    resolve_google_account,
    valid_google_state,
)



router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


@router.post(
    "/register",
    response_model=UserMeOut,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    data: RegisterIn,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserMeOut:
    user, token = await register_user(db, data)

    await db.commit()

    set_session_cookie(response, token)

    return UserMeOut.from_user(user)


@router.post(
    "/login",
    response_model=UserMeOut,
    status_code=status.HTTP_200_OK,
)
async def login(
    data: LoginIn,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserMeOut:
    user, token = await login_user(db, data)

    await db.commit()

    set_session_cookie(response, token)

    return UserMeOut.from_user(user)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> None:
    raw_token = request.cookies.get(SESSION_COOKIE_NAME)

    await logout_user(db, raw_token)

    await db.commit()

    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
    )


def oauth_error_redirect(error: str) -> RedirectResponse:
    response = RedirectResponse(
        url=f"/login?oauth_error={error}",
        status_code=302,
    )

    response.delete_cookie(
        key=GOOGLE_STATE_COOKIE,
        path="/",
    )

    return response


@router.get("/google")
async def google_signin_start() -> RedirectResponse:
    if not google_is_configured():
        return oauth_error_redirect("unconfigured")

    state_token = create_google_state()

    response = RedirectResponse(
        url=google_authorization_url(state_token),
        status_code=302,
    )

    response.set_cookie(
        key=GOOGLE_STATE_COOKIE,
        value=state_token,
        max_age=STATE_LIFETIME_SECONDS,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )

    return response


@router.get("/google/callback")
async def google_signin_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    code = request.query_params.get("code")
    state = request.query_params.get("state")

    cookie_state = request.cookies.get(
        GOOGLE_STATE_COOKIE
    )

    if not code or not valid_google_state(
        state,
        cookie_state,
    ):
        return oauth_error_redirect("state")

    if not google_is_configured():
        return oauth_error_redirect("unconfigured")

    try:
        userinfo = await fetch_google_userinfo(code)

    except (
        httpx.HTTPError,
        ValueError,
        KeyError,
        TypeError,
    ):
        return oauth_error_redirect("provider")

    identity = google_identity(userinfo)

    if identity is None:
        return oauth_error_redirect("unverified")

    subject, email = identity

    result, session_token = await resolve_google_account(
        db=db,
        subject=subject,
        email=email,
    )

    if result == "conflict":
        return oauth_error_redirect("conflict")

    if result == "link_required":
        response = RedirectResponse(
            url="/auth/link",
            status_code=302,
        )

        response.set_cookie(
            key=GOOGLE_LINK_COOKIE,
            value=create_pending_link_cookie(
                email,
                subject,
            ),
            max_age=LINK_LIFETIME_SECONDS,
            httponly=True,
            secure=True,
            samesite="lax",
            path="/",
        )

    else:
        response = RedirectResponse(
            url="/home",
            status_code=302,
        )

        set_session_cookie(
            response,
            session_token,
        )

    response.delete_cookie(
        key=GOOGLE_STATE_COOKIE,
        path="/",
    )

    return response



@router.post(
    "/google/link",
    response_model=UserMeOut,
    status_code=status.HTTP_200_OK,
)
async def google_link(
    data: GoogleLinkIn,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserMeOut:
    user, token = await link_google_account(
        db,
        request.cookies.get(GOOGLE_LINK_COOKIE),
        data.password,
    )

    set_session_cookie(response, token)

    response.delete_cookie(
        key=GOOGLE_LINK_COOKIE,
        path="/",
    )

    return UserMeOut.from_user(user)


@router.delete(
    "/google/link",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def cancel_google_link(
    response: Response,
) -> None:
    response.delete_cookie(
        key=GOOGLE_LINK_COOKIE,
        path="/",
    )

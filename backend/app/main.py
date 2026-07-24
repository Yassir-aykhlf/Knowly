import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.routers import health, users
from app.schemas.common import error_body


logger = logging.getLogger("knowly")

app = FastAPI(
    title="Knowly API",
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_STATUS_CODE_NAMES = {
    400: "validation_error",
    401: "unauthenticated",
    403: "forbidden",
    404: "not_found",
    409: "conflict",
    429: "rate_limited",
    500: "internal_error",
}

def _code_for(status_code: int) -> str:
    return _STATUS_CODE_NAMES.get(status_code, "error")

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail
    fields = None
    if isinstance(detail, dict):
        code = detail.get("code", _code_for(exc.status_code))
        message = detail.get("message", "")
        fields = detail.get("fields")
    elif isinstance(detail, str):
        code = _code_for(exc.status_code)
        message = detail
    else:
        code = _code_for(exc.status_code)
        message = code
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(code, message, fields),
        headers=getattr(exc, "headers", None)
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    fields: dict[str, str] = {}
    for err in exc.errors():
        loc = list(err.get("loc", []))
        if loc and loc[0] in ("body", "query", "path", "header", "cookie"):
            loc = loc[1:]
        key = ".".join(str(p) for p in loc) if loc else "_"
        fields[key] = err.get("msg", "invalid")
    return JSONResponse(
        status_code=400,
        content=error_body("validation_error", "Request validation failed", fields)
    )

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error on {request.method} {request.url.path}")
    return JSONResponse(
        status_code=500,
        content=error_body("internal_error", "Internal server error")
    )

app.include_router(health.router, prefix="/api")
app.include_router(users.router, prefix="/api")
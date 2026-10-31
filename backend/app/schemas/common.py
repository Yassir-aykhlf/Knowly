from datetime import datetime, timezone
from typing import Annotated

from pydantic import AfterValidator, BaseModel


def as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


UtcDateTime = Annotated[datetime, AfterValidator(as_utc)]

EXCERPT_LEN = 240

def excerpt(text: str, max_len: int = EXCERPT_LEN) -> str:
    collapsed = " ".join(text.split())
    if len(collapsed) <= max_len:
        return collapsed
    return collapsed[:max_len - 3].rstrip() + "..."

class ErrorDetail(BaseModel):
    code: str
    message: str
    fields: dict[str, str] | None = None

class ErrorResponse(BaseModel):
    error: ErrorDetail

def error_body(code: str, message: str, fields: dict[str, str] | None = None) -> dict:
    return ErrorResponse(error=ErrorDetail(code=code, message=message, fields=fields)).model_dump(exclude_none=True)
from pydantic import BaseModel

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
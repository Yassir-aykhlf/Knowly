from pydantic import BaseModel

from app.schemas.question import QuestionListItem


class SearchResult(QuestionListItem):
    highlight: str


class SearchPage(BaseModel):
    items: list[SearchResult]
    total: int
    page: int
    limit: int

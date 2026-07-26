from pydantic import BaseModel, field_validator

class VoteIn(BaseModel):
    value: int

    @field_validator("value")
    @classmethod
    def _value(cls, v: int) -> int:
        if v not in (-1, 0, 1):
            raise ValueError("Vote value must be -1, 0, or 1")
        return v

class VoteOut(BaseModel):
    vote_total: int
    my_vote: int
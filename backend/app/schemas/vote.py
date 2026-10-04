from typing import Literal

from pydantic import BaseModel


class VoteIn(BaseModel):
    value: Literal[-1, 0, 1]


class VoteOut(BaseModel):
    vote_total: int
    my_vote:int

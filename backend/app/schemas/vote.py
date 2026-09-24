from pydantic import BaseModel

class VoteOut(BaseModel):
    vote_total: int
    my_vote:int

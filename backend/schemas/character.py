from pydantic import BaseModel
from typing import List, Optional


class CharacterCreate(BaseModel):
    name: str
    gender: Optional[str] = "other"
    description: List[str] = []
    project_id: int


class CharacterResponse(BaseModel):
    id: int
    name: str
    gender: str
    description: List[str]

    class Config:
        from_attributes = True
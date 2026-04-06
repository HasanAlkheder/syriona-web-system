from typing import Optional

from pydantic import BaseModel, Field


class ScriptRowIn(BaseModel):
    source_text: str
    character_name: str
    gender: Optional[str] = Field(
        default=None,
        description="e.g. Male / Female / Erkek / Kadın",
    )
    start_time: Optional[str] = Field(
        default=None,
        description="e.g. subtitle timecode 00:01:44:10",
    )
    end_time: Optional[str] = Field(
        default=None,
        description="e.g. subtitle timecode 00:01:46:00",
    )


class ScriptUploadBody(BaseModel):
    sentences: list[ScriptRowIn]
    add_unknown_characters: bool = False


class SentenceCreate(BaseModel):
    episode_id: int
    character_id: int
    source_text: str


class SentenceResponse(BaseModel):
    id: int
    episode_id: int
    character_id: int
    source_text: str

    class Config:
        from_attributes = True
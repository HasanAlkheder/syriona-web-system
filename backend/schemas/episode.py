from datetime import datetime

from pydantic import BaseModel, Field


class CreateEpisodeRequest(BaseModel):
    project_id: int
    title: str
    episode_number: int
    assigned_to_user_id: int | None = None


class BulkCreateEpisodesRequest(BaseModel):
    project_id: int
    titles: list[str] = Field(
        ...,
        description="One episode title per entry; empty strings are skipped",
    )



class EpisodeResponse(BaseModel):
    id: int
    project_id: int
    title: str
    episode_number: int
    status: str | None = None
    assigned_to_user_id: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True
from pydantic import BaseModel, Field
from typing import Any, List, Optional


class TranslateRequest(BaseModel):
    sentence_id: int
    target_language: str
    model_name: str


class FreeTranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=12000)
    source_language: str = Field(default="Turkish", max_length=120)
    target_language: str = Field(default="Syrian Arabic", max_length=120)


class GlossForReviewRequest(BaseModel):
    """Direct Turkish → MSA line for reviewers to read meaning (not the colloquial dub)."""

    text: str = Field(..., min_length=1, max_length=8000)
    source_language: str = Field(default="Turkish", max_length=120)
    gloss_language: str = Field(
        default="Modern Standard Arabic",
        max_length=120,
        description="Kept for API compatibility; output is always MSA for this route.",
    )


class SentenceInput(BaseModel):
    sentence_id: int
    text: str
    character_name: str
    gender: str


class BatchTranslateRequest(BaseModel):
    sentences: List[SentenceInput]
    target_language: str


class SaveTranslationLine(BaseModel):
    sentence_id: int
    text: str


class SaveEpisodeTranslationsBody(BaseModel):
    lines: List[SaveTranslationLine]


class TranslationJobEnqueueResponse(BaseModel):
    job_id: int
    episode_id: int
    status: str
    total_lines: int


class TranslationJobStatusResponse(BaseModel):
    id: int
    episode_id: int
    status: str
    total_lines: int
    completed_lines: int
    failed_lines: int
    progress_percent: int
    error_message: Optional[str] = None
    errors_sample: List[Any] = Field(default_factory=list)
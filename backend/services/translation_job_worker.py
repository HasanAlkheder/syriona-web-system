"""
Background execution for episode-wide translation jobs.
Processes lines in chunks with per-line savepoints, retries, and DB commits for pollable progress.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from database import SessionLocal
from models.episode import Episode
from models.sentence import Sentence
from models.translation_job import TranslationJob
from services.translation_service import translate_and_save_sentence

log = logging.getLogger(__name__)

CHUNK_SIZE = 25
PAUSE_BETWEEN_CHUNKS_SEC = 0.35
MAX_LINE_ATTEMPTS = 3
LINE_RETRY_BASE_DELAY_SEC = 1.2
ERRORS_SAMPLE_CAP = 80


def _is_rate_limited(exc: BaseException) -> bool:
    msg = str(exc).lower()
    if "rate" in msg and "limit" in msg:
        return True
    if "429" in msg:
        return True
    return type(exc).__name__ in ("RateLimitError", "APIStatusError")


def _translate_line_with_retries(
    db, sentence: Sentence, episode_context_cache: dict, series_excerpt_cache: dict
) -> None:
    last_err: BaseException | None = None
    for attempt in range(MAX_LINE_ATTEMPTS):
        try:
            translate_and_save_sentence(
                db,
                sentence,
                episode_context_cache=episode_context_cache,
                series_excerpt_cache=series_excerpt_cache,
                prefer_bulk_model=True,
            )
            return
        except BaseException as e:
            last_err = e
            if attempt < MAX_LINE_ATTEMPTS - 1:
                delay = LINE_RETRY_BASE_DELAY_SEC * (2**attempt)
                if _is_rate_limited(e):
                    delay = max(delay, 3.0)
                time.sleep(delay)
    if last_err is not None:
        raise last_err


def execute_translation_job(job_id: int) -> None:
    db = SessionLocal()
    job: TranslationJob | None = None
    try:
        job = db.query(TranslationJob).filter(TranslationJob.id == job_id).first()
        if not job:
            log.warning("translation job %s not found", job_id)
            return

        ep = db.query(Episode).filter(Episode.id == job.episode_id).first()
        if not ep:
            job.status = "failed"
            job.error_message = "Episode not found"
            db.commit()
            return

        job.status = "running"
        job.error_message = None
        db.commit()

        sentences = (
            db.query(Sentence)
            .filter(Sentence.episode_id == job.episode_id)
            .order_by(Sentence.id)
            .all()
        )
        job.total_lines = len(sentences)
        job.completed_lines = 0
        job.failed_lines = 0
        job.errors_json = "[]"
        db.commit()

        errors_sample: list[dict[str, Any]] = []
        episode_context_cache: dict = {}
        series_excerpt_cache: dict[int, str] = {}

        for i in range(0, len(sentences), CHUNK_SIZE):
            chunk = sentences[i : i + CHUNK_SIZE]
            for s in chunk:
                try:
                    with db.begin_nested():
                        _translate_line_with_retries(
                            db,
                            s,
                            episode_context_cache,
                            series_excerpt_cache,
                        )
                    job.completed_lines += 1
                except BaseException as e:
                    job.failed_lines += 1
                    if len(errors_sample) < ERRORS_SAMPLE_CAP:
                        errors_sample.append(
                            {
                                "sentence_id": s.id,
                                "error": str(e)[:800],
                            }
                        )
                    log.exception("job %s line %s failed", job_id, s.id)
                job.errors_json = json.dumps(errors_sample)
                db.commit()

            if i + CHUNK_SIZE < len(sentences):
                time.sleep(PAUSE_BETWEEN_CHUNKS_SEC)

        if job.failed_lines and job.completed_lines:
            job.status = "completed_with_errors"
        elif job.failed_lines and not job.completed_lines:
            job.status = "failed"
            job.error_message = "All lines failed; check AI configuration and quotas."
        else:
            job.status = "completed"
        db.commit()
    except BaseException as e:
        log.exception("translation job %s crashed", job_id)
        try:
            if job is None:
                job = (
                    db.query(TranslationJob)
                    .filter(TranslationJob.id == job_id)
                    .first()
                )
            if job:
                job.status = "failed"
                job.error_message = str(e)[:2000]
                db.commit()
        except BaseException:
            db.rollback()
    finally:
        db.close()

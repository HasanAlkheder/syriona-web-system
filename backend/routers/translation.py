from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
import json

from database import SessionLocal
from core.config import OPENAI_TRANSLATION_MODEL
from deps import get_current_user
from models.user import User
from services.org_access import (
    require_episode_in_org,
    require_sentence_in_org,
    require_translation_job_in_org,
)
from services.translation_service import (
    translate_free_text,
    gloss_source_for_review,
    save_translation,
    translate_and_save_sentence,
)
from services.translation_job_worker import execute_translation_job
from schemas.translation import (
    TranslateRequest,
    SaveEpisodeTranslationsBody,
    FreeTranslateRequest,
    GlossForReviewRequest,
    TranslationJobEnqueueResponse,
    TranslationJobStatusResponse,
)
from models.sentence import Sentence
from models.translation_job import TranslationJob
from models.translation import Translation

router = APIRouter(prefix="/translate", tags=["translation"])


# ================= DB =================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ================= FREE TEXT (single-sentence lab) =================


@router.post("/free")
def translate_free(req: FreeTranslateRequest):
    """Translate arbitrary text with GPT — does not read or write the script database."""
    raw = (req.text or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Text is empty")

    try:
        out = translate_free_text(
            raw,
            req.source_language.strip() or "Turkish",
            req.target_language.strip() or "Syrian Arabic",
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Translation service error: {e!s}",
        )

    if not out:
        raise HTTPException(
            status_code=502,
            detail="Model returned an empty translation",
        )

    return {
        "translation": out,
        "model": OPENAI_TRANSLATION_MODEL,
        "source_language": req.source_language,
        "target_language": req.target_language,
    }


@router.post("/gloss")
def gloss_for_review(req: GlossForReviewRequest):
    """Turkish → Modern Standard Arabic, direct translation for meaning check. Does not touch the DB."""
    raw = (req.text or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Text is empty")

    try:
        out = gloss_source_for_review(
            raw,
            req.source_language.strip() or "Turkish",
            (req.gloss_language or "Modern Standard Arabic").strip()
            or "Modern Standard Arabic",
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Gloss service error: {e!s}",
        )

    if not out:
        raise HTTPException(
            status_code=502,
            detail="Model returned an empty translation",
        )

    return {
        "gloss": out,
        "source_language": req.source_language,
        "gloss_language": "Modern Standard Arabic",
    }


# ================= SINGLE TRANSLATION =================

@router.post("/")
def translate(
    req: TranslateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sentence = require_sentence_in_org(db, req.sentence_id, user.organization_id)

    translate_and_save_sentence(
        db,
        sentence,
        (req.target_language or "").strip() or "Syrian Arabic",
    )
    db.commit()

    last_tr = (
        db.query(Translation)
        .filter(Translation.sentence_id == sentence.id)
        .order_by(Translation.version.desc())
        .first()
    )
    translated = last_tr.translated_text if last_tr else ""

    return {
        "sentence_id": req.sentence_id,
        "source": sentence.source_text,
        "translation": translated,
        "model": OPENAI_TRANSLATION_MODEL,
    }


# ================= HELPER =================

def chunk_list(data, size=25):
    for i in range(0, len(data), size):
        yield data[i:i + size]


def _job_status_payload(job: TranslationJob) -> TranslationJobStatusResponse:
    total = job.total_lines or 0
    processed = min(job.completed_lines + job.failed_lines, total) if total else 0
    pct = int(round(100 * processed / total)) if total else 0
    sample = []
    if job.errors_json:
        try:
            sample = json.loads(job.errors_json)
            if not isinstance(sample, list):
                sample = []
        except Exception:
            sample = []
    return TranslationJobStatusResponse(
        id=job.id,
        episode_id=job.episode_id,
        status=job.status,
        total_lines=job.total_lines,
        completed_lines=job.completed_lines,
        failed_lines=job.failed_lines,
        progress_percent=pct,
        error_message=job.error_message,
        errors_sample=sample,
    )


# ================= BACKGROUND BATCH (legacy: many small tasks) =================

def process_chunk(sentence_ids):
    db = SessionLocal()

    sentences = db.query(Sentence).filter(
        Sentence.id.in_(sentence_ids)
    ).all()

    episode_context_cache = {}
    for s in sentences:
        translate_and_save_sentence(
            db,
            s,
            episode_context_cache=episode_context_cache,
            prefer_bulk_model=True,
        )

    db.commit()
    db.close()


# ================= BATCH (BACKGROUND) =================

@router.post("/batch/{episode_id}")
def translate_episode_background(
    episode_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_episode_in_org(db, episode_id, user.organization_id)

    sentences = db.query(Sentence).filter(
        Sentence.episode_id == episode_id
    ).all()

    if not sentences:
        return {"error": "no sentences found"}

    chunks = list(chunk_list(sentences, 25))

    for chunk in chunks:
        ids = [s.id for s in chunk]
        background_tasks.add_task(process_chunk, ids)

    return {
        "status": "started",
        "total_sentences": len(sentences),
        "chunks": len(chunks)
    }


# ================= QUEUED EPISODE JOB (preferred for large episodes) =================


@router.post(
    "/episode/{episode_id}/jobs",
    response_model=TranslationJobEnqueueResponse,
)
def enqueue_episode_translation_job(
    episode_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Start a background translation job for the whole episode.
    Poll GET /translate/jobs/{job_id} for progress. Returns immediately with job_id.
    """
    require_episode_in_org(db, episode_id, user.organization_id)

    sentences = (
        db.query(Sentence).filter(Sentence.episode_id == episode_id).all()
    )
    if not sentences:
        raise HTTPException(status_code=400, detail="No sentences found for this episode")

    active = (
        db.query(TranslationJob)
        .filter(
            TranslationJob.episode_id == episode_id,
            TranslationJob.status.in_(["pending", "running"]),
        )
        .first()
    )
    if active:
        raise HTTPException(
            status_code=409,
            detail=f"A translation job is already in progress (job id {active.id}).",
        )

    job = TranslationJob(
        episode_id=episode_id,
        status="pending",
        total_lines=len(sentences),
        completed_lines=0,
        failed_lines=0,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(execute_translation_job, job.id)

    return TranslationJobEnqueueResponse(
        job_id=job.id,
        episode_id=episode_id,
        status=job.status,
        total_lines=job.total_lines,
    )


@router.get("/jobs/{job_id}", response_model=TranslationJobStatusResponse)
def get_translation_job(
    job_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    job = require_translation_job_in_org(db, job_id, user.organization_id)
    return _job_status_payload(job)


@router.get(
    "/episode/{episode_id}/jobs/latest",
    response_model=TranslationJobStatusResponse,
)
def get_latest_translation_job_for_episode(
    episode_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_episode_in_org(db, episode_id, user.organization_id)
    job = (
        db.query(TranslationJob)
        .filter(TranslationJob.episode_id == episode_id)
        .order_by(TranslationJob.created_at.desc())
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="No jobs for this episode")
    return _job_status_payload(job)


# ================= BATCH (SYNC) =================

@router.post("/episode/{episode_id}")
def translate_episode(episode_id: int, db: Session = Depends(get_db)):

    sentences = db.query(Sentence).filter(
        Sentence.episode_id == episode_id
    ).all()

    if not sentences:
        return {"error": "no sentences found"}

    results = []
    episode_context_cache = {}

    for s in sentences:
        translate_and_save_sentence(
            db,
            s,
            episode_context_cache=episode_context_cache,
            prefer_bulk_model=True,
        )
        # Latest translation text is not returned here; count only.
        results.append(True)

    db.commit()

    return {
        "message": f"{len(sentences)} sentences translated",
        "translations_count": len(results)
    }


@router.post("/save-episode/{episode_id}")
def save_episode_translations(
    episode_id: int,
    body: SaveEpisodeTranslationsBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Persist manual or edited dubbing lines (new translation version each row)."""
    require_episode_in_org(db, episode_id, user.organization_id)
    saved = 0
    for line in body.lines:
        s = (
            db.query(Sentence)
            .filter(
                Sentence.id == line.sentence_id,
                Sentence.episode_id == episode_id,
            )
            .first()
        )
        if not s:
            continue
        save_translation(
            db,
            line.sentence_id,
            (line.text or "").strip(),
            model_name="manual",
        )
        saved += 1
    db.commit()
    return {"saved": saved}

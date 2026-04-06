from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from deps import get_current_user, get_db
from models.character import Character
from models.episode import Episode
from models.project import Project
from models.sentence import Sentence
from models.translation import Translation
from models.user import User
from services.org_access import project_ids_for_org

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

DEFAULT_LLM_MODEL = "gpt-5.4"


def _utc_day_bounds():
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    start_naive = start.replace(tzinfo=None)
    end_naive = end.replace(tzinfo=None)
    return start_naive, end_naive


def _empty_stats():
    return {
        "project_count": 0,
        "episode_count": 0,
        "sentence_count": 0,
        "character_count": 0,
        "translation_row_count": 0,
        "translations_today": 0,
        "dubbed_sentence_count": 0,
        "last_translation_model": DEFAULT_LLM_MODEL,
        "activities": [],
    }


@router.get("/stats")
def dashboard_stats(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pids = project_ids_for_org(db, user.organization_id)
    if not pids:
        return _empty_stats()

    project_count = len(pids)
    episode_count = (
        db.query(Episode).filter(Episode.project_id.in_(pids)).count()
    )
    sentence_count = (
        db.query(Sentence)
        .join(Episode, Sentence.episode_id == Episode.id)
        .filter(Episode.project_id.in_(pids))
        .count()
    )
    character_count = (
        db.query(Character).filter(Character.project_id.in_(pids)).count()
    )
    translation_row_count = (
        db.query(Translation)
        .join(Sentence, Translation.sentence_id == Sentence.id)
        .join(Episode, Sentence.episode_id == Episode.id)
        .filter(Episode.project_id.in_(pids))
        .count()
    )

    start_naive, end_naive = _utc_day_bounds()
    translations_today = (
        db.query(Translation)
        .join(Sentence, Translation.sentence_id == Sentence.id)
        .join(Episode, Sentence.episode_id == Episode.id)
        .filter(Episode.project_id.in_(pids))
        .filter(
            Translation.created_at >= start_naive,
            Translation.created_at < end_naive,
        )
        .count()
    )

    dubbed_sentence_count = (
        db.query(func.count(func.distinct(Translation.sentence_id)))
        .select_from(Translation)
        .join(Sentence, Translation.sentence_id == Sentence.id)
        .join(Episode, Sentence.episode_id == Episode.id)
        .filter(Episode.project_id.in_(pids))
        .filter(Translation.translated_text.isnot(None))
        .filter(Translation.translated_text != "")
        .scalar()
        or 0
    )

    latest_tr = (
        db.query(Translation)
        .join(Sentence, Translation.sentence_id == Sentence.id)
        .join(Episode, Sentence.episode_id == Episode.id)
        .filter(Episode.project_id.in_(pids))
        .order_by(desc(Translation.created_at))
        .first()
    )
    last_model = (
        (latest_tr.model_name or "").strip() or DEFAULT_LLM_MODEL
        if latest_tr
        else DEFAULT_LLM_MODEL
    )

    activities = []

    ep_rows = (
        db.query(Episode, Project.name)
        .join(Project, Episode.project_id == Project.id)
        .filter(Episode.project_id.in_(pids))
        .order_by(desc(Episode.created_at))
        .limit(10)
        .all()
    )
    for ep, proj_name in ep_rows:
        at = ep.created_at
        activities.append(
            {
                "kind": "episode",
                "title": f"Episode “{ep.title}”",
                "detail": proj_name or "Unknown project",
                "at": at.isoformat() if at else None,
            }
        )

    proj_rows = (
        db.query(Project)
        .filter(Project.id.in_(pids))
        .order_by(desc(Project.created_at))
        .limit(6)
        .all()
    )
    for p in proj_rows:
        at = p.created_at
        activities.append(
            {
                "kind": "project",
                "title": f"Project “{p.name or 'Untitled'}” created",
                "detail": None,
                "at": at.isoformat() if at else None,
            }
        )

    activities = [a for a in activities if a.get("at")]
    activities.sort(key=lambda x: x["at"], reverse=True)
    activities = activities[:14]

    return {
        "project_count": project_count,
        "episode_count": episode_count,
        "sentence_count": sentence_count,
        "character_count": character_count,
        "translation_row_count": translation_row_count,
        "translations_today": translations_today,
        "dubbed_sentence_count": int(dubbed_sentence_count),
        "last_translation_model": last_model,
        "activities": activities,
    }

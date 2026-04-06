from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from deps import get_current_user, get_db
from models.episode import Episode
from models.sentence import Sentence
from models.translation import Translation
from models.translation_job import TranslationJob
from models.user import User
from schemas.episode import (
    BulkCreateEpisodesRequest,
    CreateEpisodeRequest,
    EpisodeResponse,
)
from services.org_access import (
    require_episode_in_org,
    require_project_in_org,
    validate_assignee_in_org,
)

router = APIRouter(prefix="/episodes", tags=["episodes"])

# Episodes only: "new" = just created (e.g. bulk add). Rest align with projects.
_ALLOWED_EPISODE_STATUS = frozenset(
    {"new", "not_started", "in_progress", "done", "on_hold"}
)


def _parse_optional_assignee_id(db: Session, org_id: int, raw: Any) -> int | None:
    if raw is None or raw == "":
        return None
    try:
        uid = int(raw)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="assigned_to_user_id must be an integer or null",
        ) from None
    validate_assignee_in_org(db, uid, org_id)
    return uid


def _normalize_episode_status(raw: str | None) -> str:
    if not raw or not isinstance(raw, str):
        return "not_started"
    s = raw.strip().lower().replace("-", "_").replace(" ", "_")
    return s if s in _ALLOWED_EPISODE_STATUS else "not_started"


@router.get("/project/{project_id}", response_model=list[EpisodeResponse])
def get_episodes_by_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_project_in_org(db, project_id, user.organization_id)
    return (
        db.query(Episode)
        .filter(Episode.project_id == project_id)
        .order_by(Episode.episode_number.asc(), Episode.id.asc())
        .all()
    )


@router.patch("/{episode_id}", response_model=EpisodeResponse)
def update_episode(
    episode_id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ep = require_episode_in_org(db, episode_id, user.organization_id)
    if data.get("title") is not None:
        ep.title = data["title"]
    if data.get("episode_number") is not None:
        ep.episode_number = data["episode_number"]
    if "status" in data and data.get("status") is not None:
        ep.status = _normalize_episode_status(data.get("status"))
    ep.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ep)
    return ep


@router.delete("/{episode_id}")
def delete_episode(
    episode_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ep = require_episode_in_org(db, episode_id, user.organization_id)
    db.query(TranslationJob).filter(
        TranslationJob.episode_id == episode_id
    ).delete(synchronize_session=False)
    existing_ids = [
        row[0]
        for row in db.query(Sentence.id)
        .filter(Sentence.episode_id == episode_id)
        .all()
    ]
    if existing_ids:
        db.query(Translation).filter(
            Translation.sentence_id.in_(existing_ids)
        ).delete(synchronize_session=False)
    db.query(Sentence).filter(Sentence.episode_id == episode_id).delete(
        synchronize_session=False
    )
    db.delete(ep)
    db.commit()
    return {"ok": True, "id": episode_id}


@router.post("/", response_model=EpisodeResponse)
def create_episode(
    req: CreateEpisodeRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_project_in_org(db, req.project_id, user.organization_id)
    assignee_id = None
    if req.assigned_to_user_id is not None:
        validate_assignee_in_org(db, req.assigned_to_user_id, user.organization_id)
        assignee_id = req.assigned_to_user_id
    episode = Episode(
        project_id=req.project_id,
        title=req.title,
        episode_number=req.episode_number,
        assigned_to_user_id=assignee_id,
    )
    db.add(episode)
    db.commit()
    db.refresh(episode)
    return episode


@router.post("/bulk", response_model=list[EpisodeResponse])
def create_episodes_bulk(
    req: BulkCreateEpisodesRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create many episodes in order; episode_number continues after the current max."""
    require_project_in_org(db, req.project_id, user.organization_id)
    cleaned: list[str] = []
    for raw in req.titles:
        chunk = (raw or "").replace("\r\n", "\n").replace("\r", "\n")
        for line in chunk.split("\n"):
            t = line.strip()
            if not t:
                continue
            if len(t) > 500:
                raise HTTPException(
                    status_code=400,
                    detail="Each episode title must be 500 characters or less",
                )
            cleaned.append(t)
    if not cleaned:
        raise HTTPException(
            status_code=400,
            detail="At least one non-empty episode title is required",
        )
    if len(cleaned) > 100:
        raise HTTPException(
            status_code=400,
            detail="Maximum 100 episodes per request",
        )

    max_num = (
        db.query(func.max(Episode.episode_number))
        .filter(Episode.project_id == req.project_id)
        .scalar()
    )
    next_num = (max_num or 0) + 1

    created: list[Episode] = []
    for title in cleaned:
        ep = Episode(
            project_id=req.project_id,
            title=title,
            episode_number=next_num,
            status="new",
        )
        next_num += 1
        db.add(ep)
        created.append(ep)
    db.commit()
    for ep in created:
        db.refresh(ep)
    return created

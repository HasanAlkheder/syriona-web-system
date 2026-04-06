from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from typing import Any
from sqlalchemy.orm import Session

from deps import get_current_user, get_db
from models.episode import Episode
from models.character import Character
from models.project import Project
from models.sentence import Sentence
from models.translation import Translation
from models.translation_job import TranslationJob
from models.user import User
from services.org_access import require_project_in_org, validate_assignee_in_org

router = APIRouter(prefix="/projects", tags=["projects"])

_ALLOWED_PROJECT_STATUS = frozenset(
    {"not_started", "in_progress", "done", "on_hold"}
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


def _normalize_project_status(raw: str | None) -> str:
    if not raw or not isinstance(raw, str):
        return "not_started"
    s = raw.strip().lower().replace("-", "_").replace(" ", "_")
    return s if s in _ALLOWED_PROJECT_STATUS else "not_started"


def delete_project_cascade(db: Session, project_id: int) -> None:
    episode_ids = [
        e.id for e in db.query(Episode).filter(Episode.project_id == project_id).all()
    ]
    if episode_ids:
        # Must run before deleting episodes (FK: translation_jobs.episode_id)
        db.query(TranslationJob).filter(
            TranslationJob.episode_id.in_(episode_ids)
        ).delete(synchronize_session=False)
        sentence_ids = [
            s.id
            for s in db.query(Sentence).filter(Sentence.episode_id.in_(episode_ids)).all()
        ]
        if sentence_ids:
            db.query(Translation).filter(Translation.sentence_id.in_(sentence_ids)).delete(
                synchronize_session=False
            )
        db.query(Sentence).filter(Sentence.episode_id.in_(episode_ids)).delete(
            synchronize_session=False
        )
    db.query(Episode).filter(Episode.project_id == project_id).delete(synchronize_session=False)
    db.query(Character).filter(Character.project_id == project_id).delete(
        synchronize_session=False
    )
    db.query(Project).filter(Project.id == project_id).delete(synchronize_session=False)


@router.get("/trash")
def list_trashed_projects(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return (
        db.query(Project)
        .filter(
            Project.tenant_id == user.organization_id,
            Project.deleted_at.isnot(None),
        )
        .order_by(Project.deleted_at.desc())
        .all()
    )


@router.get("/")
def get_projects(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return (
        db.query(Project)
        .filter(
            Project.tenant_id == user.organization_id,
            Project.deleted_at.is_(None),
        )
        .order_by(Project.id.desc())
        .all()
    )


@router.get("/{project_id}")
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return require_project_in_org(db, project_id, user.organization_id)


@router.post("/")
def create_project(
    data: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assignee_id = None
    if "assigned_to_user_id" in data:
        assignee_id = _parse_optional_assignee_id(
            db, user.organization_id, data.get("assigned_to_user_id")
        )
    project = Project(
        name=data.get("name"),
        description=data.get("description") or data.get("notes"),
        source_language=data.get("source_language"),
        target_language=data.get("target_language"),
        category=data.get("category"),
        status=_normalize_project_status(data.get("status")),
        tenant_id=user.organization_id,
        assigned_to_user_id=assignee_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.patch("/{project_id}")
def update_project(
    project_id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = require_project_in_org(db, project_id, user.organization_id)
    if data.get("name") is not None:
        row.name = data.get("name")
    if "description" in data:
        row.description = data.get("description")
    if "category" in data:
        row.category = data.get("category")
    if data.get("source_language") is not None:
        row.source_language = data.get("source_language")
    if data.get("target_language") is not None:
        row.target_language = data.get("target_language")
    if "status" in data and data.get("status") is not None:
        row.status = _normalize_project_status(data.get("status"))
    if "assigned_to_user_id" in data:
        row.assigned_to_user_id = _parse_optional_assignee_id(
            db, user.organization_id, data.get("assigned_to_user_id")
        )
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Move project to trash (soft delete). Episodes and data are kept."""
    row = require_project_in_org(db, project_id, user.organization_id)
    row.deleted_at = datetime.utcnow()
    row.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "id": project_id, "trashed": True}


@router.post("/{project_id}/restore")
def restore_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = require_project_in_org(
        db, project_id, user.organization_id, active_only=False
    )
    if row.deleted_at is None:
        raise HTTPException(status_code=400, detail="Project is not in trash")
    row.deleted_at = None
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{project_id}/permanent")
def purge_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Permanently delete a project that is already in trash."""
    row = require_project_in_org(
        db, project_id, user.organization_id, active_only=False
    )
    if row.deleted_at is None:
        raise HTTPException(
            status_code=400,
            detail="Move the project to trash before permanent delete",
        )
    delete_project_cascade(db, project_id)
    db.commit()
    return {"ok": True, "id": project_id}

"""Verify project / episode / sentence / translation job belong to the user's organization."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.episode import Episode
from models.project import Project
from models.sentence import Sentence
from models.character import Character
from models.translation_job import TranslationJob
from models.user import User


def require_project_in_org(
    db: Session,
    project_id: int,
    org_id: int,
    *,
    active_only: bool = True,
) -> Project:
    q = db.query(Project).filter(
        Project.id == project_id,
        Project.tenant_id == org_id,
    )
    if active_only:
        q = q.filter(Project.deleted_at.is_(None))
    p = q.first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


def require_episode_in_org(db: Session, episode_id: int, org_id: int) -> Episode:
    ep = db.query(Episode).filter(Episode.id == episode_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Episode not found")
    require_project_in_org(db, ep.project_id, org_id)
    return ep


def require_sentence_in_org(db: Session, sentence_id: int, org_id: int) -> Sentence:
    s = db.query(Sentence).filter(Sentence.id == sentence_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Sentence not found")
    require_episode_in_org(db, s.episode_id, org_id)
    return s


def require_translation_job_in_org(
    db: Session, job_id: int, org_id: int
) -> TranslationJob:
    job = db.query(TranslationJob).filter(TranslationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    require_episode_in_org(db, job.episode_id, org_id)
    return job


def project_ids_for_org(db: Session, org_id: int) -> list[int]:
    return [
        r[0]
        for r in db.query(Project.id)
        .filter(Project.tenant_id == org_id, Project.deleted_at.is_(None))
        .all()
    ]


def validate_assignee_in_org(db: Session, assignee_user_id: int, org_id: int) -> None:
    """Ensure user exists, is active, and belongs to the same organization."""
    u = (
        db.query(User)
        .filter(
            User.id == assignee_user_id,
            User.organization_id == org_id,
            User.is_active.is_(True),
        )
        .first()
    )
    if not u:
        raise HTTPException(
            status_code=400,
            detail="Assignee must be an active user in your organization",
        )


def require_character_in_org(db: Session, character_id: int, org_id: int) -> Character:
    c = db.query(Character).filter(Character.id == character_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Character not found")
    require_project_in_org(db, c.project_id, org_id)
    return c

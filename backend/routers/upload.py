from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from deps import get_current_user, get_db
from models.character import Character
from models.sentence import Sentence
from models.translation import Translation
from models.user import User
from schemas.sentence import ScriptUploadBody
from services.org_access import require_episode_in_org

router = APIRouter(prefix="/upload", tags=["upload"])


def _normalize_sheet_gender(raw: str | None) -> str | None:
    if raw is None:
        return None
    g = str(raw).strip().lower()
    if not g:
        return None
    if g in ("male", "m", "man", "erkek", "bay"):
        return "male"
    if g in ("female", "f", "woman", "w", "kadın", "kadin", "bayan", "girl", "kız", "kiz"):
        return "female"
    if g in ("other", "unknown", "?", "-", "—"):
        return "other"
    return "other"


@router.post("/sentences/{episode_id}")
def upload_script_sentences(
    episode_id: int,
    body: ScriptUploadBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    episode = require_episode_in_org(db, episode_id, user.organization_id)
    project_id = episode.project_id
    add_unknown_characters = bool(getattr(body, "add_unknown_characters", False))

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

    created = 0
    for row in body.sentences:
        text = (row.source_text or "").strip()
        if not text:
            continue

        sheet_gender = _normalize_sheet_gender(getattr(row, "gender", None))

        name = (row.character_name or "").strip()
        char = None
        if name:
            char = (
                db.query(Character)
                .filter(
                    Character.project_id == project_id,
                    Character.name == name,
                )
                .first()
            )
            if char is None:
                char = (
                    db.query(Character)
                    .filter(
                        Character.project_id == project_id,
                        func.lower(Character.name) == name.lower(),
                    )
                    .first()
                )
            if char is None and add_unknown_characters:
                # Create missing character so sentences can link to it.
                char = Character(
                    project_id=project_id,
                    name=name,
                    gender=sheet_gender or "other",
                    description=None,
                )
                db.add(char)
                db.flush()  # ensure char.id is available for the Sentence

        sentence_gender = (
            sheet_gender
            if sheet_gender is not None
            else ((char.gender if char else None) or "other")
        )

        st_raw = (row.start_time or "").strip() or None
        et_raw = (row.end_time or "").strip() or None

        sentence = Sentence(
            episode_id=episode_id,
            source_text=text,
            character_id=char.id if char else None,
            character_name=name or None,
            gender=sentence_gender,
            start_time=st_raw,
            end_time=et_raw,
        )
        db.add(sentence)
        created += 1

    db.commit()

    return {
        "message": f"{created} sentences saved",
        "count": created,
    }

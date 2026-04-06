from fastapi import APIRouter, Depends
from sqlalchemy import asc, desc
from sqlalchemy.orm import Session

from deps import get_current_user, get_db
from models.sentence import Sentence
from models.translation import Translation
from models.user import User
from schemas.sentence import SentenceCreate, SentenceResponse
from services.org_access import require_episode_in_org
from services.sentence_service import create_sentence

router = APIRouter(prefix="/sentences", tags=["sentences"])


@router.post("/", response_model=SentenceResponse)
def create_sentence_api(
    sentence: SentenceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_episode_in_org(db, sentence.episode_id, user.organization_id)
    return create_sentence(db, sentence)


@router.get("/episode/{episode_id}")
def get_sentences_with_translation(
    episode_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_episode_in_org(db, episode_id, user.organization_id)
    sentences = (
        db.query(Sentence)
        .filter(Sentence.episode_id == episode_id)
        .order_by(asc(Sentence.id))
        .all()
    )
    results = []
    for s in sentences:
        last_translation = (
            db.query(Translation)
            .filter(Translation.sentence_id == s.id)
            .order_by(desc(Translation.version))
            .first()
        )
        results.append(
            {
                "id": s.id,
                "source_text": s.source_text,
                "character_name": s.character_name,
                "gender": s.gender,
                "start_time": s.start_time,
                "end_time": s.end_time,
                "translation": last_translation.translated_text
                if last_translation
                else None,
            }
        )
    return results


@router.delete("/episode/{episode_id}")
def delete_episode_sentences(
    episode_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_episode_in_org(db, episode_id, user.organization_id)
    sentence_id_subq = db.query(Sentence.id).filter(
        Sentence.episode_id == episode_id
    )
    db.query(Translation).filter(
        Translation.sentence_id.in_(sentence_id_subq)
    ).delete(synchronize_session=False)
    deleted = db.query(Sentence).filter(
        Sentence.episode_id == episode_id
    ).delete(synchronize_session=False)
    db.commit()
    return {"deleted": deleted}

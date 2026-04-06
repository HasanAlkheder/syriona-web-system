from sqlalchemy.orm import Session
from models.sentence import Sentence
from schemas.sentence import SentenceCreate


def create_sentence(db: Session, sentence: SentenceCreate):
    db_sentence = Sentence(
        episode_id=sentence.episode_id,
        character_id=sentence.character_id,
        source_text=sentence.source_text
    )

    db.add(db_sentence)
    db.commit()
    db.refresh(db_sentence)

    return db_sentence
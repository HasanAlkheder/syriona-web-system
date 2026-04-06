from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from datetime import datetime
from database import Base

class Sentence(Base):
    __tablename__ = "sentences"

    id = Column(Integer, primary_key=True, index=True)
    episode_id = Column(Integer, ForeignKey("episodes.id"))

    source_text = Column(String, nullable=False)

    character_id = Column(Integer)
    character_name = Column(String)
    gender = Column(String)

    # Subtitle-style timecodes (e.g. HH:MM:SS:FF) from script import / export
    start_time = Column(String, nullable=True)
    end_time = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
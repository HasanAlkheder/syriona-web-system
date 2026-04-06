from sqlalchemy import Column, Integer, Text, Boolean, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from database import Base


class Translation(Base):
    __tablename__ = "translations"

    id = Column(Integer, primary_key=True, index=True)

    sentence_id = Column(Integer, ForeignKey("sentences.id"))

    translated_text = Column(Text, nullable=False)

    target_language = Column(Text)

    prompt_used = Column(Text)

    model_name = Column(Text)

    version = Column(Integer, default=1)

    is_selected = Column(Boolean, default=False)

    created_at = Column(TIMESTAMP, server_default=func.now())
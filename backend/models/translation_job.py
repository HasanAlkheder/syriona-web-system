from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from database import Base


class TranslationJob(Base):
    __tablename__ = "translation_jobs"

    id = Column(Integer, primary_key=True, index=True)
    episode_id = Column(Integer, ForeignKey("episodes.id"), nullable=False, index=True)

    # pending | running | completed | completed_with_errors | failed | cancelled
    status = Column(String(32), nullable=False, default="pending", index=True)

    total_lines = Column(Integer, nullable=False, default=0)
    completed_lines = Column(Integer, nullable=False, default=0)
    failed_lines = Column(Integer, nullable=False, default=0)

    error_message = Column(Text, nullable=True)
    errors_json = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

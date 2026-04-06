from datetime import datetime

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, text

from database import Base


class Episode(Base):
    __tablename__ = "episodes"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))

    title = Column(String, nullable=False)
    episode_number = Column(Integer)

    # new = freshly added (e.g. bulk); then not_started | in_progress | done | on_hold
    status = Column(String, nullable=False, server_default=text("'not_started'"))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assigned_to_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

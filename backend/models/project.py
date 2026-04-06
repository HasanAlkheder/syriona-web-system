from sqlalchemy import Column, ForeignKey, Integer, Text, TIMESTAMP, text
from sqlalchemy.sql import func
from database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer)
    name = Column(Text)
    description = Column(Text)

    source_language = Column(Text)
    target_language = Column(Text)

    category = Column(Text)   # NEW FIELD

    # Workflow: not_started | in_progress | done | on_hold
    status = Column(Text, nullable=False, server_default=text("'not_started'"))

    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # Soft-delete: NULL = active; set when user moves project to trash
    deleted_at = Column(TIMESTAMP, nullable=True)

    assigned_to_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

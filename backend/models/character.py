from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class Character(Base):
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True, index=True)

    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False) 

    name = Column(String, nullable=False)
    gender = Column(String, default="other")
    description = Column(String)

    # optional (مفيد لاحقًا)
    project = relationship("Project")
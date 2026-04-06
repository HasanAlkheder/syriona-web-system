from sqlalchemy import Column, Integer, Text, TIMESTAMP
from sqlalchemy.sql import func

from database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(Text, nullable=False)
    subscription_plan = Column(Text, nullable=False, default="starter")
    max_seats = Column(Integer, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

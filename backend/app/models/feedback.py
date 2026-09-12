from sqlalchemy import Column, String, DateTime
from datetime import datetime, timezone
from app.database.session import Base


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(String, primary_key=True)
    conversation_id = Column(String)
    message_id = Column(String)
    feedback = Column(String)  # helpful | unhelpful
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

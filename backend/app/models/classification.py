from sqlalchemy import Column, String, DateTime, JSON, Float
from datetime import datetime, timezone
from app.database.session import Base


class ClassificationRecord(Base):
    """Persisted output of the classification engine (Section 5), used for audit."""
    __tablename__ = "classification_records"

    id = Column(String, primary_key=True)
    conversation_id = Column(String, nullable=True)
    query = Column(String)
    category = Column(String)
    confidence = Column(Float)
    reasoning_summary = Column(String)
    needs_clarification = Column(String)  # "true"/"false" (kept as string for sqlite JSON simplicity)
    clarification_questions = Column(JSON, default=list)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

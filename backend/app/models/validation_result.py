from sqlalchemy import Column, String, DateTime, JSON, Boolean
from datetime import datetime, timezone
from app.database.session import Base


class ValidationResultRecord(Base):
    """Citation validation engine output (Section 13), persisted for audit."""
    __tablename__ = "validation_results"

    id = Column(String, primary_key=True)
    conversation_id = Column(String, nullable=True)
    claim = Column(String)
    source = Column(String)
    source_exists = Column(Boolean)
    content_supports_claim = Column(Boolean)
    authority_valid = Column(Boolean)
    validation_status = Column(String)  # verified | failed | unverifiable
    details = Column(JSON, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

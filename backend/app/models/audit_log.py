from sqlalchemy import Column, String, DateTime, JSON
from datetime import datetime, timezone
from app.database.session import Base


class AuditLog(Base):
    """Section 23. One row per pipeline run (query -> ... -> response)."""
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True)
    conversation_id = Column(String, nullable=True)
    query = Column(String)
    classification = Column(JSON, nullable=True)
    jurisdiction = Column(JSON, nullable=True)
    retrieved_sources = Column(JSON, default=list)
    validation_status = Column(String, nullable=True)
    confidence = Column(JSON, nullable=True)
    warnings = Column(JSON, default=list)
    model_info = Column(JSON, nullable=True)
    latency_ms = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

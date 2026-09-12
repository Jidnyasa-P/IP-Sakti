from sqlalchemy import Column, String, DateTime, JSON, Boolean
from datetime import datetime, timezone
from app.database.session import Base


class ExpertEscalation(Base):
    """Section 18. Designed so a real expert-consultation service can later
    subscribe to new rows (e.g. via a queue/webhook) instead of the current
    in-app record-only behaviour."""
    __tablename__ = "expert_escalations"

    id = Column(String, primary_key=True)
    conversation_id = Column(String, nullable=True)
    recommended = Column(Boolean, default=False)
    reason = Column(String)
    case_summary = Column(String)
    status = Column(String, default="pending")  # pending | assigned | resolved
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

from sqlalchemy import Column, String, DateTime, JSON, Boolean
from datetime import datetime, timezone
from app.database.session import Base


class SavedResearch(Base):
    """Workspace: user-bookmarked statutory provisions (Section 6/23)."""
    __tablename__ = "saved_research"

    id = Column(String, primary_key=True)
    user_id = Column(String, default="user-default")
    document_id = Column(String)
    title = Column(String)
    notes = Column(String, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

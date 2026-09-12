from sqlalchemy import Column, String, DateTime, JSON, Integer
from datetime import datetime, timezone
from app.database.session import Base


class UserIngestedDocument(Base):
    """Documents added at runtime via /api/documents/ingest or /api/admin/documents,
    on top of the curated authoritative corpus shipped in backend/data/."""
    __tablename__ = "user_ingested_documents"

    id = Column(String, primary_key=True)
    title = Column(String)
    source = Column(String)
    authority = Column(String)
    url = Column(String, nullable=True)
    document_type = Column(String, default="Guidelines")
    jurisdiction = Column(String, default="India")
    publication_date = Column(String, nullable=True)
    effective_date = Column(String, nullable=True)
    language = Column(String, default="English")
    topic = Column(String, default="AYUSH")
    summary = Column(String, nullable=True)
    status = Column(String, default="Processing")
    chunk_count = Column(Integer, default=0)
    raw_text = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

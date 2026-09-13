"""Documents added at runtime via /api/documents/ingest or /api/admin/documents,
on top of the curated authoritative corpus shipped in backend/data/."""
from datetime import datetime, timezone

COLLECTION = "user_ingested_documents"


def new_user_ingested_document(
    id: str,
    title: str,
    source: str,
    authority: str,
    url: str | None = None,
    document_type: str = "Guidelines",
    jurisdiction: str = "India",
    publication_date: str | None = None,
    effective_date: str | None = None,
    language: str = "English",
    topic: str = "AYUSH",
    summary: str | None = None,
    status: str = "Processing",
    chunk_count: int = 0,
    raw_text: str | None = None,
) -> dict:
    return {
        "_id": id,
        "title": title,
        "source": source,
        "authority": authority,
        "url": url,
        "document_type": document_type,
        "jurisdiction": jurisdiction,
        "publication_date": publication_date,
        "effective_date": effective_date,
        "language": language,
        "topic": topic,
        "summary": summary,
        "status": status,
        "chunk_count": chunk_count,
        "raw_text": raw_text,
        "created_at": datetime.now(timezone.utc),
    }

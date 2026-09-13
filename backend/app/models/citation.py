"""Workspace: user-bookmarked statutory provisions (Section 6/23)."""
from datetime import datetime, timezone

COLLECTION = "saved_research"


def new_saved_research(id: str, user_id: str, document_id: str, title: str, notes: str = "") -> dict:
    return {
        "_id": id,
        "user_id": user_id,
        "document_id": document_id,
        "title": title,
        "notes": notes,
        "created_at": datetime.now(timezone.utc),
    }


def to_dict(doc: dict) -> dict:
    return {
        "id": doc["_id"],
        "user_id": doc.get("user_id"),
        "document_id": doc.get("document_id"),
        "title": doc.get("title"),
        "notes": doc.get("notes", ""),
        "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
    }

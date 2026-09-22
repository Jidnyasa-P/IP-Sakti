"""Persistent user grievances raised from low-confidence chat responses or the Workspace query form."""
from datetime import datetime, timezone

COLLECTION = "grievances"


def new_grievance(
    id: str,
    user_id: str,
    category: str,
    subject: str,
    description: str,
    conversation_id: str | None = None,
    message_id: str | None = None,
    related_query: str | None = None,
) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "_id": id,
        "user_id": user_id,
        "category": category,
        "subject": subject,
        "description": description,
        "conversation_id": conversation_id,
        "message_id": message_id,
        "related_query": related_query,
        "status": "Submitted",
        "created_at": now,
        "updated_at": now,
    }


def to_dict(row: dict) -> dict:
    return {
        "id": str(row["_id"]),
        "user_id": str(row.get("user_id")),
        "category": row.get("category", ""),
        "subject": row.get("subject", ""),
        "description": row.get("description", ""),
        "conversation_id": row.get("conversation_id"),
        "message_id": row.get("message_id"),
        "related_query": row.get("related_query"),
        "status": row.get("status", "Submitted"),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }

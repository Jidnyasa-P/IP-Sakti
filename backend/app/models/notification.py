"""Persistent account-scoped in-app notifications."""
from __future__ import annotations

from datetime import datetime, timezone

COLLECTION = "notifications"


def new_notification(
    *,
    id: str,
    user_id: str,
    type: str,
    title: str,
    message: str,
    data: dict | None = None,
    severity: str = "info",
) -> dict:
    return {
        "_id": id,
        "user_id": user_id,
        "type": type,
        "title": title,
        "message": message,
        "data": data or {},
        "severity": severity,
        "is_read": False,
        "read_at": None,
        "created_at": datetime.now(timezone.utc),
    }


def to_dict(doc: dict) -> dict:
    return {
        "id": str(doc.get("_id")),
        "type": doc.get("type", "info"),
        "title": doc.get("title", "Notification"),
        "message": doc.get("message", ""),
        "data": doc.get("data") or {},
        "severity": doc.get("severity", "info"),
        "is_read": bool(doc.get("is_read", False)),
        "read_at": doc.get("read_at").isoformat() if doc.get("read_at") else None,
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
    }

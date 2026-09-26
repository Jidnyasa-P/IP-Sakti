"""Create persistent, account-scoped in-app notifications."""
from __future__ import annotations

import uuid

from app.models.notification import COLLECTION, new_notification, to_dict


def notify(
    db,
    user_id: str,
    type: str,
    title: str,
    message: str,
    data: dict | None = None,
    severity: str = "info",
) -> dict | None:
    if not user_id:
        return None

    doc = new_notification(
        id=f"notif-{uuid.uuid4().hex[:14]}",
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        data=data,
        severity=severity,
    )
    db[COLLECTION].insert_one(doc)
    return to_dict(doc)

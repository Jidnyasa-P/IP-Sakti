"""Account-scoped notification inbox used by the navbar bell and Workspace."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.notification import COLLECTION, to_dict

router = APIRouter(prefix="/api/notifications")


@router.get("")
def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    query = {"user_id": current_user["id"]}
    if unread_only:
        query["is_read"] = False

    total = db[COLLECTION].count_documents(query)
    unread_count = db[COLLECTION].count_documents(
        {"user_id": current_user["id"], "is_read": False}
    )
    rows = db[COLLECTION].find(query).sort("created_at", -1).skip(skip).limit(limit)

    return {
        "items": [to_dict(row) for row in rows],
        "total": total,
        "unread_count": unread_count,
        "limit": limit,
        "skip": skip,
    }


@router.get("/unread-count")
def unread_count(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    count = db[COLLECTION].count_documents(
        {"user_id": current_user["id"], "is_read": False}
    )
    return {"unread_count": count}


@router.patch("/{notification_id}/read")
def mark_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    row = db[COLLECTION].find_one(
        {"_id": notification_id, "user_id": current_user["id"]}
    )
    if not row:
        raise HTTPException(status_code=404, detail="Notification not found.")

    now = datetime.now(timezone.utc)
    db[COLLECTION].update_one(
        {"_id": notification_id, "user_id": current_user["id"]},
        {"$set": {"is_read": True, "read_at": now}},
    )
    row["is_read"] = True
    row["read_at"] = now
    return to_dict(row)


@router.post("/read-all")
def mark_all_read(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    now = datetime.now(timezone.utc)
    result = db[COLLECTION].update_many(
        {"user_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True, "read_at": now}},
    )
    return {"success": True, "marked_read": result.modified_count}

"""Authenticated expert-routing and expert workspace endpoints."""
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user, require_role
from app.database.session import get_db
from app.models.expert_escalation import COLLECTION
from app.services import email_service, notification_service

router = APIRouter(prefix="/api/expert-escalations")


def _to_dict(doc: dict) -> dict:
    return {
        "id": doc["_id"],
        "conversation_id": doc.get("conversation_id"),
        "user_id": doc.get("user_id"),
        "recommended": doc.get("recommended", False),
        "reason": doc.get("reason"),
        "case_summary": doc.get("case_summary"),
        "query": doc.get("query") or doc.get("case_summary", ""),
        "expert_type": doc.get("expert_type"),
        "status": doc.get("status", "pending"),
        "assigned_expert_id": doc.get("assigned_expert_id"),
        "assigned_expert_name": doc.get("assigned_expert_name"),
        "assigned_expert_email": doc.get("assigned_expert_email"),
        "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
    }


@router.get("")
def list_escalations(status: str | None = None, current_user: dict = Depends(require_role("Expert", "Admin")), db=Depends(get_db)):
    query = {"status": status} if status else {}
    if "Admin" not in current_user.get("roles", []):
        # Experts only see requests explicitly assigned to their own account.
        query["assigned_expert_id"] = current_user["id"]
    rows = db[COLLECTION].find(query).sort("created_at", -1)
    return [_to_dict(r) for r in rows]


@router.get("/mine")
def list_my_escalations(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Return the current user's own expert-guidance requests."""
    rows = db[COLLECTION].find({"user_id": current_user["id"], "expert_type": {"$in": ["ayurveda", "legal", "regulatory"]}}).sort("created_at", -1)
    return [_to_dict(r) for r in rows]


@router.patch("/{escalation_id}")
def update_escalation_status(escalation_id: str, status: str, current_user: dict = Depends(require_role("Expert", "Admin")), db=Depends(get_db)):
    if status not in ("pending", "assigned", "resolved"):
        raise HTTPException(status_code=400, detail="status must be one of: pending, assigned, resolved.")

    doc = db[COLLECTION].find_one({"_id": escalation_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Escalation not found.")

    if "Admin" not in current_user.get("roles", []) and doc.get("assigned_expert_id") != current_user.get("id"):
        raise HTTPException(status_code=403, detail="This escalation is not assigned to you.")

    result = db[COLLECTION].update_one({"_id": escalation_id}, {"$set": {"status": status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Escalation not found.")

    doc = db[COLLECTION].find_one({"_id": escalation_id})
    requester = db["users"].find_one({"_id": doc.get("user_id")})
    if requester:
        email_service.send_escalation_update(requester["email"], requester.get("name", "User"), status)
        notification_service.notify(
            db, requester["_id"], "escalation_update", "Expert guidance updated",
            f"Your expert guidance request is now marked as {status}.",
            data={"escalation_id": escalation_id, "status": status},
            severity="success" if status == "resolved" else "info",
        )
    return _to_dict(doc)

"""
Expert escalation dashboard endpoints (Section 5/12 — Expert role).

Backend capability only: no existing frontend view currently calls these
(there is no ExpertDashboard component in the current frontend — see the
integration report). Added because the task explicitly requires an
Expert-facing escalation workflow at the API layer; wiring a UI for it
would mean adding a new page, which is out of scope for "do not redesign
the frontend." AdminView.tsx's existing calls (/api/admin/documents,
/api/admin/telemetry) are untouched.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import require_role
from app.database.session import get_db
from app.models.expert_escalation import COLLECTION
from app.services import email_service

router = APIRouter(prefix="/api/expert-escalations")


def _to_dict(doc: dict) -> dict:
    return {
        "id": doc["_id"],
        "conversation_id": doc.get("conversation_id"),
        "recommended": doc.get("recommended", False),
        "reason": doc.get("reason"),
        "case_summary": doc.get("case_summary"),
        "expert_type": doc.get("expert_type"),
        "status": doc.get("status", "pending"),
        "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
    }


@router.get("")
def list_escalations(status: str | None = None, current_user: dict = Depends(require_role("Expert", "Admin")), db=Depends(get_db)):
    query = {"status": status} if status else {}
    if "Admin" not in current_user.get("roles", []):
        if not current_user.get("expert_type"):
            return []
        query["expert_type"] = current_user["expert_type"]
    rows = db[COLLECTION].find(query).sort("created_at", -1)
    return [_to_dict(r) for r in rows]


@router.patch("/{escalation_id}")
def update_escalation_status(escalation_id: str, status: str, current_user: dict = Depends(require_role("Expert", "Admin")), db=Depends(get_db)):
    if status not in ("pending", "assigned", "resolved"):
        raise HTTPException(status_code=400, detail="status must be one of: pending, assigned, resolved.")
    result = db[COLLECTION].update_one({"_id": escalation_id}, {"$set": {"status": status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Escalation not found.")
    doc = db[COLLECTION].find_one({"_id": escalation_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Escalation not found.")
    if "Admin" not in current_user.get("roles", []) and doc.get("expert_type") != current_user.get("expert_type"):
        raise HTTPException(status_code=403, detail="This escalation is assigned to another expert type.")
    requester = db["users"].find_one({"_id": doc.get("user_id")})
    if requester:
        email_service.send_escalation_update(requester["email"], requester.get("name", "User"), status)
    return _to_dict(doc)

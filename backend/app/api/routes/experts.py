"""Expert consultation routing and expert-facing escalation endpoints."""
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user, require_role
from app.database.session import get_db
from app.models.expert_escalation import COLLECTION, new_expert_escalation
from app.schemas.chat import ExpertEscalationRequest
from app.services import email_service

router = APIRouter(prefix="/api/expert-escalations")

EXPERT_TYPE_LABELS = {"ayurveda": "Ayurveda Expert", "legal": "Legal / IP Expert", "regulatory": "Regulatory Affairs Expert"}

def _to_dict(doc: dict) -> dict:
    created_at = doc.get("created_at")
    return {
        "id": doc["_id"], "conversation_id": doc.get("conversation_id"), "user_id": doc.get("user_id"),
        "requester_name": doc.get("requester_name"), "requester_email": doc.get("requester_email"),
        "recommended": doc.get("recommended", False), "reason": doc.get("reason"),
        "case_summary": doc.get("case_summary"),
        "query": doc.get("query") or doc.get("case_summary", "").replace("Query: ", "", 1),
        "expert_type": doc.get("expert_type"), "expert_type_label": EXPERT_TYPE_LABELS.get(doc.get("expert_type"), doc.get("expert_type")),
        "assigned_expert_id": doc.get("assigned_expert_id"), "assigned_expert_name": doc.get("assigned_expert_name"),
        "assigned_expert_email": doc.get("assigned_expert_email"), "status": doc.get("status", "pending"),
        "created_at": created_at.isoformat() if created_at else None,
    }

def _find_matching_expert(db, expert_type: str) -> dict | None:
    return db["users"].find_one({"roles": "Expert", "expert_type": expert_type, "email_verified": True}, sort=[("last_login_at", -1), ("created_at", 1)])

@router.post("/request")
def request_expert_escalation(body: ExpertEscalationRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    if body.expert_type not in EXPERT_TYPE_LABELS:
        raise HTTPException(status_code=400, detail="Please select a valid expert type.")
    conversation = db["conversations"].find_one({"$or": [{"_id": body.conversation_id}, {"conversation_id": body.conversation_id}], "user_id": current_user["id"]})
    if not conversation:
        raise HTTPException(status_code=404, detail="The selected chat session could not be found.")
    query = (body.query or "").strip()
    if not query:
        message = db["chat_messages"].find_one({"conversation_id": str(conversation["_id"]), "role": "user"}, sort=[("sequence", -1), ("created_at", -1)])
        query = (message or {}).get("content", "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="The consultation request does not contain a query.")
    expert = _find_matching_expert(db, body.expert_type)
    if not expert:
        raise HTTPException(status_code=409, detail=f"No {EXPERT_TYPE_LABELS[body.expert_type]} is currently available. Please try again later or choose another expert type.")
    existing = db[COLLECTION].find_one({"user_id": current_user["id"], "conversation_id": str(conversation["_id"]), "expert_type": body.expert_type, "status": {"$in": ["pending", "assigned"]}})
    if existing:
        return _to_dict(existing) | {"already_requested": True}
    import uuid
    record = new_expert_escalation(
        id=f"esc-{uuid.uuid4().hex[:10]}", conversation_id=str(conversation["_id"]), recommended=True,
        reason=body.reason.strip() or "Low-confidence AI response", case_summary=f"Query: {query[:200]}",
        expert_type=body.expert_type, user_id=current_user["id"], requester_name=current_user.get("name"),
        requester_email=current_user.get("email"), assigned_expert_id=expert["_id"],
        assigned_expert_name=expert.get("name"), assigned_expert_email=expert.get("email"), status="assigned")
    record["query"] = query
    db[COLLECTION].insert_one(record)
    email_service.send_expert_request_to_user(current_user["email"], current_user.get("name", "User"), EXPERT_TYPE_LABELS[body.expert_type])
    email_service.send_expert_request_to_expert(expert["email"], expert.get("name", "Expert"), current_user.get("name", "User"), EXPERT_TYPE_LABELS[body.expert_type], query)
    return _to_dict(record) | {"already_requested": False}

@router.get("/mine")
def list_my_escalations(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    rows = db[COLLECTION].find({"user_id": current_user["id"]}).sort("created_at", -1)
    return [_to_dict(r) for r in rows]

@router.get("")
def list_escalations(status: str | None = None, current_user: dict = Depends(require_role("Expert", "Admin")), db=Depends(get_db)):
    query = {"status": status} if status else {}
    if "Admin" not in current_user.get("roles", []): query["assigned_expert_id"] = current_user["id"]
    rows = db[COLLECTION].find(query).sort("created_at", -1)
    return [_to_dict(r) for r in rows]

@router.patch("/{escalation_id}")
def update_escalation_status(escalation_id: str, status: str, current_user: dict = Depends(require_role("Expert", "Admin")), db=Depends(get_db)):
    if status not in ("pending", "assigned", "resolved"):
        raise HTTPException(status_code=400, detail="status must be one of: pending, assigned, resolved.")
    doc = db[COLLECTION].find_one({"_id": escalation_id})
    if not doc: raise HTTPException(status_code=404, detail="Escalation not found.")
    if "Admin" not in current_user.get("roles", []) and doc.get("assigned_expert_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="This escalation is assigned to another expert.")
    db[COLLECTION].update_one({"_id": escalation_id}, {"$set": {"status": status}})
    doc = db[COLLECTION].find_one({"_id": escalation_id})
    requester = db["users"].find_one({"_id": doc.get("user_id")})
    if requester: email_service.send_escalation_update(requester["email"], requester.get("name", "User"), status)
    return _to_dict(doc)

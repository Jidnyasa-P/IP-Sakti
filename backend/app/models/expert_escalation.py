"""Section 18. Designed so a real expert-consultation service can later
subscribe to new documents (e.g. via a change-stream/webhook) instead of the
current record-only behaviour."""
from datetime import datetime, timezone

COLLECTION = "expert_escalations"


def new_expert_escalation(
    id: str,
    reason: str,
    case_summary: str,
    conversation_id: str | None = None,
    recommended: bool = False,
    status: str = "pending",
    expert_type: str | None = None,
    user_id: str | None = None,
) -> dict:
    return {
        "_id": id,
        "conversation_id": conversation_id,
        "user_id": user_id,
        "recommended": recommended,
        "reason": reason,
        "case_summary": case_summary,
        "expert_type": expert_type,  # e.g. "ayurveda" | "legal" | "ip_patent"
        "status": status,  # pending | assigned | resolved
        "created_at": datetime.now(timezone.utc),
    }

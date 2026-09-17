from datetime import datetime, timezone

COLLECTION = "feedback"


def new_feedback(id: str, conversation_id: str, message_id: str, feedback: str, notes: str | None = None) -> dict:
    return {
        "_id": id,
        "conversation_id": conversation_id,
        "message_id": message_id,
        "feedback": feedback,  # helpful | unhelpful
        "notes": notes,
        "created_at": datetime.now(timezone.utc),
    }

"""Conversation / chat-message documents (conversations, chat_messages
collections). Kept as two collections (rather than embedding messages inside
the conversation document) because messages are appended one at a time under
concurrent requests and are also queried/paginated independently — two
narrow, indexed collections avoid growing a single document unboundedly and
avoid whole-document rewrites on every new message."""
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId

CONVERSATIONS_COLLECTION = "conversations"
CHAT_MESSAGES_COLLECTION = "chat_messages"


def new_conversation(id: str, user_id: str, title: str, language: str = "en") -> dict:
    now = datetime.now(timezone.utc)
    return {
        "_id": id,
        # Keep an explicit conversation_id field for compatibility with the
        # existing MongoDB unique index (conversation_id_1).
        # The application still uses _id as the canonical conversation key.
        "conversation_id": id,
        "user_id": user_id,
        "title": title,
        "language": language,
        "created_at": now,
        "updated_at": now,
        # Monotonic per-conversation message counter (Section: chatbot
        # message order). created_at alone can collide at millisecond/
        # microsecond resolution under rapid user->assistant inserts within
        # a single request; `sequence` (see new_chat_message /
        # conversation_service.add_message, which increments this
        # atomically via $inc) gives a deterministic, gap-tolerant
        # oldest -> newest ordering that never depends on clock resolution.
        "message_seq": 0,
    }


def new_chat_message(
    id: str,
    conversation_id: str,
    role: str,
    content: str,
    answer: str | None = None,
    relevant_considerations: list | None = None,
    recommended_next_steps: list | None = None,
    citations: list | None = None,
    confidence: dict | None = None,
    warnings: list | None = None,
    classification: dict | None = None,
    jurisdiction: dict | None = None,
    expert_escalation: dict | None = None,
    feedback: str | None = None,
    feedback_notes: str | None = None,
    language: str = "en",
    scope_blocked: bool = False,
    sequence: int = 0,
) -> dict:
    return {
        "_id": id,
        "conversation_id": conversation_id,
        "sequence": sequence,  # monotonic, atomically-assigned — see conversation_service.add_message
        "role": role,  # user | assistant
        "content": content,
        "answer": answer,
        "relevant_considerations": relevant_considerations or [],
        "recommended_next_steps": recommended_next_steps or [],
        "citations": citations or [],
        "confidence": confidence,
        "warnings": warnings or [],
        "classification": classification,
        "jurisdiction": jurisdiction,
        "expert_escalation": expert_escalation,
        "feedback": feedback,
        "feedback_notes": feedback_notes,
        "language": language,
        "scope_blocked": scope_blocked,
        "created_at": datetime.now(timezone.utc),
    }


def _json_safe(value: Any) -> Any:
    """Convert legacy MongoDB ObjectId values to JSON-safe strings.

    Older conversation records may contain ObjectId values even though the
    current application uses string IDs. Keep the API backward-compatible
    without changing the stored MongoDB documents.
    """
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [_json_safe(item) for item in value]
    return value


def conversation_to_dict(conv: dict, messages: list[dict]) -> dict:
    return {
        "id": _json_safe(conv["_id"]),
        "user_id": _json_safe(conv.get("user_id")),
        "title": conv.get("title"),
        "language": conv.get("language"),
        "created_at": conv["created_at"].isoformat() if conv.get("created_at") else None,
        "updated_at": conv["updated_at"].isoformat() if conv.get("updated_at") else None,
        "messages": [message_to_dict(m) for m in messages],
    }


def message_to_dict(m: dict) -> dict:
    return {
        "id": _json_safe(m["_id"]),
        "conversation_id": _json_safe(m.get("conversation_id")),
        "sequence": m.get("sequence", 0),
        "role": m.get("role"),
        "content": m.get("content"),
        "answer": m.get("answer"),
        "relevant_considerations": _json_safe(m.get("relevant_considerations")) or [],
        "recommended_next_steps": _json_safe(m.get("recommended_next_steps")) or [],
        "citations": _json_safe(m.get("citations")) or [],
        "confidence": _json_safe(m.get("confidence")),
        "warnings": _json_safe(m.get("warnings")) or [],
        "classification": _json_safe(m.get("classification")),
        "jurisdiction": _json_safe(m.get("jurisdiction")),
        "expert_escalation": _json_safe(m.get("expert_escalation")),
        "created_at": m["created_at"].isoformat() if m.get("created_at") else None,
        "feedback": m.get("feedback"),
        "feedback_notes": m.get("feedback_notes"),
        "language": m.get("language"),
        "scope_blocked": bool(m.get("scope_blocked")),
    }

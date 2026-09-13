"""Conversation / chat-message documents (conversations, chat_messages
collections). Kept as two collections (rather than embedding messages inside
the conversation document) because messages are appended one at a time under
concurrent requests and are also queried/paginated independently — two
narrow, indexed collections avoid growing a single document unboundedly and
avoid whole-document rewrites on every new message."""
from datetime import datetime, timezone

CONVERSATIONS_COLLECTION = "conversations"
CHAT_MESSAGES_COLLECTION = "chat_messages"


def new_conversation(id: str, user_id: str, title: str, language: str = "en") -> dict:
    now = datetime.now(timezone.utc)
    return {
        "_id": id,
        "user_id": user_id,
        "title": title,
        "language": language,
        "created_at": now,
        "updated_at": now,
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
) -> dict:
    return {
        "_id": id,
        "conversation_id": conversation_id,
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
        "created_at": datetime.now(timezone.utc),
    }


def conversation_to_dict(conv: dict, messages: list[dict]) -> dict:
    return {
        "id": conv["_id"],
        "user_id": conv.get("user_id"),
        "title": conv.get("title"),
        "language": conv.get("language"),
        "created_at": conv["created_at"].isoformat() if conv.get("created_at") else None,
        "updated_at": conv["updated_at"].isoformat() if conv.get("updated_at") else None,
        "messages": [message_to_dict(m) for m in messages],
    }


def message_to_dict(m: dict) -> dict:
    return {
        "id": m["_id"],
        "conversation_id": m.get("conversation_id"),
        "role": m.get("role"),
        "content": m.get("content"),
        "answer": m.get("answer"),
        "relevant_considerations": m.get("relevant_considerations") or [],
        "recommended_next_steps": m.get("recommended_next_steps") or [],
        "citations": m.get("citations") or [],
        "confidence": m.get("confidence"),
        "warnings": m.get("warnings") or [],
        "classification": m.get("classification"),
        "jurisdiction": m.get("jurisdiction"),
        "expert_escalation": m.get("expert_escalation"),
        "created_at": m["created_at"].isoformat() if m.get("created_at") else None,
        "feedback": m.get("feedback"),
        "feedback_notes": m.get("feedback_notes"),
        "language": m.get("language"),
    }

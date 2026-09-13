"""
Conversation / session management (Section 7).

Follow-up queries within the same conversation_id may use prior context
(handled by the caller passing recent messages into the reasoning step), but
context is scoped strictly to that conversation_id — a different
conversation's history is never mixed in.
"""
import uuid
from datetime import datetime, timezone

from app.models.conversation import (
    CONVERSATIONS_COLLECTION,
    CHAT_MESSAGES_COLLECTION,
    new_conversation,
    new_chat_message,
    conversation_to_dict,
    message_to_dict,
)


def get_or_create_conversation(db, conversation_id: str | None, title_hint: str, language: str, user_id: str) -> dict:
    if conversation_id:
        conv = db[CONVERSATIONS_COLLECTION].find_one({"_id": conversation_id})
        if conv:
            return conv
    new_id = conversation_id or f"conv-{uuid.uuid4().hex[:12]}"
    conv = new_conversation(
        id=new_id,
        user_id=user_id,
        title=(title_hint[:48] + "...") if len(title_hint) > 50 else title_hint,
        language=language,
    )
    db[CONVERSATIONS_COLLECTION].insert_one(conv)
    return conv


def recent_messages(db, conversation_id: str, limit: int = 6) -> list[dict]:
    cursor = (
        db[CHAT_MESSAGES_COLLECTION]
        .find({"conversation_id": conversation_id})
        .sort("created_at", -1)
        .limit(limit)
    )
    return list(cursor)[::-1]


def add_message(db, **kwargs) -> dict:
    msg = new_chat_message(id=f"msg-{uuid.uuid4().hex[:12]}", **kwargs)
    db[CHAT_MESSAGES_COLLECTION].insert_one(msg)
    return msg


def touch_conversation(db, conversation: dict) -> None:
    now = datetime.now(timezone.utc)
    db[CONVERSATIONS_COLLECTION].update_one({"_id": conversation["_id"]}, {"$set": {"updated_at": now}})
    conversation["updated_at"] = now


# Re-exported for routes that build response payloads.
__all__ = [
    "get_or_create_conversation",
    "recent_messages",
    "add_message",
    "touch_conversation",
    "conversation_to_dict",
    "message_to_dict",
]

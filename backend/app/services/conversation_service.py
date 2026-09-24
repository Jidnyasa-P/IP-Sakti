"""
Conversation / session management (Section 7).

Follow-up queries within the same conversation_id may use prior context
(handled by the caller passing recent messages into the reasoning step), but
context is scoped strictly to that conversation_id — a different
conversation's history is never mixed in.
"""
import uuid
from datetime import datetime, timezone

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from bson import ObjectId

from app.models.conversation import (
    CONVERSATIONS_COLLECTION,
    CHAT_MESSAGES_COLLECTION,
    new_conversation,
    new_chat_message,
    conversation_to_dict,
    message_to_dict,
)




class ConversationDeletedError(RuntimeError):
    """Raised when a conversation was permanently deleted by the user."""


def new_conversation_id() -> str:
    """Generate an id in the same format get_or_create_conversation() would
    fall back to, without writing anything to the database. Lets a caller
    (see chat.py's _handle_query) settle on the id to pass to the RAG
    service *before* deciding whether/when to persist the conversation."""
    return f"conv-{uuid.uuid4().hex[:12]}"


def get_or_create_conversation(db, conversation_id: str | None, title_hint: str, language: str, user_id: str) -> dict:
    collection = db[CONVERSATIONS_COLLECTION]

    # The application uses `_id` as the canonical conversation key, while
    # older deployments also have a unique `conversation_id_1` index. Check
    # both fields so a legacy record is reused instead of being inserted
    # again. This also prevents duplicate records when two requests for the
    # same chat arrive at nearly the same time.
    if conversation_id:
        conversation_id = str(conversation_id)
        if db["deleted_conversations"].find_one({"conversation_id": conversation_id, "user_id": user_id}):
            raise ConversationDeletedError(conversation_id)
        candidates = [conversation_id]
        try:
            candidates.append(ObjectId(conversation_id))
        except Exception:
            pass
        conv = collection.find_one({
            "$and": [
                {"user_id": user_id},
                {
                    "$or": [
                        *[{"_id": candidate} for candidate in candidates],
                        *[{"conversation_id": candidate} for candidate in candidates],
                    ]
                },
            ]
        })
        if conv:
            return conv

    new_id = str(conversation_id) if conversation_id else new_conversation_id()
    conv = new_conversation(
        id=new_id,
        user_id=user_id,
        title=(title_hint[:48] + "...") if len(title_hint) > 50 else title_hint,
        language=language,
    )

    try:
        collection.insert_one(conv)
    except DuplicateKeyError:
        # Two requests can both observe that the conversation does not exist
        # before either insert completes. If the unique legacy
        # `conversation_id_1` index wins that race, reuse the record that was
        # inserted by the other request rather than returning HTTP 500.
        existing = collection.find_one({
            "$and": [
                {"user_id": user_id},
                {
                    "$or": [
                        {"_id": new_id},
                        {"conversation_id": new_id},
                    ]
                },
            ]
        })
        if existing:
            return existing
        raise

    if db["deleted_conversations"].find_one({"conversation_id": new_id, "user_id": user_id}):
        collection.delete_one({"_id": new_id})
        raise ConversationDeletedError(new_id)

    return conv


def recent_messages(db, conversation_id: str, limit: int = 6) -> list[dict]:
    """Returns up to `limit` most-recent messages for a conversation, in
    deterministic chronological (oldest -> newest) order — the order the
    frontend renders a conversation in (user query, then its assistant
    answer, then the next user query, ...).

    Sorts primarily by the atomically-assigned `sequence` (see
    add_message), falling back to `created_at` only for any legacy message
    documents written before `sequence` existed."""
    conversation_id = str(conversation_id)
    candidates = [conversation_id]
    try:
        candidates.append(ObjectId(conversation_id))
    except Exception:
        pass
    cursor = (
        db[CHAT_MESSAGES_COLLECTION]
        .find({"conversation_id": {"$in": candidates}})
        .sort([("sequence", -1), ("created_at", -1)])
        .limit(limit)
    )
    return list(cursor)[::-1]


def add_message(db, conversation_id: str, **kwargs) -> dict:
    requested_id = str(conversation_id)
    if db["deleted_conversations"].find_one({"conversation_id": requested_id}):
        raise ConversationDeletedError(requested_id)

    candidates = [requested_id]
    try:
        candidates.append(ObjectId(requested_id))
    except Exception:
        pass

    # Resolve current string IDs and legacy ObjectId IDs to the actual
    # conversation document before incrementing its message sequence.
    existing = db[CONVERSATIONS_COLLECTION].find_one({"_id": {"$in": candidates}})
    if not existing:
        raise ConversationDeletedError(requested_id)

    canonical_id = str(existing["_id"])
    if db["deleted_conversations"].find_one({"conversation_id": canonical_id}):
        raise ConversationDeletedError(canonical_id)

    updated_conv = db[CONVERSATIONS_COLLECTION].find_one_and_update(
        {"_id": existing["_id"]},
        {"$inc": {"message_seq": 1}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated_conv:
        raise ConversationDeletedError(canonical_id)

    sequence = updated_conv["message_seq"]
    if db["deleted_conversations"].find_one({"conversation_id": canonical_id}):
        raise ConversationDeletedError(canonical_id)

    msg = new_chat_message(
        id=f"msg-{uuid.uuid4().hex[:12]}",
        conversation_id=canonical_id,
        sequence=sequence,
        **kwargs,
    )
    db[CHAT_MESSAGES_COLLECTION].insert_one(msg)

    if db["deleted_conversations"].find_one({"conversation_id": canonical_id}):
        db[CHAT_MESSAGES_COLLECTION].delete_one({"_id": msg["_id"]})
        raise ConversationDeletedError(canonical_id)

    return msg


def touch_conversation(db, conversation: dict) -> None:
    now = datetime.now(timezone.utc)
    db[CONVERSATIONS_COLLECTION].update_one(
        {"_id": conversation["_id"]},
        {"$set": {"updated_at": now}},
    )
    conversation["updated_at"] = now


# Re-exported for routes that build response payloads.
__all__ = [
    "new_conversation_id",
    "ConversationDeletedError",
    "get_or_create_conversation",
    "recent_messages",
    "add_message",
    "touch_conversation",
    "conversation_to_dict",
    "message_to_dict",
]

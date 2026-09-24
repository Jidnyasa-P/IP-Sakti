"""MongoDB persistence for conversations, feedback and audit-style events."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pymongo import ASCENDING, MongoClient
from pymongo.errors import DuplicateKeyError

from app.config import settings

_client: MongoClient | None = None
_db = None


def _db_handle():
    global _client, _db
    if not settings.mongodb_uri:
        return None
    if _db is None:
        _client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=3000)
        _client.admin.command("ping")
        _db = _client[settings.mongodb_db_name]
        existing_indexes = {idx["name"] for idx in _db.conversations.list_indexes()}
        if "conversation_id_1" not in existing_indexes:
            _db.conversations.create_index([("conversation_id", ASCENDING)], unique=True)

        existing_indexes = {idx["name"] for idx in _db.chat_messages.list_indexes()}
        if "conversation_id_1_created_at_1" not in existing_indexes:
            _db.chat_messages.create_index([("conversation_id", ASCENDING), ("created_at", ASCENDING)])

        existing_indexes = {idx["name"] for idx in _db.feedback.list_indexes()}
        if "conversation_id_1_created_at_1" not in existing_indexes:
            _db.feedback.create_index([("conversation_id", ASCENDING), ("created_at", ASCENDING)])

        existing_indexes = {idx["name"] for idx in _db.deleted_conversations.list_indexes()}
        if "conversation_id_1" not in existing_indexes:
            _db.deleted_conversations.create_index([("conversation_id", ASCENDING)], unique=True)
    return _db


def save_chat(conversation_id: str, query: str, response: dict[str, Any]) -> None:
    try:
        db = _db_handle()
        if db is None:
            return
        now = datetime.now(timezone.utc)
        if db.deleted_conversations.find_one({"conversation_id": conversation_id}):
            return
        db.conversations.update_one(
            {"conversation_id": conversation_id},
            {"$set": {"updated_at": now}, "$setOnInsert": {"conversation_id": conversation_id, "created_at": now}},
            upsert=True,
        )
        db.chat_messages.insert_one({
            "conversation_id": conversation_id,
            "role": "user",
            "content": query,
            "created_at": now,
        })
        db.chat_messages.insert_one({
            "conversation_id": conversation_id,
            "role": "assistant",
            "content": response.get("answer", ""),
            "response": response,
            "created_at": datetime.now(timezone.utc),
        })
        # A delete can race the write above. If the deletion tombstone now
        # exists, remove every RAG-side record for this conversation so a
        # stale/in-flight request cannot resurrect it.
        if db.deleted_conversations.find_one({"conversation_id": conversation_id}):
            db.conversations.delete_many({"conversation_id": conversation_id})
            db.chat_messages.delete_many({"conversation_id": conversation_id})
            db.feedback.delete_many({"conversation_id": conversation_id})
    except Exception:
        # Persistence must never make a grounded answer unavailable.
        return


def delete_conversation(conversation_id: str) -> None:
    """Permanently remove a chat from RAG persistence and tombstone its id."""
    try:
        db = _db_handle()
        if db is None:
            return
        now = datetime.now(timezone.utc)
        try:
            db.deleted_conversations.update_one(
                {"conversation_id": conversation_id},
                {
                    "$set": {"deleted_at": now},
                    "$setOnInsert": {"conversation_id": conversation_id},
                },
                upsert=True,
            )
        except DuplicateKeyError:
            # Concurrent duplicate delete: the other request already created
            # the tombstone, so treat this delete as successful.
            db.deleted_conversations.update_one(
                {"conversation_id": conversation_id},
                {"$set": {"deleted_at": now}},
            )
        db.conversations.delete_many({"conversation_id": conversation_id})
        db.chat_messages.delete_many({"conversation_id": conversation_id})
        db.feedback.delete_many({"conversation_id": conversation_id})
    except Exception:
        return


def save_feedback(conversation_id: str, message_id: str, feedback: str, notes: str | None = None) -> None:
    try:
        db = _db_handle()
        if db is None:
            return
        db.feedback.insert_one({
            "conversation_id": conversation_id,
            "message_id": message_id,
            "feedback": feedback,
            "notes": notes,
            "created_at": datetime.now(timezone.utc),
        })
    except Exception:
        return

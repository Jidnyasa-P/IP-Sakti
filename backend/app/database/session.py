"""
MongoDB data-access layer (Section 22/33).

This is the persistent application database — conversations, chat messages,
product analyses, saved research, classification/validation/audit records,
feedback, expert escalations and admin-ingested documents.

DEMO MODE fallback (Section 21): when MONGODB_URI is blank or unreachable,
the exact same collection/index/query code runs against `mongomock`, a
pymongo-API-compatible in-process store. This is *not* persistent (state is
lost on restart) but lets the backend boot with zero external setup, exactly
like the local TF-IDF vector index and in-process NetworkX graph fallbacks
used elsewhere in this project. Set MONGODB_URI (see backend/.env.example)
to run against a real, persistent MongoDB instead — no code changes needed.
"""
from pymongo import MongoClient, ASCENDING
from pymongo.errors import PyMongoError

from app.core.config import get_settings
from app.core.logging import logger

settings = get_settings()

_client = None
_db = None
_using_mock = False

# collection_name -> list of (field_name, index_kwargs)
COLLECTION_INDEXES = {
    "users": [("email", {"unique": True})],
    "conversations": [("user_id", {}), ("updated_at", {})],
    "deleted_conversations": [("conversation_id", {"unique": True}), ("user_id", {}), ("deleted_at", {})],
    "chat_messages": [("conversation_id", {}), ("created_at", {}), ("sequence", {})],
    "product_analyses": [("user_id", {}), ("created_at", {})],
    "tk_abs_analyses": [("user_id", {}), ("created_at", {})],
    "saved_research": [("user_id", {}), ("created_at", {})],
    "classification_records": [("conversation_id", {}), ("created_at", {})],
    "validation_results": [("conversation_id", {}), ("created_at", {})],
    "feedback": [("conversation_id", {}), ("message_id", {})],
    "expert_escalations": [("conversation_id", {}), ("status", {})],
    "grievances": [("user_id", {}), ("created_at", {}), ("status", {})],
    "audit_logs": [("conversation_id", {}), ("created_at", {})],
    "user_ingested_documents": [("status", {}), ("created_at", {})],
}


def _build_client() -> MongoClient:
    global _using_mock
    if settings.mongodb_uri:
        client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=3000)
        try:
            client.admin.command("ping")
            _using_mock = False
            return client
        except PyMongoError as exc:
            logger.warning(
                f"MONGODB_URI is set but the server is unreachable ({exc}); "
                "falling back to the in-memory DEMO MODE store."
            )
    import mongomock  # local, pymongo-API-compatible fallback (dev/demo only)

    _using_mock = True
    return mongomock.MongoClient()


def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = _build_client()
    return _client


def get_database():
    global _db
    if _db is None:
        _db = get_client()[settings.mongodb_db_name]
    return _db


def is_using_mock() -> bool:
    get_database()
    return _using_mock


def init_db() -> None:
    """Create every collection and its indexes from a completely fresh
    database. Idempotent — safe to call on every startup."""
    db = get_database()
    existing = set(db.list_collection_names())
    for name, indexes in COLLECTION_INDEXES.items():
        if name not in existing:
            db.create_collection(name)
        coll = db[name]
        for field, opts in indexes:
            coll.create_index([(field, ASCENDING)], **opts)

    mode = "in-memory mock (DEMO MODE — non-persistent)" if _using_mock else f"live MongoDB ({settings.mongodb_uri})"
    logger.info(
        f"MongoDB ready | database={settings.mongodb_db_name} | backend={mode} | "
        f"collections={sorted(COLLECTION_INDEXES)}"
    )


def get_db():
    """FastAPI dependency — yields the Mongo database handle."""
    yield get_database()


def reset_db_for_tests() -> None:
    """Test-only helper: drop and recreate every collection so each test
    session starts from a genuinely fresh database state."""
    db = get_database()
    for name in list(db.list_collection_names()):
        db.drop_collection(name)
    init_db()

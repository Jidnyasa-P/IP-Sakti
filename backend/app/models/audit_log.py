"""Section 23. One document per pipeline run (query -> ... -> response)."""
from datetime import datetime, timezone

COLLECTION = "audit_logs"


def new_audit_log(
    id: str,
    conversation_id: str | None,
    query: str,
    classification: dict | None,
    jurisdiction: dict | None,
    retrieved_sources: list[dict],
    validation_status: str | None,
    confidence: dict | None,
    warnings: list[str],
    model_info: dict | None,
    latency_ms: dict | None,
) -> dict:
    return {
        "_id": id,
        "conversation_id": conversation_id,
        "query": query,
        "classification": classification,
        "jurisdiction": jurisdiction,
        "retrieved_sources": retrieved_sources or [],
        "validation_status": validation_status,
        "confidence": confidence,
        "warnings": warnings or [],
        "model_info": model_info,
        "latency_ms": latency_ms,
        "created_at": datetime.now(timezone.utc),
    }

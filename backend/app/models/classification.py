"""Persisted output of the classification engine (Section 5), used for audit."""
from datetime import datetime, timezone

COLLECTION = "classification_records"


def new_classification_record(
    id: str,
    query: str,
    category: str,
    confidence: float,
    reasoning_summary: str,
    needs_clarification: bool,
    clarification_questions: list | None = None,
    conversation_id: str | None = None,
) -> dict:
    return {
        "_id": id,
        "conversation_id": conversation_id,
        "query": query,
        "category": category,
        "confidence": confidence,
        "reasoning_summary": reasoning_summary,
        "needs_clarification": bool(needs_clarification),
        "clarification_questions": clarification_questions or [],
        "created_at": datetime.now(timezone.utc),
    }

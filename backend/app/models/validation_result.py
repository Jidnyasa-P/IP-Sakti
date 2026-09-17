"""Citation validation engine output (Section 13), persisted for audit."""
from datetime import datetime, timezone

COLLECTION = "validation_results"


def new_validation_result(
    id: str,
    claim: str,
    source: str,
    source_exists: bool,
    content_supports_claim: bool,
    authority_valid: bool,
    validation_status: str,
    details: dict | None = None,
    conversation_id: str | None = None,
) -> dict:
    return {
        "_id": id,
        "conversation_id": conversation_id,
        "claim": claim,
        "source": source,
        "source_exists": source_exists,
        "content_supports_claim": content_supports_claim,
        "authority_valid": authority_valid,
        "validation_status": validation_status,  # verified | failed | unverifiable
        "details": details or {},
        "created_at": datetime.now(timezone.utc),
    }

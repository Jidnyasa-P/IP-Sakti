"""Audit trail (Section 23). One document per query pipeline run."""
import uuid

from app.models.audit_log import COLLECTION, new_audit_log


def record_audit_log(
    db,
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
    log = new_audit_log(
        id=f"audit-{uuid.uuid4().hex[:12]}",
        conversation_id=conversation_id,
        query=query,
        classification=classification,
        jurisdiction=jurisdiction,
        retrieved_sources=retrieved_sources,
        validation_status=validation_status,
        confidence=confidence,
        warnings=warnings,
        model_info=model_info,
        latency_ms=latency_ms,
    )
    db[COLLECTION].insert_one(log)
    return log

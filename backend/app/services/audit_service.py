"""Audit trail (Section 23). One row per query pipeline run."""
import uuid
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def record_audit_log(
    db: Session,
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
) -> AuditLog:
    log = AuditLog(
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
    db.add(log)
    db.commit()
    db.refresh(log)
    return log

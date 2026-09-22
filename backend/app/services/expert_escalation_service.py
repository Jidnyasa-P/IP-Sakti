"""
Expert Escalation (Section 18).

Triggers when confidence is low, evidence is insufficient, sources conflict,
the question is legally complex (multi-jurisdiction / no coverage), or the
user explicitly asks. Persists an ExpertEscalation record so a real
expert-consultation service can later poll/subscribe to new rows — the
`notify_real_service()` hook below is where that integration would plug in.
"""
from dataclasses import dataclass

from app.core.logging import logger

LOW_CONFIDENCE_LEVELS = {"Low", "Insufficient evidence"}


@dataclass
class EscalationDecision:
    recommended: bool
    reason: str
    case_summary: str


def evaluate_escalation(
    query: str,
    confidence_level: str,
    has_conflicts: bool,
    jurisdiction_coverage_available: bool,
    confidence_score: float | None = None,
    user_requested: bool = False,
) -> EscalationDecision:
    reasons = []
    if user_requested:
        reasons.append("User explicitly requested expert consultation.")
    if confidence_level in LOW_CONFIDENCE_LEVELS or (confidence_score is not None and confidence_score < 0.70):
        if confidence_score is not None and confidence_score < 0.70:
            reasons.append(f"Confidence score is below 70% ({confidence_score:.0%}).")
        else:
            reasons.append(f"Retrieval confidence is '{confidence_level}'.")
    if has_conflicts:
        reasons.append("Conflicting authoritative sources were detected.")
    if not jurisdiction_coverage_available:
        reasons.append("The requested jurisdiction is not yet covered by the indexed knowledge base.")

    recommended = len(reasons) > 0
    reason_text = "; ".join(reasons) if reasons else "No escalation criteria met."
    case_summary = f"Query: {query[:200]}" if recommended else ""

    return EscalationDecision(recommended=recommended, reason=reason_text, case_summary=case_summary)


def notify_real_service(escalation_id: str) -> None:
    """Placeholder integration point for a real expert-consultation service
    (e.g. a queue publish or outbound webhook). Intentionally a no-op here —
    documented, not faked as if it already dispatches to a live expert."""
    logger.info(f"[expert-escalation] Case {escalation_id} recorded. No live expert-routing service is configured.")

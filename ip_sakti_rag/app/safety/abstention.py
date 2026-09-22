"""
Safe abstention: decides `needs_clarification` / `needs_expert` flags and, when
evidence is genuinely insufficient, overrides the answer with a clear,
honest "I don't have enough indexed evidence" message instead of letting a
low-confidence guess through looking authoritative.
"""
from __future__ import annotations

from app.config import DISCLAIMER_TEXT, settings
from app.schemas import ConfidenceMetric


HIGH_RISK_INTENTS = {"ABS_BIODIVERSITY", "TRADITIONAL_KNOWLEDGE", "IPR_PATENTABILITY"}


def decide_abstention(
    confidence: ConfidenceMetric,
    chunk_count: int,
    intent: str,
    jurisdiction_count: int,
) -> tuple[bool, bool]:
    """
    Returns (needs_clarification, needs_expert).
    """
    needs_clarification = chunk_count == 0 and confidence.score < settings.abstain_below_score
    # Expert redirection is driven purely by the (rescaled, percentage-
    # meaningful) confidence score: >=70% never redirects, <70% always does.
    # This used to also force a redirect for high-risk intents or any
    # cross-border query regardless of how strong the retrieved evidence
    # was, which made a well-cited "High confidence" answer get redirected
    # to an expert anyway -- i.e. the confidence score had no real effect on
    # this decision. `intent` / `jurisdiction_count` are kept as parameters
    # (other callers still pass them) but no longer override the score.
    needs_expert = confidence.score < settings.confidence_expert_escalation_threshold
    return needs_clarification, needs_expert


def apply_abstention_override(answer: str, needs_clarification: bool) -> str:
    if not needs_clarification:
        return answer
    return (
        "I don't have enough indexed authoritative evidence to answer this confidently. "
        "Could you share more detail — e.g. the specific product type, formulation origin "
        "(classical text vs. new combination), or the destination country for export — so I "
        "can retrieve the right statutory provisions? In the meantime: "
        f"{answer}"
    )


def get_disclaimer() -> str:
    return DISCLAIMER_TEXT

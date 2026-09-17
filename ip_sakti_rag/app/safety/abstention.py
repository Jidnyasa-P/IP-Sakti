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
    needs_expert = (
        confidence.level in ("Low", "Insufficient evidence")
        or (intent in HIGH_RISK_INTENTS and confidence.level != "High")
        or jurisdiction_count > 1  # cross-border questions always warrant expert sign-off
    )
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

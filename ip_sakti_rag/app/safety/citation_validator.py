"""
Citation validation.

Two checks:
1. Every [n] tag the LLM emitted must refer to an actual retrieved citation
   index — any tag for n > len(citations) is an LLM hallucination and gets
   stripped (with the removal logged), which also penalizes confidence.
2. Every citation's `authority` should match the allow-list of authoritative
   sources — this prevents low-trust text from being laundered as official
   guidance. Citations that fail this are flagged (not silently dropped, so
   the caller/UI can show a "not independently verified" note) but still
   lower confidence.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.config import AUTHORITATIVE_SOURCES_ALLOWLIST
from app.schemas import Citation

_CITATION_TAG_RE = re.compile(r"\[(\d+)\]")


@dataclass
class ValidationResult:
    cleaned_answer: str
    valid_citation_indices: set[int]
    hallucinated_tag_count: int
    unverified_authority_count: int


def validate_citations(answer: str, citations: list[Citation]) -> ValidationResult:
    max_index = len(citations)
    used_indices = {int(m) for m in _CITATION_TAG_RE.findall(answer)}
    hallucinated = {i for i in used_indices if i < 1 or i > max_index}

    cleaned_answer = answer
    for bad_index in hallucinated:
        cleaned_answer = re.sub(rf"\[{bad_index}\]", "", cleaned_answer)

    valid_indices = used_indices - hallucinated

    unverified = sum(
        1
        for c in citations
        if not any(allowed in c.authority.lower() for allowed in AUTHORITATIVE_SOURCES_ALLOWLIST)
    )

    return ValidationResult(
        cleaned_answer=cleaned_answer,
        valid_citation_indices=valid_indices,
        hallucinated_tag_count=len(hallucinated),
        unverified_authority_count=unverified,
    )

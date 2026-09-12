"""
Citation Validation Engine (Sections 13, 14, 15).

Runs as a separate layer *after* retrieval/generation. It never trusts a
citation just because the LLM (or the demo synthesis engine) produced it —
every citation is checked against the actual indexed corpus:

  1. source_exists      — does a chunk with this chunk_id/document_id exist?
  2. content_supports_claim — heuristic lexical-overlap check between the
                              claim text and the chunk's actual text (a
                              genuine, if simple, check — not a rubber stamp).
  3. authority_valid     — is the source's authority_level appropriate
                            (official/institutional) for a regulatory claim?

An unsupported claim is downgraded to validation_status="failed" and is never
presented to the user as verified.
"""
import re
from dataclasses import dataclass, field
from datetime import date

from app.rag.corpus import get_chunks, source_authority_level

STOP = set("the is at which on and a an in to for of with as by from this that or be are was were it can".split())


def _keywords(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-zA-Z]{4,}", text.lower()) if w not in STOP}


@dataclass
class ValidationOutcome:
    claim: str
    source: str
    source_exists: bool
    content_supports_claim: bool
    authority_valid: bool
    validation_status: str  # verified | failed | unverifiable
    warnings: list[str] = field(default_factory=list)


def validate_citation(claim_text: str, chunk_id: str) -> ValidationOutcome:
    chunk = next((c for c in get_chunks() if c["chunk_id"] == chunk_id), None)

    if chunk is None:
        return ValidationOutcome(
            claim=claim_text,
            source=chunk_id,
            source_exists=False,
            content_supports_claim=False,
            authority_valid=False,
            validation_status="failed",
            warnings=["Cited source does not exist in the indexed corpus."],
        )

    claim_kw = _keywords(claim_text)
    chunk_kw = _keywords(chunk["chunk_text"] + " " + chunk["title"] + " " + chunk["section"])
    overlap = len(claim_kw & chunk_kw)
    # "Supported" if the claim text shares a meaningful number of substantive terms
    # with the cited chunk (measured against the chunk's own vocabulary, since the
    # claim may be a much longer synthesized answer covering several citations at once).
    content_supports = overlap >= 3 and (overlap / max(1, len(chunk_kw))) >= 0.04

    authority_level = source_authority_level(chunk["authority"], chunk["document_type"])
    authority_valid = authority_level in ("official", "institutional")

    warnings = []
    if not content_supports:
        warnings.append("Insufficient lexical overlap between claim and cited source text; treat with caution.")
    if not authority_valid:
        warnings.append(f"Source authority level '{authority_level}' may not be sufficiently authoritative for a definitive regulatory claim.")

    outdated_warning = check_outdated(chunk)
    if outdated_warning:
        warnings.append(outdated_warning)

    status = "verified" if (content_supports and authority_valid) else "failed"

    return ValidationOutcome(
        claim=claim_text,
        source=chunk_id,
        source_exists=True,
        content_supports_claim=content_supports,
        authority_valid=authority_valid,
        validation_status=status,
        warnings=warnings,
    )


def check_outdated(chunk: dict, staleness_years: int = 10) -> str | None:
    """Section 15: never silently treat an old document as current law."""
    try:
        eff = chunk.get("effective_date")
        if not eff:
            return None
        y, m, d = [int(x) for x in eff.split("-")]
        age_years = (date.today() - date(y, m, d)).days / 365.25
        if age_years > staleness_years:
            return (
                f"This source's effective date ({eff}) is over {staleness_years} years old. "
                "Verify the current applicable regulation, as amendments may exist."
            )
    except Exception:
        return None
    return None


def detect_conflicts(chunks: list[dict]) -> list[dict]:
    """Section 14: flag same-topic chunks whose text implies opposite conditions
    (very lightweight heuristic — looks for chunks on the same topic where one
    contains a negation-bearing keyword the other lacks, e.g. 'exempt' vs
    'mandatory'). Real conflict detection over free text is an open problem;
    this MVP surfaces candidates for human review rather than resolving them.
    """
    conflicts = []
    contrastive_pairs = [("exempt", "mandatory"), ("not require", "require"), ("permitted", "prohibited")]
    for i in range(len(chunks)):
        for j in range(i + 1, len(chunks)):
            a, b = chunks[i], chunks[j]
            if a["topic"] != b["topic"]:
                continue
            a_text, b_text = a["chunk_text"].lower(), b["chunk_text"].lower()
            for word_a, word_b in contrastive_pairs:
                if (word_a in a_text and word_b in b_text) or (word_b in a_text and word_a in b_text):
                    conflicts.append({
                        "source_a": {"chunk_id": a["chunk_id"], "title": a["title"], "effective_date": a.get("effective_date"), "authority": a["authority"]},
                        "source_b": {"chunk_id": b["chunk_id"], "title": b["title"], "effective_date": b.get("effective_date"), "authority": b["authority"]},
                        "note": "Potentially conflicting provisions detected on the same topic; both are preserved below rather than silently picking one.",
                    })
    return conflicts

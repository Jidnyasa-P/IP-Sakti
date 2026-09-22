"""
Lightweight deterministic reranking of BM25+Qdrant candidates.

Render Free has a tight memory limit, so this implementation avoids loading
or calling a second ML/LLM reranker. Instead, it combines the already-computed
semantic (Qdrant) and lexical (BM25) relevance signals into a normalized
weighted score.

This keeps reranking fast, deterministic, dependency-free, and reliable on
Render Free. If candidate scores are unavailable, rerank() gracefully returns
None so hybrid.py can keep its existing fallback behavior.
"""
from __future__ import annotations

from typing import Any

from app.schemas import DocumentChunk

_MAX_CANDIDATES = 20
_SEMANTIC_WEIGHT = 0.65
_BM25_WEIGHT = 0.35


def _get_score(candidate: DocumentChunk, *names: str) -> float | None:
    """Read the first available numeric score from a candidate."""
    for name in names:
        value: Any = getattr(candidate, name, None)
        if isinstance(value, (int, float)):
            return float(value)
    return None


def _min_max_normalize(values: list[float]) -> list[float]:
    """Normalize scores to 0..1 without dividing by zero."""
    if not values:
        return []

    low = min(values)
    high = max(values)

    if high <= low:
        return [1.0] * len(values)

    return [(value - low) / (high - low) for value in values]


def rerank(
    query: str,
    candidates: list[DocumentChunk],
) -> dict[str, float] | None:
    """
    Return {chunk_id: relevance_score_0_to_1} using lightweight score fusion.

    The query is accepted for API compatibility but does not need to be sent
    to another model. Qdrant semantic scores and BM25 scores are normalized
    independently and combined as:

        final = 0.65 * semantic + 0.35 * BM25

    Returns None when usable scores are not available.
    """
    del query  # Kept for compatibility with the existing caller.

    if not candidates:
        return None

    subset = candidates[:_MAX_CANDIDATES]

    usable: list[tuple[DocumentChunk, float | None, float | None]] = []
    semantic_values: list[float] = []
    bm25_values: list[float] = []

    for candidate in subset:
        semantic = _get_score(
            candidate,
            "semantic_score",
            "qdrant_score",
            "similarity_score",
            "score",
        )
        bm25 = _get_score(
            candidate,
            "keyword_score",  # DocumentChunk uses this canonical field
            "bm25_score",
            "lexical_score",
        )

        usable.append((candidate, semantic, bm25))

        if semantic is not None:
            semantic_values.append(semantic)
        if bm25 is not None:
            bm25_values.append(bm25)

    if not semantic_values or not bm25_values:
        print(
            "[reranker] Missing semantic or BM25 scores; "
            "falling back to existing hybrid scoring."
        )
        return None

    normalized_semantic = _min_max_normalize(
        [semantic if semantic is not None else 0.0 for _, semantic, _ in usable]
    )
    normalized_bm25 = _min_max_normalize(
        [bm25 if bm25 is not None else 0.0 for _, _, bm25 in usable]
    )

    result: dict[str, float] = {}

    for index, (candidate, _, _) in enumerate(usable):
        final_score = (
            _SEMANTIC_WEIGHT * normalized_semantic[index]
            + _BM25_WEIGHT * normalized_bm25[index]
        )
        result[candidate.chunk_id] = max(0.0, min(1.0, final_score))

    if not result:
        return None

    print(
        "[reranker] Lightweight hybrid reranking applied "
        f"(semantic={_SEMANTIC_WEIGHT:.2f}, bm25={_BM25_WEIGHT:.2f}, "
        f"candidates={len(result)})."
    )
    return result

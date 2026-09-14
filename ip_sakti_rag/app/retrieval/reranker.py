"""
Optional cross-encoder re-ranker. Disabled by default (`RERANKER_ENABLED=false`)
because it adds a second model load — fine on a laptop, potentially too much
for a 512MB free web-service instance. Enable once you've confirmed your
deployment target's RAM budget.
"""
from __future__ import annotations

from app.config import settings
from app.schemas import DocumentChunk

_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import CrossEncoder

        _model = CrossEncoder(settings.reranker_model)
    return _model


def rerank(query: str, chunks: list[DocumentChunk]) -> list[tuple[DocumentChunk, float]]:
    if not settings.reranker_enabled or not chunks:
        return [(c, c.score or 0.0) for c in chunks]

    model = _get_model()
    pairs = [(query, c.chunk_text) for c in chunks]
    scores = model.predict(pairs)
    scored = list(zip(chunks, (float(s) for s in scores)))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored

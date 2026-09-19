"""
Hybrid retrieval: semantic search (Qdrant, remote 384-D FastEmbed embeddings) + lexical BM25
search, fused with Reciprocal Rank Fusion (RRF).

RRF (not a learned cross-encoder reranker) is used deliberately: it's a pure
rank-combination formula with nothing to load into memory, which keeps this
service inside Render's free-tier 512MB RAM limit. See app/embeddings.py and
app/config.py for the same reasoning applied to embeddings/config.

FIXED: `_reciprocal_rank_fusion` previously returned the RAW RRF score
(1/(_RRF_K+rank+1) summed across retrievers), which tops out at
2/(_RRF_K+1) ~= 0.033 for a chunk ranked #1 by both retrievers. That raw
value was being fed straight into `top_fused_score` and then into
app/safety/confidence.py's `compute_confidence()`, which compares it
against `confidence_high_threshold = 0.45` / `moderate = 0.28` / `low =
0.15` -- thresholds written for a 0-1-scaled score. Since 0.033 never
clears even the LOW threshold, every query was landing in the "Insufficient
evidence" bucket and getting floored at the minimum displayed score of 5%,
regardless of how good the actual retrieval was. This is what produced the
"Confidence Score: 5%" you saw even on a query that pulled 5 clearly
relevant, on-topic citations. Now normalized to a real 0-1 scale (divided
by the theoretical max), which is directly comparable to those existing
thresholds without needing to touch confidence.py at all.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field

from rank_bm25 import BM25Okapi

from app.embeddings import embed_query
from app.language import detect_intent, detect_language
from app.retrieval.vector_index import VectorIndex
from app.schemas import Citation, DocumentChunk, DocumentMetadata, Language

_RRF_K = 60  # standard RRF constant — de-emphasizes rank-1-vs-rank-2 noise
_MAX_RRF_SCORE = 2.0 / (_RRF_K + 1)  # score of a chunk ranked #1 by BOTH retrievers -- used to normalize to 0-1
_EXCERPT_CHARS = 400


def _tokenize(text: str) -> list[str]:
    return [t for t in text.lower().split() if t]


@dataclass
class RetrievalResult:
    top_chunks: list[DocumentChunk] = field(default_factory=list)
    citations: list[Citation] = field(default_factory=list)
    top_fused_score: float = 0.0
    detected_language: Language = "en"
    detected_intent: str = "GENERAL_AYUSH_IP_RESEARCH"
    latency_ms: int = 0


class HybridRetriever:
    def __init__(self, chunks: list[DocumentChunk], documents: list[DocumentMetadata] | None = None):
        self.chunks = chunks
        self._by_id = {c.chunk_id: c for c in chunks}
        # Real, authoritative source URL per document (e.g. India Code / IP
        # India / NBA portal link) — comes from the manifest via
        # DocumentMetadata, NOT stored on the chunk/vector itself. Looking
        # it up here means adding/fixing a URL only needs a manifest edit +
        # restart, never a re-embed/re-ingest.
        self._doc_url_by_id = {d.id: d.url for d in (documents or []) if d.url}
        self._bm25 = BM25Okapi([_tokenize(c.chunk_text) for c in chunks]) if chunks else None
        # Just opens/reuses the Qdrant connection — does NOT create the
        # collection (no vector_size passed). If nothing has been ingested
        # yet, search() below returns [] and we fall back to BM25 only.
        self._vector_index = VectorIndex()

    def retrieve(
        self,
        query: str,
        language: str | None = None,
        topic_filter: str | None = None,
        authority_filter: str | None = None,
        top_k: int = 5,
    ) -> RetrievalResult:
        started = time.monotonic()
        detected_language = detect_language(query, preferred=language)
        detected_intent = detect_intent(query)

        candidate_k = max(top_k * 4, 20)
        semantic_hits = self._semantic_search(query, candidate_k, topic_filter, authority_filter)
        keyword_hits = self._keyword_search(query, candidate_k, topic_filter, authority_filter)

        fused = _reciprocal_rank_fusion(semantic_hits, keyword_hits)[:top_k]

        top_chunks: list[DocumentChunk] = []
        citations: list[Citation] = []
        for i, (chunk_id, fused_score, sem_score, kw_score) in enumerate(fused, start=1):
            base = self._by_id.get(chunk_id)
            if base is None:
                continue
            chunk = base.model_copy(
                update={"score": round(fused_score, 4), "semantic_score": sem_score, "keyword_score": kw_score}
            )
            top_chunks.append(chunk)
            excerpt = chunk.chunk_text[:_EXCERPT_CHARS]
            if len(chunk.chunk_text) > _EXCERPT_CHARS:
                excerpt += "..."
            citations.append(
                Citation(
                    index=i,
                    chunk_id=chunk.chunk_id,
                    document_id=chunk.document_id,
                    title=chunk.title,
                    authority=chunk.authority,
                    section=chunk.section,
                    source=chunk.source,
                    excerpt=excerpt,
                    page=chunk.page,
                    url=self._doc_url_by_id.get(chunk.document_id),
                )
            )

        return RetrievalResult(
            top_chunks=top_chunks,
            citations=citations,
            top_fused_score=fused[0][1] if fused else 0.0,
            detected_language=detected_language,
            detected_intent=detected_intent,
            latency_ms=int((time.monotonic() - started) * 1000),
        )

    # -- semantic (Qdrant + remote query embedding) -----------------------
    def _semantic_search(
        self, query: str, top_k: int, topic_filter: str | None, authority_filter: str | None
    ) -> list[tuple[str, float]]:
        if not self.chunks:
            return []
        try:
            query_vector = embed_query(query)
        except Exception:
            # If the embedding service is unavailable, degrade to BM25-only
            # rather than failing the whole request.
            return []
        hits = self._vector_index.search(query_vector, top_k=top_k, query_filter=_build_qdrant_filter(topic_filter, authority_filter))
        return [(chunk.chunk_id, score) for chunk, score in hits]

    # -- lexical (BM25 over in-memory chunks) ---------------------------
    def _keyword_search(
        self, query: str, top_k: int, topic_filter: str | None, authority_filter: str | None
    ) -> list[tuple[str, float]]:
        if not self._bm25:
            return []
        scores = self._bm25.get_scores(_tokenize(query))
        scored: list[tuple[str, float]] = []
        for chunk, score in zip(self.chunks, scores):
            if score <= 0:
                continue
            if topic_filter and chunk.topic != topic_filter:
                continue
            if authority_filter and chunk.authority != authority_filter:
                continue
            scored.append((chunk.chunk_id, float(score)))
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]


def _build_qdrant_filter(topic_filter: str | None, authority_filter: str | None):
    from qdrant_client.http import models as qmodels

    conditions = []
    if topic_filter:
        conditions.append(qmodels.FieldCondition(key="topic", match=qmodels.MatchValue(value=topic_filter)))
    if authority_filter:
        conditions.append(qmodels.FieldCondition(key="authority", match=qmodels.MatchValue(value=authority_filter)))
    return qmodels.Filter(must=conditions) if conditions else None


def _reciprocal_rank_fusion(
    semantic_hits: list[tuple[str, float]],
    keyword_hits: list[tuple[str, float]],
) -> list[tuple[str, float, float | None, float | None]]:
    """
    Inputs: [(chunk_id, raw_score)] per retriever, best-first.
    Output: [(chunk_id, normalized_fused_score, semantic_raw_score, keyword_raw_score)],
    best-first, normalized_fused_score on a 0-1 scale (see _MAX_RRF_SCORE).
    A chunk found by only one retriever is still included (its other raw
    score is None) — it just scores lower than a chunk both retrievers
    agreed on.
    """
    sem_rank = {cid: i for i, (cid, _) in enumerate(semantic_hits)}
    kw_rank = {cid: i for i, (cid, _) in enumerate(keyword_hits)}
    sem_score_map = dict(semantic_hits)
    kw_score_map = dict(keyword_hits)

    fused = []
    for cid in set(sem_rank) | set(kw_rank):
        rrf_score = 0.0
        if cid in sem_rank:
            rrf_score += 1.0 / (_RRF_K + sem_rank[cid] + 1)
        if cid in kw_rank:
            rrf_score += 1.0 / (_RRF_K + kw_rank[cid] + 1)
        normalized_score = min(1.0, rrf_score / _MAX_RRF_SCORE)
        fused.append((cid, normalized_score, sem_score_map.get(cid), kw_score_map.get(cid)))

    fused.sort(key=lambda x: x[1], reverse=True)
    return fused

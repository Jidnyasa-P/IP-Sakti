"""
Hybrid retrieval: semantic search (Qdrant, remote 384-D FastEmbed embeddings) + lexical BM25
search, scored by Groq semantic reranking when available, falling back to a
continuous weighted-normalized score otherwise.

FIXED (this round): the previous scoring here was pure Reciprocal Rank
Fusion (RRF), normalized by dividing by the theoretical max ("both
retrievers ranked this #1"). That normalization is structurally quantized:
a chunk ranked #1 by exactly ONE retriever (the single most common case)
*always* normalizes to exactly 0.5 -- regardless of how strong or weak that
match actually was -- which is why confidence looked "stuck at 50%". A
chunk found only deep in one retriever's candidate list (or found via BM25
only when the embedding/Qdrant call failed for that request) could still
clear that same ~0.5 or drop to whatever the low end of the pool produced,
landing below `confidence_low_threshold` and getting floored to the
displayed minimum of 5% by app/safety/confidence.py -- explaining both
reported symptoms ("stuck at 50%" and a specific "Confidence Score: 5%")
from the SAME root cause: a rank-position-only score with no reflection of
actual match strength.

Now: every candidate gets a continuous 0-1 relevance score from Groq
(app/retrieval/reranker.py) when LLM_API_KEY is set -- a real semantic
judgment, not a rank artifact. Without Groq, falls back to a
weighted-normalized combination of each retriever's OWN raw score
(an absolute-strength transform -- raw cosine similarity for semantic, a
saturating transform for BM25's unbounded score, see _bm25_absolute below
-- deliberately NOT pool-relative min-max normalization, which has its own
quantization problem; see that function's docstring), which is still continuous and still reflects relative
match strength, just without Groq's semantic read. Either way,
`top_fused_score` is a real, continuous, comparable-to-thresholds number.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field

from rank_bm25 import BM25Okapi

from app.config import settings
from app.embeddings import embed_query
from app.language import detect_intent, detect_language
from app.retrieval import reranker
from app.retrieval.vector_index import VectorIndex
from app.schemas import Citation, DocumentChunk, DocumentMetadata, Language

_EXCERPT_CHARS = 400


def _tokenize(text: str) -> list[str]:
    return [t for t in text.lower().split() if t]


# Saturating transform constant for BM25's raw, unbounded score -> 0-1.
# FIXED: this used to be per-query min-max normalization, which by
# construction always maps whichever candidate scored highest *within this
# query's own candidate pool* to exactly 1.0 -- so with only one signal
# available (e.g. Qdrant/embedding unavailable that request), EVERY query's
# top fused score collapsed to exactly `keyword_weight` (0.4), regardless of
# whether the actual BM25 match was strong (score ~20+, a clear topical hit)
# or barely-there (score ~5, an unrelated query that merely matched a
# common word somewhere in the corpus) -- both landed at the identical
# 0.4000. Measured against this corpus's real BM25 score distribution
# (see git history / PR description for the calibration query): on-topic
# legal queries score roughly 15-25, unrelated/weak queries roughly 4-6.
# raw / (raw + BM25_SATURATION_K) with K=10 maps those to ~0.6-0.7 vs
# ~0.3-0.4 respectively -- reflects ABSOLUTE match strength, continuous,
# not quantized to the pool's own best-vs-worst spread.
_BM25_SATURATION_K = 10.0


def _bm25_absolute(raw_score: float) -> float:
    return raw_score / (raw_score + _BM25_SATURATION_K)


@dataclass
class RetrievalResult:
    top_chunks: list[DocumentChunk] = field(default_factory=list)
    citations: list[Citation] = field(default_factory=list)
    top_fused_score: float = 0.0
    detected_language: Language = "en"
    detected_intent: str = "GENERAL_AYUSH_IP_RESEARCH"
    latency_ms: int = 0
    reranked_by_groq: bool = False


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
        jurisdiction_filter: str | None = None,
        top_k: int = 5,
    ) -> RetrievalResult:
        started = time.monotonic()
        detected_language = detect_language(query, preferred=language)
        detected_intent = detect_intent(query)

        candidate_k = max(top_k * 4, 20)
        semantic_hits = self._semantic_search(
            query, candidate_k, topic_filter, authority_filter, jurisdiction_filter
        )
        keyword_hits = self._keyword_search(
            query, candidate_k, topic_filter, authority_filter, jurisdiction_filter
        )

        sem_score_map = dict(semantic_hits)
        kw_score_map = dict(keyword_hits)
        candidate_ids = list(dict.fromkeys([cid for cid, _ in semantic_hits] + [cid for cid, _ in keyword_hits]))
        candidates = [self._by_id[cid] for cid in candidate_ids if cid in self._by_id]

        # Fallback score: continuous, weighted, normalized within this pool.
        # Absolute-strength scores, not pool-relative rank (see
        # _bm25_absolute's docstring above for why that distinction matters).
        # Qdrant's cosine similarity is already a meaningful ~0-1 measure on
        # its own -- clipped to [0,1] since cosine can technically go
        # negative for a very poor match.
        sem_abs = {cid: max(0.0, min(1.0, s)) for cid, s in sem_score_map.items()}
        kw_abs = {cid: _bm25_absolute(s) for cid, s in kw_score_map.items()}
        fallback_scores = {
            c.chunk_id: settings.semantic_weight * sem_abs.get(c.chunk_id, 0.0)
            + settings.keyword_weight * kw_abs.get(c.chunk_id, 0.0)
            for c in candidates
        }

        # Order candidates by the fallback score first so the reranker only
        # sees the most promising candidates. IMPORTANT: attach the actual
        # retriever scores before reranking. Previously reranker.rerank() was
        # called with plain DocumentChunk objects whose semantic_score and
        # keyword_score were still None; that made the reranker print
        # "Missing semantic or BM25 scores" on every request and silently
        # disabled reranking.
        candidates.sort(key=lambda c: fallback_scores.get(c.chunk_id, 0.0), reverse=True)
        rerank_candidates = [
            c.model_copy(
                update={
                    "semantic_score": sem_score_map.get(c.chunk_id),
                    "keyword_score": kw_score_map.get(c.chunk_id),
                }
            )
            for c in candidates
        ]

        groq_scores = reranker.rerank(query, rerank_candidates) if rerank_candidates else None
        reranked = groq_scores is not None
        final_scores = groq_scores if reranked else fallback_scores

        ordered = sorted(candidates, key=lambda c: final_scores.get(c.chunk_id, 0.0), reverse=True)[:top_k]

        top_chunks: list[DocumentChunk] = []
        citations: list[Citation] = []
        for i, base in enumerate(ordered, start=1):
            score = round(final_scores.get(base.chunk_id, 0.0), 4)
            chunk = base.model_copy(
                update={
                    "score": score,
                    "semantic_score": sem_score_map.get(base.chunk_id),
                    "keyword_score": kw_score_map.get(base.chunk_id),
                }
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
            top_fused_score=(final_scores.get(ordered[0].chunk_id, 0.0) if ordered else 0.0),
            detected_language=detected_language,
            detected_intent=detected_intent,
            latency_ms=int((time.monotonic() - started) * 1000),
            reranked_by_groq=reranked,
        )

    # -- semantic (Qdrant + remote query embedding) -----------------------
    def _semantic_search(
        self,
        query: str,
        top_k: int,
        topic_filter: str | None,
        authority_filter: str | None,
        jurisdiction_filter: str | None,
    ) -> list[tuple[str, float]]:
        if not self.chunks:
            return []
        try:
            query_vector = embed_query(query)
        except Exception:
            # If the embedding service is unavailable, degrade to BM25-only
            # rather than failing the whole request.
            return []
        hits = self._vector_index.search(
            query_vector,
            top_k=top_k,
            query_filter=_build_qdrant_filter(
                topic_filter, authority_filter, jurisdiction_filter
            ),
        )
        return [(chunk.chunk_id, score) for chunk, score in hits]

    # -- lexical (BM25 over in-memory chunks) ---------------------------
    def _keyword_search(
        self,
        query: str,
        top_k: int,
        topic_filter: str | None,
        authority_filter: str | None,
        jurisdiction_filter: str | None,
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
            if jurisdiction_filter and chunk.jurisdiction != jurisdiction_filter:
                continue
            scored.append((chunk.chunk_id, float(score)))
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]


def _build_qdrant_filter(
    topic_filter: str | None,
    authority_filter: str | None,
    jurisdiction_filter: str | None,
):
    from qdrant_client.http import models as qmodels

    conditions = []
    if topic_filter:
        conditions.append(qmodels.FieldCondition(key="topic", match=qmodels.MatchValue(value=topic_filter)))
    if authority_filter:
        conditions.append(
            qmodels.FieldCondition(
                key="authority", match=qmodels.MatchValue(value=authority_filter)
            )
        )
    if jurisdiction_filter:
        conditions.append(
            qmodels.FieldCondition(
                key="jurisdiction",
                match=qmodels.MatchValue(value=jurisdiction_filter),
            )
        )
    return qmodels.Filter(must=conditions) if conditions else None

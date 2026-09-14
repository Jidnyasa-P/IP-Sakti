"""
Hybrid retrieval pipeline: Qdrant vector search + BM25 lexical scoring, fused
by weighted sum, boosted by detected intent/topic/authority/jurisdiction, then
optionally re-ranked by a cross-encoder, mirroring (and upgrading with real
embeddings) the fusion logic already prototyped in `server/rag/retrieval.ts`.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field

from app.config import settings
from app.language import detect_intent, detect_language
from app.retrieval.bm25_index import BM25Index
from app.retrieval.reranker import rerank
from app.retrieval.vector_index import VectorIndex, build_filter
from app.schemas import Citation, DocumentChunk, Language


@dataclass
class RetrievalResult:
    top_chunks: list[DocumentChunk]
    citations: list[Citation]
    detected_intent: str
    detected_language: Language
    top_fused_score: float
    latency_ms: int


class HybridRetriever:
    """
    Holds the loaded indexes as singletons (embedding model, Qdrant client,
    BM25 index) so `IPSaktiRAG` can be instantiated once at FastAPI startup
    and reused across requests cheaply.
    """

    def __init__(self, chunks: list[DocumentChunk]):
        self.chunks = chunks
        self.bm25 = BM25Index(chunks)
        self.vector_index: VectorIndex | None = None
        if chunks:
            from app.ingestion.embed_and_index import get_embedder

            self.embedder = get_embedder()
            self.vector_index = VectorIndex(vector_size=self.embedder.get_sentence_embedding_dimension())
        else:
            self.embedder = None

    def retrieve(
        self,
        query: str,
        language: Language | None = None,
        topic_filter: str | None = None,
        authority_filter: str | None = None,
        jurisdiction_filter: str | None = None,
        top_k: int | None = None,
    ) -> RetrievalResult:
        start = time.time()
        top_k = top_k or settings.top_k
        intent = detect_intent(query)
        detected_language = detect_language(query, language)

        if not self.chunks or not self.vector_index:
            return RetrievalResult([], [], intent, detected_language, 0.0, int((time.time() - start) * 1000))

        # 1. Vector search (semantic)
        query_vector = self.embedder.encode(query, normalize_embeddings=True).tolist()
        q_filter = build_filter(topic=topic_filter, authority=authority_filter, jurisdiction=jurisdiction_filter)
        vector_hits = self.vector_index.search(query_vector, top_k=min(top_k * 4, len(self.chunks)), query_filter=q_filter)
        vector_scores = {c.chunk_id: score for c, score in vector_hits}

        # 2. BM25 lexical search (over the full corpus, then intersect with candidate set)
        bm25_raw = self.bm25.score(query)
        max_bm25 = max(bm25_raw) if bm25_raw else 1.0
        bm25_scores = {
            c.chunk_id: (bm25_raw[i] / max_bm25 if max_bm25 > 0 else 0.0)
            for i, c in enumerate(self.chunks)
        }

        # 3. Candidate pool = union of top vector hits + top BM25 hits
        candidate_ids = set(vector_scores.keys())
        bm25_ranked = sorted(bm25_scores.items(), key=lambda x: x[1], reverse=True)[: top_k * 4]
        candidate_ids.update(cid for cid, _ in bm25_ranked)

        chunks_by_id = {c.chunk_id: c for c in self.chunks}

        # 4. Weighted fusion + intent/topic/authority boosts
        fused: list[tuple[DocumentChunk, float]] = []
        for cid in candidate_ids:
            chunk = chunks_by_id.get(cid)
            if chunk is None:
                continue
            sem = vector_scores.get(cid, 0.0)
            lex = bm25_scores.get(cid, 0.0)
            score = sem * settings.semantic_weight + lex * settings.keyword_weight
            score += _intent_boost(intent, chunk)
            if topic_filter and topic_filter.lower() in chunk.topic.lower():
                score += 0.15
            if authority_filter and authority_filter.lower() in chunk.authority.lower():
                score += 0.15
            chunk = chunk.model_copy(update={"score": score, "semantic_score": sem, "keyword_score": lex})
            fused.append((chunk, score))

        fused.sort(key=lambda x: x[1], reverse=True)
        top_candidates = [c for c, _ in fused[: top_k * 2]]

        # 5. Optional cross-encoder re-rank pass
        reranked = rerank(query, top_candidates)
        reranked.sort(key=lambda x: x[1], reverse=True)
        top_chunks = [c.model_copy(update={"score": s}) for c, s in reranked[:top_k]]

        citations = [
            Citation(
                index=i + 1,
                chunk_id=c.chunk_id,
                document_id=c.document_id,
                title=c.title,
                authority=c.authority,
                section=c.section,
                source=c.source,
                excerpt=(c.chunk_text[:240] + "...") if len(c.chunk_text) > 240 else c.chunk_text,
                page=c.page,
            )
            for i, c in enumerate(top_chunks)
        ]

        top_score = top_chunks[0].score if top_chunks and top_chunks[0].score is not None else 0.0
        latency_ms = int((time.time() - start) * 1000)

        return RetrievalResult(
            top_chunks=top_chunks,
            citations=citations,
            detected_intent=intent,
            detected_language=detected_language,
            top_fused_score=top_score,
            latency_ms=latency_ms,
        )


_INTENT_BOOST_MATCHERS: dict[str, list[str]] = {
    "IPR_PATENTABILITY": ["3(p)", "3(e)", "patent"],
    "IPR_BRAND_DESIGN": ["trade marks", "designs"],
    "ABS_BIODIVERSITY": ["biological diversity", "nba"],
    "TRADITIONAL_KNOWLEDGE": ["traditional knowledge", "tkdl"],
    "AYUSH_REGULATORY": ["drugs and cosmetics", "ayurveda aahar"],
}


def _intent_boost(intent: str, chunk: DocumentChunk) -> float:
    matchers = _INTENT_BOOST_MATCHERS.get(intent)
    if not matchers:
        return 0.0
    haystack = f"{chunk.title} {chunk.section} {chunk.authority}".lower()
    return 0.20 if any(m in haystack for m in matchers) else 0.0

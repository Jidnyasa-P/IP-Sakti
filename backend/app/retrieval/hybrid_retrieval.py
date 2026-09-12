"""
Hybrid RAG retrieval engine (Section 9).

This is a faithful, real, working port of the retrieval logic that already
existed in the project's Express/TypeScript backend (server/rag/retrieval.ts):
a BM25 lexical index fused with a lightweight term+character-trigram vector
matcher, intent detection, and a query-time reranker. It runs entirely
in-process with no external calls, so it works identically whether or not a
real vector database is configured.

If QDRANT_URL is configured, app/rag/vector_store.py additionally indexes the
same chunks into Qdrant and can be used for the semantic leg instead of the
local term-vector matcher — see get_semantic_scores().
"""
import math
import re
import time
from dataclasses import dataclass, field
from typing import Optional

from app.rag.corpus import get_chunks, get_metadata

STOPWORDS = set(
    "the is at which on and a an in to for of with as by from this that or be are was were it can".split()
) | {
    "का", "की", "के", "में", "और", "से", "पर", "को", "है", "हैं", "या", "एक", "ने", "हो",
    "आणि", "च्या", "चे", "ची", "मध्ये", "व", "आहे", "नाही", "यांचे", "त्यांचे", "करणे",
}

_TOKEN_RE = re.compile(r"[^\w\s\u0900-\u097F]", re.UNICODE)


def tokenize(text: str) -> list[str]:
    cleaned = _TOKEN_RE.sub(" ", text.lower())
    return [t for t in cleaned.split() if len(t) > 1 and t not in STOPWORDS]


INTENT_KEYWORDS = {
    "IPR_PATENTABILITY": ["patent", "पेटेंट", "3(p)", "3(e)", "admixture", "synerg"],
    "IPR_BRAND_DESIGN": ["trademark", "brand", "ट्रेडमार्क", "class 5", "class 3", "logo", "design"],
    "ABS_BIODIVERSITY": ["abs", "biological", "biodiversity", "nba", "sbb", "जैव विविधता", "जैविक संसाधन"],
    "TRADITIONAL_KNOWLEDGE": ["traditional knowledge", "tkdl", "पारंपरिक ज्ञान", "पारंपारिक", "prior art", "charaka"],
    "AYUSH_REGULATORY": ["classical", "proprietary", "ayush", "schedule t", "gmp", "rule 158", "aahar", "आयुष"],
}


def detect_intent(query: str) -> str:
    q = query.lower()
    for intent, keywords in INTENT_KEYWORDS.items():
        if any(k in q for k in keywords):
            return intent
    return "GENERAL_AYUSH_IP_RESEARCH"


MARATHI_MARKERS = ["आहे", "नाही", "कसे", "पेटंट", "झाले", "करणे", "औषध", "माहिती", "पारंपारिक"]
DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")


def detect_language(query: str, preferred: Optional[str] = None) -> str:
    if preferred and preferred != "en":
        return preferred
    if DEVANAGARI_RE.search(query):
        return "mr" if any(w in query for w in MARATHI_MARKERS) else "hi"
    return preferred or "en"


class BM25Index:
    """Classic Okapi BM25 over the local authoritative-document chunk corpus."""

    def __init__(self, chunks: list[dict]):
        self.chunks = chunks
        self.doc_term_freqs: list[dict[str, int]] = []
        self.doc_lengths: list[int] = []
        self.term_doc_freq: dict[str, int] = {}
        self._build()

    def _build(self):
        total_len = 0
        for chunk in self.chunks:
            full_text = f"{chunk['title']} {chunk['section']} {chunk['chunk_text']} {chunk['topic']} {chunk['authority']}"
            tokens = tokenize(full_text)
            total_len += len(tokens)
            self.doc_lengths.append(len(tokens))
            tf: dict[str, int] = {}
            seen = set()
            for t in tokens:
                tf[t] = tf.get(t, 0) + 1
                if t not in seen:
                    self.term_doc_freq[t] = self.term_doc_freq.get(t, 0) + 1
                    seen.add(t)
            self.doc_term_freqs.append(tf)
        self.avg_doc_length = total_len / max(1, len(self.chunks))

    def score(self, query: str, k1: float = 1.5, b: float = 0.75) -> list[float]:
        query_tokens = tokenize(query)
        n = len(self.chunks)
        scores = [0.0] * n
        for qt in query_tokens:
            df = self.term_doc_freq.get(qt, 0)
            if df == 0:
                continue
            idf = math.log(1 + (n - df + 0.5) / (df + 0.5))
            for i in range(n):
                tf = self.doc_term_freqs[i].get(qt, 0)
                if tf == 0:
                    continue
                doc_len = self.doc_lengths[i]
                denom = tf + k1 * (1 - b + b * (doc_len / self.avg_doc_length))
                scores[i] += idf * ((tf * (k1 + 1)) / denom)
        return scores


class SemanticVectorMatcher:
    """Lightweight local 'semantic' leg: term + character-trigram cosine similarity.

    This gives cross-lingual/subword resilience without requiring a downloaded
    embedding model or network access. When EMBEDDING_PROVIDER is configured,
    app/rag/embeddings.py can be used to replace this with real embeddings.
    """

    def __init__(self, chunks: list[dict]):
        self.chunks = chunks
        self.chunk_vectors: list[dict[str, float]] = []
        self._build()

    @staticmethod
    def _vectorize(text: str) -> dict[str, float]:
        vec: dict[str, float] = {}
        for t in tokenize(text):
            vec[t] = vec.get(t, 0) + 1
        for i in range(0, max(0, len(text) - 3), 2):
            trigram = text[i:i + 3].lower()
            vec[trigram] = vec.get(trigram, 0) + 0.5
        return vec

    def _build(self):
        for chunk in self.chunks:
            text = f"{chunk['title']} {chunk['authority']} {chunk['section']} {chunk['chunk_text']} {chunk['topic']}"
            self.chunk_vectors.append(self._vectorize(text))

    def score(self, query: str) -> list[float]:
        q_vec = self._vectorize(query)
        q_norm = math.sqrt(sum(v * v for v in q_vec.values()))
        if q_norm == 0:
            return [0.0] * len(self.chunks)
        scores = []
        for c_vec in self.chunk_vectors:
            dot = sum(v * q_vec.get(k, 0) for k, v in c_vec.items())
            c_norm = math.sqrt(sum(v * v for v in c_vec.values()))
            scores.append(dot / (q_norm * c_norm) if c_norm > 0 else 0.0)
        return scores


@dataclass
class ConfidenceMetric:
    level: str
    score: float
    reasons: list[str] = field(default_factory=list)


@dataclass
class RetrievalResult:
    top_chunks: list[dict]
    citations: list[dict]
    confidence: ConfidenceMetric
    detected_intent: str
    detected_language: str
    retrieval_latency_ms: int


class HybridRetriever:
    def __init__(self):
        self.chunks = get_chunks()
        self.bm25 = BM25Index(self.chunks)
        self.semantic = SemanticVectorMatcher(self.chunks)

    def retrieve(
        self,
        query: str,
        language: Optional[str] = None,
        semantic_weight: float = 0.65,
        keyword_weight: float = 0.35,
        top_k: int = 5,
        topic_filter: Optional[str] = None,
        authority_filter: Optional[str] = None,
    ) -> RetrievalResult:
        start = time.time()
        intent = detect_intent(query)
        detected_language = detect_language(query, language)

        bm25_scores = self.bm25.score(query)
        max_bm25 = max(bm25_scores) if bm25_scores else 1.0
        max_bm25 = max_bm25 or 1.0
        norm_bm25 = [s / max_bm25 for s in bm25_scores]

        sem_scores = self.semantic.score(query)
        max_sem = max(sem_scores) if sem_scores else 1.0
        # Safety floor: character-trigram cosine similarity is noisy for short/
        # nonsense queries (common English trigrams overlap by chance even with
        # zero real lexical match). Normalizing purely by max() would blow a
        # trivial raw similarity up to a "perfect" 1.0 score. Require a minimum
        # *absolute* raw cosine before treating the semantic leg as meaningful,
        # so gibberish queries with no real token overlap correctly fall through
        # to "Insufficient evidence" instead of a false "High" confidence.
        ABSOLUTE_MIN_SEMANTIC = 0.12
        if max_sem < ABSOLUTE_MIN_SEMANTIC:
            norm_sem = [0.0] * len(sem_scores)
        else:
            norm_sem = [s / max_sem if max_sem > 0 else 0.0 for s in sem_scores]

        candidates = []
        for idx, chunk in enumerate(self.chunks):
            base = norm_sem[idx] * semantic_weight + norm_bm25[idx] * keyword_weight

            if topic_filter and topic_filter.lower() in chunk["topic"].lower():
                base += 0.20
            if authority_filter and authority_filter.lower() in chunk["authority"].lower():
                base += 0.20

            if intent == "IPR_PATENTABILITY" and (
                "3(p)" in chunk["section"] or "3(e)" in chunk["section"] or "Patent" in chunk["title"]
            ):
                base += 0.25
            elif intent == "IPR_BRAND_DESIGN" and ("Trade Marks" in chunk["title"] or "Designs" in chunk["title"]):
                base += 0.25
            elif intent == "ABS_BIODIVERSITY" and (
                "Biological Diversity" in chunk["title"] or "NBA" in chunk["authority"]
            ):
                base += 0.25
            elif intent == "TRADITIONAL_KNOWLEDGE" and (
                "Traditional Knowledge" in chunk["title"] or "TKDL" in chunk["title"]
            ):
                base += 0.25
            elif intent == "AYUSH_REGULATORY" and (
                "Drugs and Cosmetics" in chunk["title"] or "Ayurveda Aahar" in chunk["title"]
            ):
                base += 0.25

            enriched = {**chunk, "score": base, "semantic_score": norm_sem[idx], "keyword_score": norm_bm25[idx]}
            candidates.append(enriched)

        candidates.sort(key=lambda c: c["score"], reverse=True)
        top_candidates = candidates[: min(top_k * 2, len(candidates))]

        query_words = tokenize(query)
        for item in top_candidates:
            for word in query_words:
                if word in item["section"].lower():
                    item["score"] += 0.15
                if word in item["title"].lower():
                    item["score"] += 0.10

        top_candidates.sort(key=lambda c: c["score"], reverse=True)
        top_chunks = top_candidates[:top_k]

        citations = [
            {
                "index": i + 1,
                "chunk_id": c["chunk_id"],
                "document_id": c["document_id"],
                "title": c["title"],
                "authority": c["authority"],
                "section": c["section"],
                "source": c["source"],
                "excerpt": c["chunk_text"][:240] + "...",
                "page": c.get("page"),
            }
            for i, c in enumerate(top_chunks)
        ]

        top_score = top_chunks[0]["score"] if top_chunks else 0.0
        reasons: list[str] = []
        if top_score > 0.45 and len(top_chunks) >= 3:
            level = "High"
            reasons = [
                f"Direct statutory citations identified from {top_chunks[0]['authority']}.",
                f"Multi-source convergence across {len(top_chunks)} relevant legislative chunks.",
                "Clear authoritative provisions match query terms.",
            ]
        elif top_score > 0.28 and len(top_chunks) >= 2:
            level = "Moderate"
            reasons = [
                "Relevant regulatory principles retrieved, partial textual alignment.",
                "Sufficient basis for analytical decision-support.",
            ]
        elif top_score > 0.15:
            level = "Low"
            reasons = [
                "Limited direct textual overlap with indexed statutory provisions.",
                "Recommendation to consult official gazettes or specialized counsel.",
            ]
        else:
            level = "Insufficient evidence"
            reasons = ["No direct legislative provisions or official guidelines matched in the indexed knowledge base."]

        latency_ms = int((time.time() - start) * 1000)

        return RetrievalResult(
            top_chunks=top_chunks,
            citations=citations,
            confidence=ConfidenceMetric(level=level, score=min(1.0, max(0.1, top_score)), reasons=reasons),
            detected_intent=intent,
            detected_language=detected_language,
            retrieval_latency_ms=latency_ms,
        )


def search_indexed_documents(
    query: str,
    topic: Optional[str] = None,
    authority: Optional[str] = None,
    document_type: Optional[str] = None,
) -> list[dict]:
    docs = list(get_metadata())
    if topic and topic != "ALL":
        docs = [d for d in docs if d["topic"].lower() == topic.lower()]
    if authority and authority != "ALL":
        docs = [d for d in docs if authority.lower() in d["authority"].lower()]
    if document_type and document_type != "ALL":
        docs = [d for d in docs if d["document_type"].lower() == document_type.lower()]
    if query and query.strip():
        q = query.lower()
        docs = [
            d for d in docs
            if q in d["title"].lower() or q in d["summary"].lower() or q in d["authority"].lower() or q in d["topic"].lower()
        ]
    return docs


def get_document_details(document_id: str) -> dict:
    meta = next((d for d in get_metadata() if d["id"] == document_id), None)
    chunks = [c for c in get_chunks() if c["document_id"] == document_id]
    return {"metadata": meta, "chunks": chunks}


_retriever: Optional[HybridRetriever] = None


def get_retriever() -> HybridRetriever:
    global _retriever
    if _retriever is None:
        _retriever = HybridRetriever()
    return _retriever

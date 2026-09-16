"""
Hybrid retrieval: BM25 (lexical) + Qdrant (dense, multilingual) fused via
Reciprocal Rank Fusion (RRF), with an optional cross-encoder re-ranking
pass on top of the fused shortlist.

RRF does the heavy lifting by default because a reranker model loaded
in-process risks Render's free-tier 512MB RAM limit. Re-ranking is gated
by RERANKER_ENABLED and only runs on the top `RERANK_CANDIDATES` fused
results, not the whole corpus, to keep it cheap if you do turn it on
(e.g. once you're on a paid Render plan or a separate worker).
"""
import os

from qdrant_client import QdrantClient

from bm25_index import search as bm25_search
from embeddings import embed_query

_client = QdrantClient(
    url=os.environ["QDRANT_URL"], api_key=os.environ.get("QDRANT_API_KEY")
)
COLLECTION = os.environ.get("QDRANT_COLLECTION", "legal_corpus_chunks")

RERANKER_ENABLED = os.environ.get("RERANKER_ENABLED", "false").lower() == "true"
RERANK_CANDIDATES = int(os.environ.get("RERANK_CANDIDATES", "20"))

_reranker = None


def _get_reranker():
    """Lazy-loaded so the ~90MB cross-encoder is never pulled into memory
    unless RERANKER_ENABLED=true — keeps default RAM usage low on Render."""
    global _reranker
    if _reranker is None:
        from sentence_transformers import CrossEncoder
        _reranker = CrossEncoder(
            os.environ.get("RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")
        )
    return _reranker


def hybrid_search(query: str, top_k: int = 8, rrf_k: int = 60) -> list[tuple[str, float]]:
    bm25_ranked = bm25_search(query, top_k=30)  # [(chunk_id, bm25_score), ...]

    qvec = embed_query(query)
    # QdrantClient.search()/.recommend() are deprecated as of qdrant-client
    # 1.15+ in favour of query_points(); see qdrant/qdrant-client releases.
    vector_result = _client.query_points(
        collection_name=COLLECTION, query=qvec, limit=30, with_payload=True
    )
    vector_ranked = [(hit.id, hit.score) for hit in vector_result.points]

    rrf_scores: dict[str, float] = {}
    texts_by_id: dict[str, str] = {}
    for rank, (cid, _score) in enumerate(bm25_ranked):
        rrf_scores[cid] = rrf_scores.get(cid, 0.0) + 1.0 / (rrf_k + rank + 1)
    for rank, hit in enumerate(vector_result.points):
        cid = hit.id
        rrf_scores[cid] = rrf_scores.get(cid, 0.0) + 1.0 / (rrf_k + rank + 1)
        if hit.payload and hit.payload.get("display_excerpt"):
            texts_by_id[cid] = hit.payload["display_excerpt"]

    fused = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)

    if not RERANKER_ENABLED or len(fused) <= 1:
        return fused[:top_k]

    # Re-rank only the top N fused candidates against the query text.
    candidates = fused[:RERANK_CANDIDATES]
    pairs = [(query, texts_by_id.get(cid, "")) for cid, _ in candidates]
    reranker = _get_reranker()
    rerank_scores = reranker.predict(pairs)
    reranked = sorted(zip([cid for cid, _ in candidates], rerank_scores), key=lambda x: x[1], reverse=True)
    return reranked[:top_k]

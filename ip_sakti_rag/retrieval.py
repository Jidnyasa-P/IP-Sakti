"""
Hybrid retrieval: BM25 (lexical) + Qdrant (dense, multilingual) fused via
Reciprocal Rank Fusion (RRF).

RRF is used instead of a cross-encoder reranker deliberately: a reranker
model would need to be loaded in-process, which risks the 512MB RAM limit
on Render's free tier. RRF needs no model at all — it just merges two
ranked lists by position — and captures most of a reranker's benefit for
a corpus this size (statutory text, low hundreds to low thousands of
chunks). If you outgrow this, add a hosted rerank API call here later
without touching bm25_index.py or embeddings.py.
"""
import os

from qdrant_client import QdrantClient

from .bm25_index import search as bm25_search
from .embeddings import embed_query

_client = QdrantClient(
    url=os.environ["QDRANT_URL"], api_key=os.environ.get("QDRANT_API_KEY")
)
COLLECTION = os.environ.get("QDRANT_COLLECTION", "legal_corpus_chunks")


def hybrid_search(query: str, top_k: int = 8, rrf_k: int = 60) -> list[tuple[str, float]]:
    bm25_ranked = bm25_search(query, top_k=30)  # [(chunk_id, bm25_score), ...]

    qvec = embed_query(query)
    vector_hits = _client.search(
        collection_name=COLLECTION, query_vector=qvec, limit=30
    )
    vector_ranked = [(hit.id, hit.score) for hit in vector_hits]

    rrf_scores: dict[str, float] = {}
    for rank, (cid, _score) in enumerate(bm25_ranked):
        rrf_scores[cid] = rrf_scores.get(cid, 0.0) + 1.0 / (rrf_k + rank + 1)
    for rank, (cid, _score) in enumerate(vector_ranked):
        rrf_scores[cid] = rrf_scores.get(cid, 0.0) + 1.0 / (rrf_k + rank + 1)

    fused = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
    return fused[:top_k]

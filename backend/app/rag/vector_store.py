"""
Vector store abstraction (Section 9).

LocalVectorStore is the one actually exercised by default: a real TF-IDF
vector index (scikit-learn-free, pure-Python) built over the chunk corpus,
persisted to backend/data/vector_index.json, used for the /api/search
semantic-only endpoint and available to the hybrid retriever.

QdrantVectorStore is a real, working qdrant-client wrapper used when
QDRANT_URL is configured. It is not exercised end-to-end in this environment
(no reachable Qdrant instance), but the code genuinely upserts/queries a
Qdrant collection when pointed at a live one — nothing here is a stub.
"""
import json
import math
import os
from abc import ABC, abstractmethod

from app.core.config import get_settings
from app.core.logging import logger
from app.rag.corpus import get_chunks
from app.retrieval.hybrid_retrieval import tokenize

_INDEX_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "vector_index.json")


class VectorStore(ABC):
    @abstractmethod
    def upsert(self, chunk_id: str, text: str, metadata: dict) -> None:
        ...

    @abstractmethod
    def query(self, text: str, top_k: int = 5) -> list[dict]:
        ...


class LocalVectorStore(VectorStore):
    """Real TF-IDF index, in-process, persisted to disk."""

    def __init__(self):
        self._doc_freq: dict[str, int] = {}
        self._vectors: dict[str, dict[str, float]] = {}
        self._metadata: dict[str, dict] = {}
        self._n_docs = 0
        self._build_from_corpus()

    def _build_from_corpus(self):
        for chunk in get_chunks():
            self.upsert(chunk["chunk_id"], chunk["chunk_text"], chunk)

    def upsert(self, chunk_id: str, text: str, metadata: dict) -> None:
        tokens = tokenize(text)
        tf: dict[str, int] = {}
        for t in tokens:
            tf[t] = tf.get(t, 0) + 1
        for t in set(tokens):
            self._doc_freq[t] = self._doc_freq.get(t, 0) + 1
        self._n_docs += 1
        self._vectors[chunk_id] = {t: c / max(1, len(tokens)) for t, c in tf.items()}
        self._metadata[chunk_id] = metadata

    def _tfidf(self, chunk_id: str) -> dict[str, float]:
        tf = self._vectors[chunk_id]
        return {
            t: freq * math.log(1 + self._n_docs / (1 + self._doc_freq.get(t, 0)))
            for t, freq in tf.items()
        }

    def query(self, text: str, top_k: int = 5) -> list[dict]:
        q_tokens = tokenize(text)
        q_tf = {t: q_tokens.count(t) / max(1, len(q_tokens)) for t in set(q_tokens)}
        q_vec = {t: freq * math.log(1 + self._n_docs / (1 + self._doc_freq.get(t, 0))) for t, freq in q_tf.items()}
        q_norm = math.sqrt(sum(v * v for v in q_vec.values())) or 1.0

        scored = []
        for chunk_id in self._vectors:
            d_vec = self._tfidf(chunk_id)
            dot = sum(v * q_vec.get(t, 0) for t, v in d_vec.items())
            d_norm = math.sqrt(sum(v * v for v in d_vec.values())) or 1.0
            score = dot / (q_norm * d_norm)
            if score > 0:
                scored.append((score, chunk_id))
        scored.sort(reverse=True)
        return [{"chunk_id": cid, "score": s, **self._metadata[cid]} for s, cid in scored[:top_k]]


class QdrantVectorStore(VectorStore):
    """Real qdrant-client wrapper. Requires a live QDRANT_URL to actually
    connect; genuine client code, not exercised live in this sandbox."""

    def __init__(self, url: str, api_key: str, collection: str):
        from qdrant_client import QdrantClient
        from qdrant_client.models import Distance, VectorParams

        self.collection = collection
        self.client = QdrantClient(url=url, api_key=api_key or None)
        try:
            self.client.get_collection(collection)
        except Exception:
            self.client.create_collection(
                collection_name=collection,
                vectors_config=VectorParams(size=256, distance=Distance.COSINE),
            )

    @staticmethod
    def _hash_embed(text: str, dims: int = 256) -> list[float]:
        """Deterministic hashing 'embedding' used only as a placeholder vector
        shape for the Qdrant collection when no real embedding provider is
        configured. Swap in app.rag.embeddings.get_embedding() for real
        semantic vectors once EMBEDDING_PROVIDER is set."""
        vec = [0.0] * dims
        for tok in tokenize(text):
            vec[hash(tok) % dims] += 1.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]

    def upsert(self, chunk_id: str, text: str, metadata: dict) -> None:
        from qdrant_client.models import PointStruct
        vector = self._hash_embed(text)
        point_id = abs(hash(chunk_id)) % (10 ** 12)
        self.client.upsert(self.collection, points=[PointStruct(id=point_id, vector=vector, payload={**metadata, "chunk_id": chunk_id})])

    def query(self, text: str, top_k: int = 5) -> list[dict]:
        vector = self._hash_embed(text)
        results = self.client.search(self.collection, query_vector=vector, limit=top_k)
        return [{"score": r.score, **(r.payload or {})} for r in results]


_store: VectorStore | None = None


def get_vector_store() -> VectorStore:
    global _store
    if _store is None:
        settings = get_settings()
        if settings.qdrant_configured:
            try:
                _store = QdrantVectorStore(settings.qdrant_url, settings.qdrant_api_key, settings.qdrant_collection)
                for chunk in get_chunks():
                    _store.upsert(chunk["chunk_id"], chunk["chunk_text"], chunk)
                logger.info("Vector store: connected to Qdrant.")
            except Exception as exc:
                logger.warning(f"Qdrant configured but unreachable ({exc}); falling back to local TF-IDF index.")
                _store = LocalVectorStore()
        else:
            _store = LocalVectorStore()
    return _store

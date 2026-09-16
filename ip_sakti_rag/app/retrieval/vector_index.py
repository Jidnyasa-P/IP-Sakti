"""
Qdrant vector index wrapper.

Two modes, chosen automatically:
  - QDRANT_URL set  -> Qdrant Cloud (free-tier 1GB cluster). Use this for
    anything deployed on Render: Render's disk is ephemeral (wiped on every
    restart/redeploy), so a locally-stored index would disappear.
  - QDRANT_URL unset -> embedded on-disk Qdrant at `qdrant_local_path`
    (./data/qdrant_local by default). Handy for local dev/ingestion without
    a cloud cluster, but NOT suitable for Render.

This module is intentionally the only place that talks to Qdrant directly,
so app/ingestion/embed_and_index.py (writes) and app/retrieval/hybrid.py
(reads) both go through the same client/collection handling.
"""
from __future__ import annotations

import uuid

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from app.config import settings
from app.schemas import DocumentChunk

# Fields on DocumentChunk that are safe/expected to round-trip through a
# Qdrant payload. Keeping this explicit (rather than dumping the whole model)
# avoids ever accidentally storing a stale `score`/`semantic_score` in the
# payload and reading it back as if it were a real persisted value.
_PAYLOAD_FIELDS = [
    "chunk_id",
    "document_id",
    "title",
    "source",
    "authority",
    "jurisdiction",
    "document_type",
    "section",
    "page",
    "paragraph",
    "language",
    "publication_date",
    "effective_date",
    "topic",
    "chunk_text",
]

_client: QdrantClient | None = None  # module-level cache: one connection per process


def _get_client() -> QdrantClient:
    global _client
    if _client is None:
        if settings.qdrant_url:
            _client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key, timeout=30)
        else:
            _client = QdrantClient(path=settings.qdrant_local_path)
    return _client


def _point_id(chunk_id: str) -> str:
    """Deterministic UUID from chunk_id, so re-ingesting the same document
    overwrites its old points instead of duplicating them."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, chunk_id))


class VectorIndex:
    def __init__(self, vector_size: int | None = None):
        self.collection = settings.qdrant_collection
        self.client = _get_client()
        if vector_size:
            self._ensure_collection(vector_size)

    def _ensure_collection(self, vector_size: int) -> None:
        existing = {c.name for c in self.client.get_collections().collections}
        if self.collection not in existing:
            self.client.create_collection(
                collection_name=self.collection,
                vectors_config=qmodels.VectorParams(size=vector_size, distance=qmodels.Distance.COSINE),
            )

    def collection_exists(self) -> bool:
        try:
            existing = {c.name for c in self.client.get_collections().collections}
        except Exception:
            return False
        return self.collection in existing

    def upsert(self, chunks: list[DocumentChunk], vectors: list[list[float]], batch_size: int = 64) -> None:
        points = [
            qmodels.PointStruct(
                id=_point_id(chunk.chunk_id),
                vector=vector,
                payload={field: getattr(chunk, field) for field in _PAYLOAD_FIELDS},
            )
            for chunk, vector in zip(chunks, vectors)
        ]
        for i in range(0, len(points), batch_size):
            self.client.upsert(collection_name=self.collection, points=points[i : i + batch_size])

    def search(
        self,
        query_vector: list[float],
        top_k: int = 10,
        query_filter: qmodels.Filter | None = None,
    ) -> list[tuple[DocumentChunk, float]]:
        """Returns [(chunk, similarity_score)], best first. Never raises —
        a missing collection (e.g. before the first `scripts/ingest.py` run)
        or a transient Qdrant error just yields no semantic hits, so the
        pipeline still answers using BM25 alone."""
        if not self.collection_exists():
            return []
        try:
            hits = self.client.query_points(
                collection_name=self.collection,
                query=query_vector,
                limit=top_k,
                query_filter=query_filter,
                with_payload=True,
            ).points
        except Exception:
            return []

        results: list[tuple[DocumentChunk, float]] = []
        for h in hits:
            payload = h.payload or {}
            try:
                chunk = DocumentChunk(**{f: payload.get(f) for f in _PAYLOAD_FIELDS})
            except Exception:
                continue
            results.append((chunk, float(h.score)))
        return results

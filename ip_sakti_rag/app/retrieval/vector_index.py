"""
Qdrant wrapper.

Free-tier friendly: if `QDRANT_URL` is unset, uses Qdrant's embedded local
on-disk mode (`QdrantClient(path=...)`) — no server, no network, works on any
free hosting tier and even fully offline. Set `QDRANT_URL`/`QDRANT_API_KEY`
(e.g. a Qdrant Cloud free cluster) to switch to a real server for deployment.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from app.config import settings
from app.schemas import DocumentChunk


class VectorIndex:
    def __init__(self, vector_size: int):
        self.collection_name = settings.qdrant_collection
        self.vector_size = vector_size

        if settings.qdrant_url:
            self.client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)
        else:
            local_path = Path(settings.qdrant_local_path)
            local_path.mkdir(parents=True, exist_ok=True)
            self.client = QdrantClient(path=str(local_path))

        self._ensure_collection()

    def _ensure_collection(self) -> None:
        existing = [c.name for c in self.client.get_collections().collections]
        if self.collection_name not in existing:
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=qmodels.VectorParams(size=self.vector_size, distance=qmodels.Distance.COSINE),
            )

    def upsert(self, chunks: list[DocumentChunk], vectors: list[list[float]]) -> None:
        points = [
            qmodels.PointStruct(
                id=_stable_point_id(chunk.chunk_id),
                vector=vector,
                payload=chunk.model_dump(),
            )
            for chunk, vector in zip(chunks, vectors)
        ]
        self.client.upsert(collection_name=self.collection_name, points=points)

    def search(
        self,
        query_vector: list[float],
        top_k: int,
        query_filter: qmodels.Filter | None = None,
    ) -> list[tuple[DocumentChunk, float]]:
        results = self.client.search(
            collection_name=self.collection_name,
            query_vector=query_vector,
            limit=top_k,
            query_filter=query_filter,
        )
        out = []
        for r in results:
            payload = r.payload or {}
            out.append((DocumentChunk(**payload), float(r.score)))
        return out

    def count(self) -> int:
        return self.client.count(collection_name=self.collection_name).count

    def scroll_all(self) -> list[DocumentChunk]:
        chunks: list[DocumentChunk] = []
        next_offset = None
        while True:
            points, next_offset = self.client.scroll(
                collection_name=self.collection_name, limit=256, offset=next_offset
            )
            chunks.extend(DocumentChunk(**p.payload) for p in points if p.payload)
            if next_offset is None:
                break
        return chunks


def build_filter(topic: str | None = None, authority: str | None = None, jurisdiction: str | None = None) -> Any:
    conditions = []
    if topic:
        conditions.append(qmodels.FieldCondition(key="topic", match=qmodels.MatchText(text=topic)))
    if authority:
        conditions.append(qmodels.FieldCondition(key="authority", match=qmodels.MatchText(text=authority)))
    if jurisdiction:
        conditions.append(qmodels.FieldCondition(key="jurisdiction", match=qmodels.MatchText(text=jurisdiction)))
    if not conditions:
        return None
    return qmodels.Filter(must=conditions)


def _stable_point_id(chunk_id: str) -> int:
    """Qdrant point ids must be int or UUID; derive a stable int from chunk_id."""
    import hashlib

    return int(hashlib.sha1(chunk_id.encode("utf-8")).hexdigest()[:12], 16)

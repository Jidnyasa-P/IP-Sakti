"""
Qdrant vector index wrapper.

Two modes, chosen automatically:
  - QDRANT_URL set  -> Qdrant Cloud.
  - QDRANT_URL unset -> embedded on-disk Qdrant.

This module is intentionally the only place that talks to Qdrant directly.
"""
from __future__ import annotations

import time
import uuid

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from app.config import settings
from app.schemas import DocumentChunk


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

# Small Qdrant upload batches help avoid HTTP write timeouts,
# especially on Qdrant Cloud free tier.
_QDRANT_UPLOAD_BATCH_SIZE = 10

# Number of retries for temporary Qdrant/network failures.
_QDRANT_MAX_RETRIES = 3

# Seconds to wait between retries.
_QDRANT_RETRY_DELAY = 3

# HTTP timeout for Qdrant operations.
_QDRANT_TIMEOUT = 120


_client: QdrantClient | None = None


def _get_client() -> QdrantClient:
    global _client

    if _client is None:
        if settings.qdrant_url:
            _client = QdrantClient(
                url=settings.qdrant_url,
                api_key=settings.qdrant_api_key,
                timeout=_QDRANT_TIMEOUT,
            )
        else:
            _client = QdrantClient(
                path=settings.qdrant_local_path
            )

    return _client


def _point_id(chunk_id: str) -> str:
    """
    Deterministic UUID from chunk_id.

    Re-ingesting the same chunk overwrites the existing point
    instead of creating a duplicate.
    """
    return str(
        uuid.uuid5(
            uuid.NAMESPACE_URL,
            chunk_id,
        )
    )


class VectorIndex:
    def __init__(self, vector_size: int | None = None):
        self.collection = settings.qdrant_collection
        self.client = _get_client()

        if vector_size:
            self._ensure_collection(vector_size)

    def _ensure_collection(self, vector_size: int) -> None:
        existing = {
            c.name
            for c in self.client.get_collections().collections
        }

        if self.collection not in existing:
            self.client.create_collection(
                collection_name=self.collection,
                vectors_config=qmodels.VectorParams(
                    size=vector_size,
                    distance=qmodels.Distance.COSINE,
                ),
            )

            self._ensure_payload_indexes()
            return

        info = self.client.get_collection(self.collection)

        actual_size = info.config.params.vectors.size

        if actual_size != vector_size:
            raise RuntimeError(
                f"Qdrant collection '{self.collection}' has "
                f"vector size {actual_size}, but the configured "
                f"Gemini embedding size is {vector_size}. "
                "Recreate the collection before ingesting."
            )

        self._ensure_payload_indexes()

    def _ensure_payload_indexes(self) -> None:
        """
        Ensure fields used by Qdrant filters have payload indexes.
        """
        try:
            info = self.client.get_collection(self.collection)
            existing = info.payload_schema or {}

            if "document_id" not in existing:
                self.client.create_payload_index(
                    collection_name=self.collection,
                    field_name="document_id",
                    field_schema=qmodels.PayloadSchemaType.KEYWORD,
                    wait=True,
                )

        except Exception as exc:
            raise RuntimeError(
                "Could not create the Qdrant payload index "
                f"for 'document_id': {exc}"
            ) from exc

    def collection_exists(self) -> bool:
        try:
            existing = {
                c.name
                for c in self.client.get_collections().collections
            }
        except Exception:
            return False

        return self.collection in existing

    def _upsert_with_retry(
        self,
        points: list[qmodels.PointStruct],
    ) -> None:
        """
        Upload one small batch to Qdrant with retries.

        A failed batch is retried without affecting already-uploaded
        batches.
        """
        last_error: Exception | None = None

        for attempt in range(1, _QDRANT_MAX_RETRIES + 1):
            try:
                print(
                    f"[qdrant] Uploading {len(points)} points "
                    f"(attempt {attempt}/{_QDRANT_MAX_RETRIES})..."
                )

                self.client.upsert(
                    collection_name=self.collection,
                    points=points,
                    wait=True,
                )

                print(
                    f"[qdrant] Successfully uploaded "
                    f"{len(points)} points."
                )
                return

            except Exception as exc:
                last_error = exc

                print(
                    f"[qdrant] Upload failed on attempt "
                    f"{attempt}/{_QDRANT_MAX_RETRIES}: {exc}"
                )

                if attempt < _QDRANT_MAX_RETRIES:
                    print(
                        f"[qdrant] Retrying in "
                        f"{_QDRANT_RETRY_DELAY}s..."
                    )
                    time.sleep(_QDRANT_RETRY_DELAY)

        raise RuntimeError(
            "Qdrant upload failed after "
            f"{_QDRANT_MAX_RETRIES} attempts. "
            "Already uploaded batches are preserved."
        ) from last_error

    def upsert(
        self,
        chunks: list[DocumentChunk],
        vectors: list[list[float]],
        batch_size: int = _QDRANT_UPLOAD_BATCH_SIZE,
    ) -> None:
        """
        Upload document chunks and vectors to Qdrant.

        Default batch size is intentionally small to prevent
        Qdrant Cloud HTTP write timeouts.
        """
        if len(chunks) != len(vectors):
            raise ValueError(
                f"Chunk/vector count mismatch: "
                f"{len(chunks)} chunks but "
                f"{len(vectors)} vectors."
            )

        if not chunks:
            return

        points = [
            qmodels.PointStruct(
                id=_point_id(chunk.chunk_id),
                vector=vector,
                payload={
                    field: getattr(chunk, field)
                    for field in _PAYLOAD_FIELDS
                },
            )
            for chunk, vector in zip(chunks, vectors)
        ]

        total = len(points)

        for i in range(0, total, batch_size):
            batch = points[i : i + batch_size]

            print(
                f"[qdrant] Batch "
                f"{i + 1}-{i + len(batch)} / {total}"
            )

            self._upsert_with_retry(batch)

    def search(
        self,
        query_vector: list[float],
        top_k: int = 10,
        query_filter: qmodels.Filter | None = None,
    ) -> list[tuple[DocumentChunk, float]]:
        """
        Returns [(chunk, similarity_score)], best first.

        A missing collection or transient Qdrant error returns
        no semantic hits so the pipeline can continue with BM25.
        """
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

        except Exception as exc:
            print(f"[qdrant] Semantic search failed: {exc}")
            return []

        results: list[tuple[DocumentChunk, float]] = []

        for h in hits:
            payload = h.payload or {}

            try:
                chunk = DocumentChunk(
                    **{
                        field: payload.get(field)
                        for field in _PAYLOAD_FIELDS
                    }
                )
            except Exception:
                continue

            results.append(
                (
                    chunk,
                    float(h.score),
                )
            )

        return results

    def delete_document(self, document_id: str) -> None:
        """
        Delete every vector belonging to one legal source document.
        """
        if not self.collection_exists():
            return

        selector = qmodels.FilterSelector(
            filter=qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="document_id",
                        match=qmodels.MatchValue(
                            value=document_id
                        ),
                    )
                ]
            )
        )

        self.client.delete(
            collection_name=self.collection,
            points_selector=selector,
            wait=True,
        )
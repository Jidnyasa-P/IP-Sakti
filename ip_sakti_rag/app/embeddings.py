"""
Embedding client for IP-SAKTI.

The Qdrant collection `ip_sakti_chunks` was already built with:
    sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
    384 dimensions, cosine distance, via FastEmbed.

This file deliberately keeps that exact model and vector dimension. The only
change is WHERE inference runs: Render no longer loads the local FastEmbed
model. Instead, it calls the dedicated Hugging Face embedding service.

This is intentionally compatible with the existing Qdrant collection, so no
re-ingestion is required merely to deploy the service this way.
"""
from __future__ import annotations

import time
from typing import Any

import requests

from app.config import settings

EMBED_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
EMBED_DIM = 384
_BATCH_SIZE = 32


def _embedding_url() -> str:
    url = (settings.embedding_service_url or "").strip().rstrip("/")
    if not url:
        raise RuntimeError(
            "EMBEDDING_SERVICE_URL is not configured. "
            "Set it to the deployed IP-SAKTI Hugging Face embedding service."
        )
    return url


def _headers() -> dict[str, str]:
    token = (settings.embedding_service_token or "").strip()
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}


def _post_embeddings(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    url = f"{_embedding_url()}/embed"
    timeout = max(10, int(settings.embedding_service_timeout))
    last_error: Exception | None = None

    # A small retry protects the RAG request from transient HF wake/network
    # failures without changing any retrieval behaviour.
    for attempt in range(1, 3):
        try:
            response = requests.post(
                url,
                json={"texts": texts},
                headers=_headers(),
                timeout=timeout,
            )
            response.raise_for_status()
            payload: Any = response.json()
            vectors = payload.get("embeddings")

            if not isinstance(vectors, list) or len(vectors) != len(texts):
                raise RuntimeError(
                    "Embedding service returned an invalid embedding count: "
                    f"expected {len(texts)}, got "
                    f"{len(vectors) if isinstance(vectors, list) else 'non-list'}"
                )

            for i, vector in enumerate(vectors):
                if not isinstance(vector, list) or len(vector) != EMBED_DIM:
                    raise RuntimeError(
                        "Embedding dimension mismatch at item "
                        f"{i}: expected {EMBED_DIM}, got "
                        f"{len(vector) if isinstance(vector, list) else 'non-list'}"
                    )

            return [[float(value) for value in vector] for vector in vectors]
        except Exception as exc:
            last_error = exc
            if attempt == 1:
                time.sleep(0.75)

    raise RuntimeError(f"Embedding service request failed: {last_error}") from last_error


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch-embed texts through the remote FastEmbed service."""
    if not texts:
        return []

    out: list[list[float]] = []
    for i in range(0, len(texts), _BATCH_SIZE):
        batch = texts[i : i + _BATCH_SIZE]
        print(
            f"[embed] Requesting {i + 1}-{i + len(batch)} / {len(texts)} "
            "from remote embedding service"
        )
        out.extend(_post_embeddings(batch))

    return out


def embed_query(text: str) -> list[float]:
    """Embed one live user query in the same 384-D vector space as Qdrant."""
    vectors = _post_embeddings([text])
    return vectors[0]


def get_embedding_dimension() -> int:
    return EMBED_DIM

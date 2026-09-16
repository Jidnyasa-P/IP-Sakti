"""Gemini embeddings with a conservative free-tier rate limiter."""
from __future__ import annotations

import time
from collections import deque

from google import genai
from google.genai import types

from app.config import settings

EMBED_MODEL = "gemini-embedding-001"
EMBED_DIM = 768

# Keep API batches small because legal chunks contain substantially
# more tokens than simple test strings.
_BATCH_SIZE = 10

# Conservative request/content limiter.
_MAX_EMBEDDINGS_PER_WINDOW = 60
_WINDOW_SECONDS = 60.0

_request_times: deque[float] = deque()
_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client

    if _client is None:
        if not settings.LLM_API_KEY:
            raise RuntimeError(
                "LLM_API_KEY is not set. It is required for Gemini embeddings "
                "and answer generation."
            )

        _client = genai.Client(api_key=settings.LLM_API_KEY)

    return _client


def _wait_for_rate_limit(num_embeddings: int) -> None:
    while True:
        now = time.monotonic()

        while (
            _request_times
            and now - _request_times[0] >= _WINDOW_SECONDS
        ):
            _request_times.popleft()

        if len(_request_times) + num_embeddings <= _MAX_EMBEDDINGS_PER_WINDOW:
            return

        wait_for = _WINDOW_SECONDS - (now - _request_times[0])

        print(
            f"[embed] Rate-limit pause: waiting "
            f"{wait_for:.1f}s before the next Gemini batch..."
        )

        time.sleep(max(wait_for, 0.1))


def _record_embeddings(num_embeddings: int) -> None:
    now = time.monotonic()

    for _ in range(num_embeddings):
        _request_times.append(now)


def _embed_batch(
    texts: list[str],
    task_type: str,
) -> list[list[float]]:
    if not texts:
        return []

    _wait_for_rate_limit(len(texts))

    print(
        f"[embed] Gemini batch: "
        f"{len(texts)} embeddings"
    )

    try:
        result = _get_client().models.embed_content(
            model=EMBED_MODEL,
            contents=texts,
            config=types.EmbedContentConfig(
                task_type=task_type,
                output_dimensionality=EMBED_DIM,
            ),
        )

    except Exception as exc:
        message = str(exc)

        if "429" in message or "RESOURCE_EXHAUSTED" in message:
            raise RuntimeError(
                "Gemini embedding quota/rate limit reached. "
                "The current batch was not saved. "
                "Wait for the quota to reset or use a project with "
                "available Gemini Embedding quota, then run "
                "`python scripts/ingest.py` again. "
                "Previously completed batches are preserved."
            ) from exc

        raise

    embeddings = [embedding.values for embedding in result.embeddings]

    if len(embeddings) != len(texts):
        raise RuntimeError(
            f"Gemini returned {len(embeddings)} embeddings for "
            f"{len(texts)} input texts."
        )

    _record_embeddings(len(texts))

    return embeddings


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    out: list[list[float]] = []

    for i in range(0, len(texts), _BATCH_SIZE):
        batch = texts[i : i + _BATCH_SIZE]

        print(
            f"[embed] Processing embeddings "
            f"{i + 1}-{i + len(batch)} / {len(texts)}"
        )

        out.extend(
            _embed_batch(
                batch,
                task_type="RETRIEVAL_DOCUMENT",
            )
        )

        # Small pause between batches to avoid sending many
        # embedding requests back-to-back.
        if i + _BATCH_SIZE < len(texts):
            time.sleep(2)

    return out


def embed_query(text: str) -> list[float]:
    return _embed_batch(
        [text],
        task_type="RETRIEVAL_QUERY",
    )[0]


def get_embedding_dimension() -> int:
    return EMBED_DIM
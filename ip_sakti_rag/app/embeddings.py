"""
Gemini API embeddings with rate-limit protection and resume-safe batching.

Uses gemini-embedding-001 with 768-dimensional output.
"""

from __future__ import annotations

import time
from collections import deque

from google import genai
from google.genai import types
from app.config import settings


EMBED_MODEL = "gemini-embedding-001"
EMBED_DIM = 768

# Gemini free tier allows 100 embedding requests/contents per minute.
# Keep a safety margin so we don't hit the limit.
_BATCH_SIZE = 80
_MAX_EMBEDDINGS_PER_WINDOW = 90
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
    """
    Prevent exceeding the Gemini free-tier embedding request/content limit.

    We track the number of embedding contents sent during the previous
    60-second window and wait before sending another batch if necessary.
    """

    while True:
        now = time.monotonic()

        # Remove timestamps outside the current 60-second window.
        while _request_times and now - _request_times[0] >= _WINDOW_SECONDS:
            _request_times.popleft()

        used = len(_request_times)

        if used + num_embeddings <= _MAX_EMBEDDINGS_PER_WINDOW:
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
        f"[embed] Gemini batch 1-{len(texts)} / {len(texts)}"
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
        # Do not blindly retry quota errors.
        # The ingestion layer already saves progress after every
        # successful batch, so the command can safely be run again.
        if "429" in str(exc) or "RESOURCE_EXHAUSTED" in str(exc):
            raise RuntimeError(
                "Gemini embedding quota/rate limit reached. "
                "Wait for the quota window to reset and run "
                "`python scripts/ingest.py` again. "
                "Previously completed batches are preserved."
            ) from exc

        raise

    _record_embeddings(len(texts))

    return [embedding.values for embedding in result.embeddings]


def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Embed documents in controlled batches.

    The ingestion system saves each completed batch, so this function
    only needs to successfully process the supplied texts.
    """

    if not texts:
        return []

    out: list[list[float]] = []

    for i in range(0, len(texts), _BATCH_SIZE):
        batch = texts[i : i + _BATCH_SIZE]

        vectors = _embed_batch(
            batch,
            task_type="RETRIEVAL_DOCUMENT",
        )

        out.extend(vectors)

    return out


def embed_query(text: str) -> list[float]:
    """
    Embed a user search query.
    """

    return _embed_batch(
        [text],
        task_type="RETRIEVAL_QUERY",
    )[0]


def get_embedding_dimension() -> int:
    return EMBED_DIM
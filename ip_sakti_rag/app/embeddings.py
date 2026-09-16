"""
Gemini API embeddings (gemini-embedding-001) — multilingual (English/Hindi/
Marathi), replacing the local `sentence-transformers` model that lived in
app/ingestion/embed_and_index.py and app/retrieval/hybrid.py.

Called over the network, so no ~470MB+ model is ever loaded into the
process — keeps this service inside Render's free-tier 512MB RAM limit.
Reuses LLM_API_KEY (the same Gemini key already used for generation in
app/generation/llm_client.py) so there's only one key to manage.

Pinned to 768 output dimensions: gemini-embedding-001 defaults to 3072-dim
output, which would silently mismatch any Qdrant collection already created
for a smaller size, and unnecessarily bloats storage/search cost.
"""
from __future__ import annotations

from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings

EMBED_MODEL = "gemini-embedding-001"
EMBED_DIM = 768
_BATCH_SIZE = 32  # keep request bodies small — see vector_index.py upsert batching for why

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not settings.LLM_API_KEY:
            raise RuntimeError(
                "LLM_API_KEY is not set. It's required for embeddings "
                "(gemini-embedding-001) as well as answer generation."
            )
        _client = genai.Client(api_key=settings.LLM_API_KEY)
    return _client


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
def _embed_batch(texts: list[str], task_type: str) -> list[list[float]]:
    result = _get_client().models.embed_content(
        model=EMBED_MODEL,
        contents=texts,
        config=types.EmbedContentConfig(
            task_type=task_type,  # must be UPPERCASE: RETRIEVAL_DOCUMENT / RETRIEVAL_QUERY
            output_dimensionality=EMBED_DIM,
        ),
    )
    return [e.values for e in result.embeddings]


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch-embed corpus chunks at ingest time."""
    if not texts:
        return []
    out: list[list[float]] = []
    for i in range(0, len(texts), _BATCH_SIZE):
        out.extend(_embed_batch(texts[i : i + _BATCH_SIZE], task_type="RETRIEVAL_DOCUMENT"))
    return out


def embed_query(text: str) -> list[float]:
    """Embed a single live user query."""
    return _embed_batch([text], task_type="RETRIEVAL_QUERY")[0]


def get_embedding_dimension() -> int:
    return EMBED_DIM

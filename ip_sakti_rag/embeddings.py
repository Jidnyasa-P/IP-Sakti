"""
Embedding layer for IP-SAKTI.

Uses Google's gemini-embedding-001 (multilingual: 100+ languages, so it
covers English/Hindi/Marathi today and the rest of the 22-language target
later) via API calls, so no model weights are loaded into the process.
This keeps the service inside Render's free-tier 512MB RAM limit.

NOTE (2026-09): the previous model, text-embedding-004, was shut down by
Google on 2026-01-14. gemini-embedding-001 is its GA replacement. It
defaults to 3072-dim output; we ask for a truncated 768-dim vector via
output_dimensionality so it matches EMBED_DIM used by the Qdrant
collection below and doesn't require re-sizing anything downstream.

If you later move off the free tier and want a local, zero-cost-per-call
model instead, swap the body of embed_text()/embed_query() for a
fastembed.TextEmbedding("intfloat/multilingual-e5-small") call — the rest
of the codebase (retrieval.py, ingest.py) only depends on this module's
function signatures, not on how the vector is produced.
"""
import os

from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential

# LLM_API_KEY is the env var name used across this project (.env / Render
# dashboard). The new google-genai SDK does NOT auto-read LLM_API_KEY (it
# only auto-reads GOOGLE_API_KEY / GEMINI_API_KEY), so we pass it in
# explicitly rather than relying on an env var name it doesn't know about.
_API_KEY = os.environ.get("LLM_API_KEY")
if not _API_KEY:
    raise RuntimeError(
        "LLM_API_KEY is not set. Copy .env.example to .env and fill in a "
        "free Google AI Studio API key (https://aistudio.google.com/apikey)."
    )

client = genai.Client(api_key=_API_KEY)

EMBED_MODEL = "gemini-embedding-001"  # GA model; replaced text-embedding-004 (shut down 2026-01-14)
EMBED_DIM = 768  # truncated via output_dimensionality below (model default is 3072)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
def embed_text(text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> list[float]:
    """Embed a corpus chunk at ingest time."""
    result = client.models.embed_content(
        model=EMBED_MODEL,
        contents=text,
        config=types.EmbedContentConfig(
            task_type=task_type,
            output_dimensionality=EMBED_DIM,
        ),
    )
    # The new SDK returns a dedicated response object where embeddings are accessed via dot notation
    return result.embeddings[0].values


def embed_query(text: str) -> list[float]:
    """Embed a live user query. Different task_type improves retrieval quality."""
    return embed_text(text, task_type="RETRIEVAL_QUERY")

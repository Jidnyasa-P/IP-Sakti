"""
Embedding layer for IP-SAKTI.

Uses Google's text-embedding-004 (multilingual: English/Hindi/Marathi all
supported) via API calls, so no model weights are loaded into the process.
This keeps the service inside Render's free-tier 512MB RAM limit.

If you later move off the free tier and want a local, zero-cost-per-call
model instead, swap the body of embed_text()/embed_query() for a
fastembed.TextEmbedding("intfloat/multilingual-e5-small") call — the rest
of the codebase (retrieval.py, ingest.py) only depends on this module's
function signatures, not on how the vector is produced.
"""
import os
from google import genai
from tenacity import retry, stop_after_attempt, wait_exponential

# The new SDK automatically picks up GEMINI_API_KEY from os.environ
client = genai.Client()

EMBED_MODEL = "gemini-embedding-001"   # current GA model, replaced text-embedding-004
EMBED_DIM = 768                         # keep 768 by requesting a reduced dimension

result = client.models.embed_content(
    model=EMBED_MODEL,
    contents=text,
    config={"task_type": task_type, "output_dimensionality": EMBED_DIM},
)



@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
def embed_text(text: str, task_type: str = "retrieval_document") -> list[float]:
    """Embed a corpus chunk at ingest time."""
    result = client.models.embed_content(
        model=EMBED_MODEL,
        contents=text,
        config={"task_type": task_type}
    )
    # The new SDK returns a dedicated response object where embeddings are accessed via dot notation
    return result.embeddings[0].values


def embed_query(text: str) -> list[float]:
    """Embed a live user query. Different task_type improves retrieval quality."""
    return embed_text(text, task_type="retrieval_query")

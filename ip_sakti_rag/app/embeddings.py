"""
Local, free, multilingual embeddings via fastembed (Qdrant's own ONNX-based
embedding library) — replaces the Gemini API embedder.

WHY THIS CHANGE: Gemini's gemini-embedding-001 free tier is capped at
1,000 requests/day (RPD), on top of 100 RPM / 30,000 TPM (Google AI Studio,
checked Sept 2026 — Google no longer publishes a single canonical number in
its docs, so re-verify at https://ai.google.dev/gemini-api/docs/rate-limits
if this ever seems off). A corpus of 36 real statutory PDFs chunked at
paragraph/section granularity produces far more than 1,000 chunks, so a full
ingest run was guaranteed to hit the daily cap partway through, no matter
how well-behaved the RPM-side rate limiter (the deque-based one previously
in this file) was — that limiter only prevented 429s *within* a day, it
had no way to get around the 1,000/day ceiling itself.

fastembed runs the embedding model as a local ONNX file: no network call,
no API key, no rate limit of any kind, no per-request cost — it is
genuinely unlimited, not just "generous". The trade-off is RAM: the model
(~450MB on disk) has to be loaded into memory, which matters if you deploy
this service on a RAM-constrained host (see the free-tier RAM note in
EMBEDDINGS_MIGRATION_AND_INGESTION_GUIDE.md — this is the real cost of
"unlimited", there's no way around needing RAM for a local model).

BREAKING CHANGE: gemini-embedding-001 produced 768-dim vectors; this model
produces 384-dim vectors. These are not compatible — you cannot mix vectors
from the two models in one Qdrant collection, and a query embedded with one
model against a corpus embedded with the other returns meaningless
similarity scores. The existing `ip_sakti_chunks` Qdrant collection
(partially populated from the old Gemini attempts) MUST be deleted and the
full corpus re-ingested from scratch after this change. See the migration
guide for the exact commands.

MODEL CHOICE, VERIFIED against the real library (not assumed from memory):
`intfloat/multilingual-e5-small` — my first instinct — turned out not to be
in fastembed's actual supported-model catalog at all (only the 2.24GB
`multilingual-e5-large` is, which is too large for a RAM-constrained free
host). I checked `TextEmbedding.list_supported_models()` against the real
installed `fastembed==0.8.0` package to find every genuinely-supported
multilingual option, sorted by size. The smallest real one is this model:
`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` — 0.22GB,
384-dim, ~50 languages including Hindi and Marathi, and — unlike the E5
family — it does NOT need "query: "/"passage: " prefixes on the text, so
there's one less way to silently degrade retrieval quality by getting a
prefix convention wrong.
"""
from __future__ import annotations

from fastembed import TextEmbedding

from app.config import settings

EMBED_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"  # 384-dim, ~50 languages incl. Hindi & Marathi
EMBED_DIM = 384

# fastembed batches internally and is CPU-bound, not network-bound, so this
# just controls how much text is held in memory per call, not a rate limit.
_BATCH_SIZE = 32

_model: TextEmbedding | None = None


def _get_model() -> TextEmbedding:
    global _model
    if _model is None:
        cache_dir = settings.fastembed_cache_dir
        print(f"[embed] Loading {EMBED_MODEL} (fastembed/ONNX, local, cache: {cache_dir}) ...")
        # threads=1: caps onnxruntime's internal thread pool. Render's free
        # tier gives you 0.1 shared vCPU — onnxruntime's default of "one
        # thread per core" tries to spin up several threads regardless, and
        # each one carries its own memory overhead (thread stacks + duplicated
        # execution-plan buffers) for no real speed benefit on a fractional
        # CPU. This is a real, if modest, RAM saving, not a full fix for an
        # actual OOM on its own — see RENDER_502_TROUBLESHOOTING.md.
        _model = TextEmbedding(model_name=EMBED_MODEL, cache_dir=cache_dir, threads=1)
        print("[embed] Model loaded.")
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch-embed corpus chunks at ingest time. No prefix needed (see
    module docstring) — raw chunk text goes in as-is."""
    if not texts:
        return []

    model = _get_model()
    out: list[list[float]] = []

    for i in range(0, len(texts), _BATCH_SIZE):
        batch = texts[i : i + _BATCH_SIZE]
        print(f"[embed] Embedding {i + 1}-{i + len(batch)} / {len(texts)} (local — no rate limit)")
        out.extend(vec.tolist() for vec in model.embed(batch))

    return out


def embed_query(text: str) -> list[float]:
    model = _get_model()
    vec = next(iter(model.embed([text])))
    return vec.tolist()


def get_embedding_dimension() -> int:
    return EMBED_DIM

# Free Local Embeddings Migration + Ingestion Guide

## 1. Why Gemini embeddings were blocking full ingestion (verified, Sept 2026)

Checked directly against Google's current docs
(https://ai.google.dev/gemini-api/docs/rate-limits) rather than assumed from
memory, since Google has stopped publishing one canonical number and it
changes: **`gemini-embedding-001`'s free tier is 100 RPM / 30,000 TPM /
1,000 RPD (requests per day)**, resetting at midnight Pacific — not your
local midnight. Note this is *separate* from Gemini's text-generation free
tier (Flash/Flash-Lite models, ~500-1,500 RPD depending on model) — you're
not close to that limit, this was specifically an embeddings problem.

Your 36 real statutory PDFs, chunked at section/paragraph granularity,
produce far more than 1,000 chunks. Even batching multiple chunks per API
call (the existing `_BATCH_SIZE`/rate-limiter in the old `app/embeddings.py`
already did this) doesn't get around the 1,000-**requests**-per-day ceiling
— it only prevented 429s *within* a day, not across the whole job. That's
why the run always stalled partway through, and why it needed either
multiple days to finish (the resume-safe ingestion logic already handles
that — see `app/ingestion/embed_and_index.py`'s progress tracking) or, what
you asked for: a way to not have this ceiling at all.

## 2. The fix: local embeddings via fastembed (genuinely unlimited)

`app/embeddings.py` now runs the embedding model as a local ONNX file via
`fastembed` (Qdrant's own embedding library) instead of calling an API. No
network call per chunk, no API key, no rate limit of any kind — it's
unlimited because there's no request being metered at all.

**Model choice — verified against the real library, not assumed:**
I first considered `intfloat/multilingual-e5-small` (a common recommendation
online), but checked `fastembed.TextEmbedding.list_supported_models()`
against an actual `fastembed==0.8.0` install and found it isn't in the
catalog under that name at all — only the 2.24GB `multilingual-e5-large`
is, which is too large for a RAM-constrained free host. The smallest
genuinely-supported multilingual model in the real catalog is:

```
sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
  384 dimensions, 0.22GB on disk, ~50 languages including Hindi and Marathi,
  no query/passage prefix convention needed (simpler and safer than E5).
```

That's what's wired in. `EMBED_DIM` is now `384` (was `768` under Gemini).

**Gemini stays as your LLM** — `app/generation/llm_client.py` and the
reranker are untouched, still using `google-genai`. Only the *embedding*
call moved.

## 3. This is a breaking, one-time migration — do these steps in order

Switching embedding models changes the vector space entirely. A 384-dim
local-model vector and a 768-dim Gemini vector are not just different
sizes, they're not comparable at all — mixing them in one collection
produces meaningless search results (and Qdrant will reject the dimension
mismatch outright on upsert, which is the *good* failure mode; silent
nonsense results would be the bad one, so you're safe from that specific
risk, but you do need to start clean).

```bash
cd ip_sakti_rag

# 1. Install the new dependencies (fastembed + its deps -- see the updated
#    requirements.txt / requirements-server.txt for exact versions)
pip install -r requirements.txt

# 2. Delete the old Qdrant collection (it has a partial set of 768-dim
#    vectors from the stalled Gemini runs -- must not be reused)
python -c "
from qdrant_client import QdrantClient
from app.config import settings
client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key) if settings.qdrant_url else QdrantClient(path=settings.qdrant_local_path)
client.delete_collection(settings.qdrant_collection)
print('Deleted', settings.qdrant_collection)
"

# 3. Clear local ingestion state -- the resume-safe progress tracking
#    (data/processed/embedding_progress.json, ingestion_state.json) and the
#    previously-written chunks.jsonl were all produced against the old
#    768-dim model and must not be reused as a "resume point" for the new one.
rm -f data/processed/chunks.jsonl data/processed/documents.jsonl \
      data/processed/ingestion_state.json data/processed/embedding_progress.json

# 4. Full clean re-ingest. The first run downloads the ~220MB model file
#    once (cached under ./.fastembed_cache by default -- see
#    fastembed_cache_dir in app/config.py) then reuses it for every chunk.
python scripts/ingest.py --force
```

You should see `[embed] Loading sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 ...`
once at the start, then a steady stream of `[embed] Embedding N-M / total
(local -- no rate limit)` lines with **no pauses for rate limiting** and no
`429`/`RESOURCE_EXHAUSTED` errors possible, because there's no API call to
throttle. All 36 documents should complete in one run.

## 4. Verify ingestion completed -- section-wise, for your citation UI

New script, `scripts/ingestion_report.py`, included in the zip:

```bash
python scripts/ingestion_report.py
```

Prints a table -- one row per document in `manifest.json` -- showing chunk
count, distinct section count, and whether it actually indexed (catches
silent skips, e.g. a PDF listed in the manifest but missing from
`data/documents/`). It also cross-checks the chunk count against Qdrant's
live point count, so a partially-completed upsert (network blip mid-run)
shows up as a mismatch instead of going unnoticed.

For one document's full section-by-section list -- exactly what your
frontend's citation cards will show (`title`, `section`, `page`,
`document_id` per chunk, from `app/schemas.py`'s `DocumentChunk`):

```bash
python scripts/ingestion_report.py --document DOC-PATENTS-ACT-1970
```
(use a real `document_id` from the table -- these come from your
`manifest.json`, e.g. `DOC-PATENTS-ACT-1970`, `DOC-NBA-ACT`, etc.)

Run this after every ingest -- it's the fastest way to catch a citation
problem (wrong section label, a document that silently produced zero
chunks) before a user sees a bad or missing citation in the app.

## 5. How section-wise citations already flow through (nothing more to build)

Your indexing already carries section-level metadata all the way through --
this was built correctly before this change and isn't affected by the
embedding swap:

```
PDF -> extract_text() -> legal_aware_chunk()          [app/ingestion/chunker.py:
                                                         splits on detected section/
                                                         rule/article boundaries]
     -> DocumentChunk(section=..., page=..., ...)      [app/ingestion/embed_and_index.py]
     -> embedded + upserted to Qdrant with full payload  [app/embeddings.py + vector_index.py]
     -> HybridRetriever.retrieve() returns top_chunks    [app/retrieval/hybrid.py]
     -> Citation(index, chunk_id, document_id, title,
                 authority, section, source, excerpt, page)  [app/pipeline.py]
     -> returned in RAGResponse.citations / .evidence / .sources
     -> backend/ passes it straight through (no reshaping -- see
        backend/app/api/routes/products.py, chat.py)
     -> frontend's Citation type (frontend/src/types.ts) renders it
```

So "section-wise citation" isn't a new feature to add -- it already works
end to end, *provided the ingested data itself is right*, which is exactly
what step 4's report verifies. If a citation on the live site still looks
wrong after a clean re-ingest that the report confirms is complete, the bug
is in chunking/section-labeling logic (`app/ingestion/chunker.py`) for that
specific document's formatting, not in retrieval or the frontend -- narrow
it down with `--document <id>` and look at whether `section` labels for
that PDF are sensible.

## 6. The RAM trade-off -- read this before deploying

This is the part I won't gloss over: "free and unlimited" (a local model)
and "free but rate-limited" (an API) are the only two truly free options
for embeddings. You've now picked unlimited, which is paid for in RAM
instead of quota. The chosen model is the smallest genuinely-multilingual
one available (~220MB on disk), specifically to make this as survivable as
possible on a small host -- but I have not been able to measure its actual
runtime RAM footprint on Render's specific free-tier container in this
conversation, so:

**Test it for real before assuming it works**: deploy `ip-sakti-rag` to
Render free tier with these changes, hit `/api/health`, then send a real
`/api/chat` request (which calls `embed_query()`) and watch Render's
metrics/logs for an out-of-memory kill. If it fits, you're done -- no
further action needed.

**If it doesn't fit**, in order of how much they change:
1. **Render's Starter plan** ($7/mo, 2GB RAM) -- simplest, no architecture
   change, just enough headroom.
2. **A different free host with more RAM**: Oracle Cloud's "Always Free"
   tier includes genuinely-free compute instances with 1GB+ RAM (up to 24GB
   on their ARM Ampere free shape, subject to regional availability) -- a
   real, permanent free tier, not a trial. Migrating one FastAPI service to
   a Compute VM is more setup work than Render's PaaS flow, but removes the
   RAM ceiling entirely. Fly.io is another option worth a look, with its
   own separate free allowances.
3. **Fall back to the previous Gemini-API embeddings for query time only**,
   keeping fastembed for ingestion. This does NOT work as a mix, per
   section 3 above -- but you could re-embed the corpus with Gemini once
   ingestion succeeds locally with no daily-limit pressure (you're only
   doing it once, not resuming across multiple rate-limited days), then
   only pay Gemini's RPD cost per live user query in production (much
   lower volume than bulk ingestion, likely to stay under 1,000/day for a
   while). This gets you back to zero local RAM cost at query time, at the
   cost of reintroducing a (much smaller) daily ceiling later if traffic
   grows. Say the word if you want this hybrid wired up instead.

## 7. Checklist

- [ ] `pip install -r requirements.txt` (or `requirements-server.txt` for
      deployment) succeeds
- [ ] Old Qdrant collection deleted, old `data/processed/*` files cleared
- [ ] `python scripts/ingest.py --force` completes all 36 documents with
      zero rate-limit pauses or errors
- [ ] `python scripts/ingestion_report.py` shows every document with a
      nonzero chunk count and Qdrant point count matching `chunks.jsonl`
- [ ] `python scripts/ingestion_report.py --document <a real id>` shows
      sensible section labels
- [ ] Local `/api/chat` test returns a real cited answer
- [ ] Deployed to Render free tier, `/api/health` and a real `/api/chat`
      request both succeed without an OOM kill (section 6)

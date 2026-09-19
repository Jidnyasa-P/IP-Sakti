# Embeddings Revert + Citation Verification Links — Fix Guide

## 1. The 502s — CONFIRMED root cause (Render's own notification, not a guess this time)

> "Web Service ip-sakti-rag exceeded its memory limit, which triggered an
> automatic restart."

This is definitive: `ip-sakti-rag` was being OOM-killed. The local
`fastembed` model (`paraphrase-multilingual-MiniLM-L12-v2`, ~220MB on
disk) -- even after the `threads=1` mitigation from last round, even as the
smallest genuinely-multilingual model fastembed offers -- did not reliably
fit in Render free tier's 512MB alongside FastAPI, the BM25 index (7,747
chunks), and the Qdrant/Neo4j/Mongo clients. I looked for a smaller
multilingual local model and a way to offload embedding to Qdrant Cloud's
own free inference (which would remove the RAM cost entirely) -- Qdrant
Cloud Inference is real and does have free models even on free-tier
clusters, but I verified (via Qdrant's own current documentation) that its
free models are `all-MiniLM-L6-v2`, `mxbai-embed-large-v1`, `splade-pp-en-v1`,
and `bm25` -- **none of them multilingual**. Using one would solve the RAM
problem but silently break Hindi/Marathi semantic search quality, since an
English-only model doesn't map Hindi/Marathi text into the same vector
space as the English corpus.

**Decision: reverted to the Gemini API for embeddings** (`app/embeddings.py`).
A network call has zero local RAM footprint -- this removes the OOM failure
mode entirely rather than continuing to trim around its edges. The
trade-off, stated plainly: Gemini's free tier caps embedding calls at
1,000/day. But your actual usage is asymmetric -- ingestion is a ~7,700-call
one-time job (or only when the corpus changes), while live traffic is one
embedding call per user chat/analysis request, a much lower volume. The
daily cap is a real cost at ingestion time (spread over several days,
resumed automatically -- your `ingest.py` already handles this) but unlikely
to bite at query time for a project at this traffic level.

## 2. Migration steps -- do these in order (breaking change, again)

Vectors from `paraphrase-multilingual-MiniLM-L12-v2` and
`gemini-embedding-001` are completely incompatible -- different models,
different vector spaces, not just different sizes.

```bash
cd ip_sakti_rag

# 1. Update dependencies -- this REMOVES fastembed/onnxruntime (the biggest
#    win: this is what was consuming the RAM) and keeps google-genai.
pip install -r requirements-server.txt   # matches what Render will install

# 2. Delete the existing (fastembed-embedded) Qdrant collection
python -c "
from qdrant_client import QdrantClient
from app.config import settings
client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key) if settings.qdrant_url else QdrantClient(path=settings.qdrant_local_path)
client.delete_collection(settings.qdrant_collection)
print('Deleted', settings.qdrant_collection)
"

# 3. Clear local ingestion state so it doesn't try to "resume" a run made
#    with a different embedding model
rm -f data/processed/chunks.jsonl data/processed/documents.jsonl \
      data/processed/ingestion_state.json data/processed/embedding_progress.json

# 4. Re-ingest. This WILL hit the 1,000/day cap partway through given your
#    corpus size -- that's expected, not a bug. When it does, you'll see a
#    clear message from DailyQuotaExhausted (app/embeddings.py) telling you
#    to come back after the reset. Just re-run the same command the next
#    day (Pacific midnight reset) -- it resumes from where it stopped.
python scripts/ingest.py --force
# ... next day, if it stopped ...
python scripts/ingest.py
```

Run `python scripts/ingestion_report.py` (from an earlier round -- should
still be in your `scripts/` folder) after it finishes to confirm all
documents ingested with reasonable section counts, cross-checked against
Qdrant's live point count.

## 3. Deploy

On Render, `ip-sakti-rag`'s build command should point at
`requirements-server.txt` (not `requirements.txt`, which is the
ingestion-only, heavier one). If it's currently pointed at
`requirements.txt`, switch it -- this alone removes fastembed/onnxruntime
from what gets installed on the live server, which is most of the RAM win.

No new environment variables needed -- `LLM_API_KEY` was already required
for generation and is now reused for embeddings too, same as several
rounds ago.

## 4. Citation verification -- what you asked for, largely already existed

Good news here: your repo already has a `CitationModal.tsx` component,
correctly wired to open on citation click (`setActiveCitation` in
`App.tsx`), that shows:
- the real retrieved passage (`citation.excerpt` -- this comes from the
  actual `DocumentChunk` your RAG pipeline retrieved from Qdrant, not
  fabricated text -- see `ip_sakti_rag/app/pipeline.py`'s citation
  construction)
- extended document metadata fetched from `/api/documents/{document_id}`,
  which proxies to `ip_sakti_rag`'s real, ingested document records
- a link to the official government source (fixed last round in
  `sectionLinks.tsx` -- verified India Code / ministry links, no more
  guessed IndianKanoon IDs)

**What was missing, now added**: a second link to the actual **source PDF
file** you ingested -- not just a description of the Act, the literal file.
New endpoint chain:
```
ip_sakti_rag/main.py:  GET /api/documents/{document_id}/source
  -> looks up the filename in manifest.json, streams the real PDF from
     data/documents/ via FastAPI's FileResponse

backend/app/rag_client.py + rag_routes.py: proxies that file through
  GET /api/documents/{document_id}/source (same path, backend-side)

frontend/CitationModal.tsx: "View Source PDF" button, opens it in a new
  tab via a blob URL (NOT a plain <a href> -- that endpoint requires your
  login token, and a normal browser navigation can't attach an
  Authorization header, so a plain link would just 401. Used authFetch +
  URL.createObjectURL instead, same pattern as the rest of the app.)
```

So the modal now shows, per citation: the real excerpt (traceable to
Qdrant), a link to the actual ingested PDF, and a link to the official
government page -- literally "verification link to the docx and website
both," as asked. This should already work as soon as the OOM fix above is
deployed; you likely haven't been able to see it working yet because the
backend has been 502ing on every RAG-backed request.

**One honest limitation**: the `document_id -> filename` lookup depends on
`data/documents/manifest.json` still being present and accurate on
whichever machine `ip_sakti_rag` runs on. Since Render's free tier has no
persistent disk, **you need `data/documents/` (the actual PDFs, not just
the processed chunks) committed to your git repo** for this endpoint to
find them in production -- check that your `.gitignore` isn't excluding
that folder. If it is, the citation excerpts will still work (they come
from `chunks.jsonl`), but "View Source PDF" will 404.

## 5. Other errors in your list -- status

- **CORS ("blocked by CORS policy")**: not present in this round's error
  list -- looks like setting `FRONTEND_ORIGIN` last round fixed it. If it
  reappears, re-check that env var on `ip-sakti-backend`.
- **`404` on `/api/conversations/conv-india-1789813312759`**: this ID
  pattern (`conv-india-<timestamp>`) looks like a client-side-generated
  temporary conversation ID that was never actually created via `POST
  /api/conversations` before the frontend tried to `GET` it -- likely a
  stale reference from local storage or a race condition in the "new
  chat" flow, not a backend bug (the backend correctly 404s on a
  conversation that doesn't exist). Low priority: check if it self-heals
  by starting a fresh conversation; if it persists and blocks real usage,
  send me the exact click sequence that reproduces it and I'll trace the
  frontend logic that generates that ID.
- **The bare `500`**: no specific endpoint was named for this one. Once
  the OOM fix is deployed, check `ip-sakti-backend`'s logs for this
  specific error (the CORS-safe exception handler from last round logs
  the full traceback server-side even though it hides it from the
  client) -- if it's still happening, send me that traceback.

## 6. Checklist

- [ ] `ip-sakti-rag`'s Render build command points at `requirements-server.txt`
- [ ] Old Qdrant collection deleted, `data/processed/*` cleared
- [ ] Re-ingestion started (`python scripts/ingest.py --force`), expect it to pause on the daily cap and need re-runs across a few days
- [ ] `data/documents/` (the real PDFs) confirmed present in git, not gitignored
- [ ] After a successful ingest: `/api/chat` and `/api/products/analyze` return real answers, no 502
- [ ] Click a citation -> modal opens -> "View Source PDF" opens the real PDF, "Official Government Source" opens the correct India Code / ministry page
- [ ] Watch Render logs once for the unexplained bare `500`, report back if it persists

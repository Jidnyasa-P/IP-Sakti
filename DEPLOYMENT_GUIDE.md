# IP-SAKTI: Updated Files + Full Deployment Guide

## 1. What was actually broken, and what changed

### Bug 1 — `text-embedding-004` 404
The new unified `google-genai` SDK (which your `embeddings.py` had already
been rewritten to use) doesn't expose `text-embedding-004`. Fixed by
switching to `gemini-embedding-001`, pinned to 768 output dimensions.

### Bug 2 — Qdrant `WinError 10054 / connection forcibly closed` during `ingest`
`app/retrieval/vector_index.py`'s `upsert()` sent **every chunk in one HTTP
request**. With a real corpus (your 30+ PDFs → many hundreds/thousands of
chunks, each payload carrying full chunk text), that single request is large
enough that the connection gets reset mid-transfer. **Fixed by batching
upserts (64 points/request) with retries and an explicit 60s client
timeout.**

### Your two requested changes
- **Embeddings → Gemini API** everywhere (`app/embeddings.py`, new), replacing
  the local `sentence-transformers` model in both `app/ingestion/embed_and_index.py`
  and `app/retrieval/hybrid.py`. `app/config.py`'s `embedding_model` setting
  is removed (no longer meaningful).
- **Reranking → RRF**. The weighted-sum-of-raw-scores fusion + optional
  cross-encoder rerank pass in `app/retrieval/hybrid.py` is replaced with
  Reciprocal Rank Fusion, with small intent/topic/authority boosts applied
  on top. `app/config.py`'s `reranker_enabled`/`reranker_model` settings are
  removed. **Delete `app/retrieval/reranker.py`** — nothing imports it anymore.

### Bonus fixes made while I was in there
- Wired `TRANSLATION_PROVIDER=bhashini` in `app/language.py`'s
  `TranslationProvider` to a real (best-effort — see caveat below) Bhashini
  client, `app/translation/bhashini_client.py` (new).
- Promoted `example_fastapi_integration.py` → `main.py` (replaces the old
  flat `main.py`), added a shared-secret header check on every route except
  `/api/health` so this service is safe to expose publicly on Render's free
  tier (no private networking there).
- `requirements.txt`: removed `sentence-transformers` (no longer used
  anywhere — was the single biggest install/RAM cost), deduplicated the two
  conflicting `google-generativeai` lines, added `google-genai` (needed
  for embeddings; different package from `google-generativeai`, which stays
  for generation).
- Added `server/rag/pythonBridge.ts` — the actual Node↔Python integration
  (see section 3).

## 2. Files in this zip

```
ip_sakti_rag/
  app/
    embeddings.py              NEW    Gemini embeddings
    config.py                  MODIFIED (removed embedding_model/reranker settings, added bhashini/shared-secret settings)
    language.py                 MODIFIED (TranslationProvider now calls Bhashini)
    ingestion/embed_and_index.py MODIFIED (uses app.embeddings, not local model)
    retrieval/hybrid.py         MODIFIED (Gemini query embed + RRF, no reranker)
    retrieval/vector_index.py   MODIFIED (batched/retried upsert, timeout)
    translation/
      __init__.py               NEW
      bhashini_client.py        NEW    sync Bhashini NMT client
  main.py                       NEW    replaces old root main.py (FastAPI entrypoint)
  requirements.txt              MODIFIED
  .env.example                  MODIFIED
server/
  rag/pythonBridge.ts           NEW    Node -> Python bridge, with local fallback
render.yaml                     NEW    Render Blueprint (see caveat in section 4)
DEPLOYMENT_GUIDE.md              this file
```

### Delete these — superseded, nothing imports them anymore
```
ip_sakti_rag/embeddings.py          (old flat script -> replaced by app/embeddings.py)
ip_sakti_rag/ingest.py              (old flat script -> use `python -m scripts.ingest`)
ip_sakti_rag/bm25_index.py          (old flat script -> app/retrieval/bm25_index.py is the real one)
ip_sakti_rag/graph.py               (old flat script -> app/retrieval/graph.py is the real one)
ip_sakti_rag/retrieval.py           (old flat script -> app/retrieval/hybrid.py is the real one)
ip_sakti_rag/bhashini.py            (old flat script -> app/translation/bhashini_client.py is the real one)
ip_sakti_rag/example_fastapi_integration.py   (promoted to main.py)
ip_sakti_rag/app/retrieval/reranker.py        (reranking is now RRF, no model)
```

## 3. Node <-> Python integration

`server/rag/pythonBridge.ts` (new file, included) exposes one function,
`getGroundedAnswer(query, language, conversationId)`, that calls the Python
service's `/api/chat` and reshapes its response to match what `routes.ts`
already builds `assistantMessage` from — falling back to the existing local
`searchStatutoryKnowledge` + `generateRAGAnswer` engine if the Python
service is unset, slow, or erroring.

I have the real content of your `server/routes.ts` (fetched from GitHub) and
made the smallest possible patch — 3 changes, applied by hand since I
don't have write access to your repo:

**Change 1 — imports (top of file):**
```diff
- import { searchStatutoryKnowledge, analyzeFormulation } from './rag/retrieval.js';
- import { generateRAGAnswer } from './gemini.js';
+ import { analyzeFormulation } from './rag/retrieval.js';
+ import { getGroundedAnswer } from './rag/pythonBridge.js';
```
(`generateRAGAnswer`/`searchStatutoryKnowledge` are only used inside
`pythonBridge.ts` now, as the fallback path — not directly in `routes.ts`
anymore. `analyzeFormulation` is still used elsewhere, keep it.)

**Change 2 — inside `POST /api/chat` (was around line 253-254):**
```diff
- const retrieval = searchStatutoryKnowledge(userQuery, 3);
- const ragAnswer = await generateRAGAnswer(userQuery, retrieval.chunks, language);
+ const grounded = await getGroundedAnswer(userQuery, language, conversation_id);
```
Then further down in the same handler, replace every `retrieval.X` /
`ragAnswer.X` reference with `grounded.X`:
```diff
- confidence: retrieval.confidenceLevel,
- sources_retrieved: retrieval.citations.length
+ confidence: grounded.confidenceLevel,
+ sources_retrieved: grounded.citations.length
...
- content: ragAnswer.content,
- relevant_considerations: ragAnswer.relevant_considerations,
- recommended_next_steps: ragAnswer.recommended_next_steps,
- citations: retrieval.citations,
- confidence: {
-   level: retrieval.confidenceLevel,
-   score: retrieval.confidenceScore,
-   reasons: retrieval.reasons
- },
+ content: grounded.content,
+ relevant_considerations: grounded.relevant_considerations,
+ recommended_next_steps: grounded.recommended_next_steps,
+ citations: grounded.citations,
+ confidence: {
+   level: grounded.confidenceLevel,
+   score: grounded.confidenceScore,
+   reasons: grounded.reasons
+ },
```

**Change 3 — inside `POST /api/chat/stream` (was around line 323-324):** same
substitution as Change 2 — `searchStatutoryKnowledge`/`generateRAGAnswer` ->
`getGroundedAnswer`, then `retrieval.content`/`ragAnswer.content` etc. ->
`grounded.content` etc. in the SSE payload and the final JSON block.

I did **not** touch `/api/products/analyze`, `/api/ipr/analyze`,
`/api/abs/analyze` — I haven't read those handlers in full, and the Python
service now exposes matching endpoints (`rag.analyze_product`,
`rag.analyze_ipr`, `rag.analyze_tk_abs` via `main.py`) if you want to wire
those the same way later. Same pattern: add a `callPythonService`-style
function in `pythonBridge.ts` per endpoint, or generalize it into
`proxyToRagService(path, body)`.

## 4. Deploying to Render (free tier only)

Three services. `render.yaml` (included) is a Blueprint that creates all
three in one go — but flag this: the `fromService: ... property: hostport`
wiring for `RAG_SERVICE_URL` is a newer Render Blueprint feature and I
can't fully verify it resolves to a `https://`-prefixed URL your Node fetch
call needs (vs. a bare `host:port`). After the blueprint runs, open the
`ip-sakti-backend` service's Environment tab and confirm `RAG_SERVICE_URL`
looks like `https://ip-sakti-rag-xxxx.onrender.com` — if it's missing the
scheme or looks wrong, set it manually.

If you'd rather not use the blueprint, do it manually:

| Service | Type | Root dir | Build | Start |
|---|---|---|---|---|
| `ip-sakti-rag` | Web Service (free) | `ip_sakti_rag/` | `pip install -r requirements.txt` | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| `ip-sakti-backend` | Web Service (free) | repo root | `npm install && npm run build` | `npm start` |
| `ip-sakti-frontend` | Static Site | `frontend/` | `npm install && npm run build` | (serves `dist/`) |

Env vars (dashboard, not committed files):

**`ip-sakti-rag`**: `LLM_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`,
`QDRANT_COLLECTION`, `RAG_SERVICE_SHARED_SECRET` (make one up, e.g. a
random 32-char string), and `TRANSLATION_PROVIDER`/`BHASHINI_*` if you're
using Bhashini.

**`ip-sakti-backend`**: existing vars, plus `RAG_SERVICE_URL` = the
`ip-sakti-rag` service's public URL (copy from its Render dashboard page
once deployed), and `RAG_SERVICE_SHARED_SECRET` = the same value you
set on `ip-sakti-rag`.

**`ip-sakti-frontend`**: whatever `VITE_API_BASE_URL`-equivalent your
frontend already uses to reach the backend (check `frontend/src` for how
it currently builds API URLs — I haven't read that code, so verify the
variable name matches what your frontend actually expects).

### Free-tier realities to plan around
- Both web services **sleep after 15 minutes idle**, ~30-60s cold start.
  A request right after idle time can hit two sequential cold starts
  (Node wakes up, then calls a sleeping Python service which also wakes
  up) — could be 60-120s worst case. `pythonBridge.ts`'s 20s timeout will
  likely trip during a cold start and silently fall back to the local
  engine, which is a reasonable failure mode but means the first request
  after idle time may get the lower-quality local answer, not the RAG
  one. Consider raising `RAG_SERVICE_TIMEOUT_MS` if this happens often, or
  pinging both `/api/health` endpoints every 10 minutes from an external
  uptime tool.
- `data/processed/chunks.jsonl` and the local BM25 pickle must exist in
  the deployed image — Render's free tier has no persistent disk, so if
  you rely on `python -m scripts.ingest` having been run once on your
  machine, commit `data/processed/chunks.jsonl` (or run ingestion as
  part of the Render build step) so the live service has something to
  serve on every cold start/redeploy.
- If `QDRANT_URL` is unset, `vector_index.py` falls back to Qdrant's local
  on-disk embedded mode — this will NOT work usefully on Render's free
  tier (no persistent disk = the local Qdrant data vanishes on every
  restart). Always set `QDRANT_URL`/`QDRANT_API_KEY` for deployment.
- Gemini free-tier rate limits now apply per query (embeddings happen live
  on every search, not just at ingest) — watch this if traffic grows.

## 5. Before you deploy — verify locally

```bash
cd ip_sakti_rag
pip install -r requirements.txt
cp .env.example .env   # fill in LLM_API_KEY, QDRANT_URL, QDRANT_API_KEY

python -m scripts.ingest       # should complete without the WinError 10054 now
uvicorn main:app --reload --port 8001
curl http://localhost:8001/api/health
curl -X POST http://localhost:8001/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"Can Ashwagandha and Turmeric formulation be patented in India?\"}"
```

## 6. Checklist

- [ ] `pip install -r requirements.txt` succeeds (no `sentence-transformers` download)
- [ ] `python -m scripts.ingest` completes fully, no connection-reset error
- [ ] Qdrant Cloud console shows the `ip_sakti_chunks` collection populated
- [ ] `/api/chat` returns a real answer with real `citations`
- [ ] `routes.ts` patched (section 3), `npm run build` succeeds in `server/`
- [ ] `reranker.py` deleted, old flat scripts deleted (section 2)
- [ ] All 3 Render services deployed, `RAG_SERVICE_URL` confirmed correct on the backend
- [ ] Cold-start behavior tested once (hit `/api/chat` after 20+ min idle)
- [ ] If using Bhashini: a real API response captured and checked against `bhashini_client.py`'s field names

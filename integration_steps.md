# IP-SAKTI Sahayak — RAG Integration & Deployment (3 services)

## What changed from the previous version of this doc

You told me `ip_sakti_rag/` is the real RAG engine, not `backend/`'s
built-in one. I made `backend/` a thin proxy in front of `ip_sakti_rag`
instead. Concretely:

### Files deleted from `backend/`

```
backend/app/rag/                          (corpus.py, ingest.py, vector_store.py, pipeline.py)
backend/app/retrieval/                    (hybrid_retrieval.py)
backend/app/knowledge_graph/              (graph_service.py)
backend/app/validation/                   (citation_validation.py)
backend/app/services/llm_service.py
backend/app/services/classification_service.py
backend/app/services/jurisdiction_service.py
backend/app/services/decision_engines.py
backend/app/api/routes/research.py        (dead code — used SQLAlchemy, was never
                                            imported by app/main.py, unrelated to
                                            the RAG changes but safe to remove)
backend/data/authoritative_documents.json (was the seed corpus for the deleted
                                            local retriever; ip_sakti_rag has its
                                            own corpus under ip_sakti_rag/data/)
```

**Kept in `backend/`, unchanged:** auth (`api/routes/auth.py`), MongoDB
session layer, `services/conversation_service.py`,
`services/audit_service.py`, `services/expert_escalation_service.py`,
`services/pdf_service.py`, `translation/translation_service.py` (UI-string
translation is a separate concern from RAG, so it stays local to `backend/`).

### Files added/rewritten in `backend/`

- **`backend/app/rag_client.py`** (new) — the only place that knows
  `ip_sakti_rag`'s base URL. Wraps every call: `chat()`, `analyze_product()`,
  `analyze_ipr()`, `analyze_tk_abs()`, `search_documents()`,
  `list_documents()`, `get_document()`, `get_telemetry()`,
  `submit_feedback()`, `health()`. Raises a clean 502 (`RagServiceError`) if
  `ip_sakti_rag` is unreachable, instead of leaking a raw connection
  traceback to the frontend.
- **`backend/app/core/config.py`** — dropped `llm_*`, `qdrant_*`, `neo4j_*`,
  `embedding_*` (those now belong entirely to `ip_sakti_rag`); added
  `RAG_SERVICE_URL`, `RAG_SERVICE_SHARED_SECRET`, `RAG_SERVICE_TIMEOUT_SECONDS`.
- **`backend/app/api/routes/chat.py`** — `/api/chat` and `/api/query` now
  call `rag_client.chat()` instead of the local pipeline, then map its
  response fields onto the existing MongoDB conversation/audit-log schema.
- **`backend/app/api/routes/products.py`** — `/api/products/analyze`,
  `/api/ipr/analyze`, `/api/abs/analyze`, `/api/tk-abs/analyze` now call the
  matching `ip_sakti_rag` endpoint directly (its `IPSaktiRAG.analyze_*`
  methods return the exact same field names `backend/app/models/product.py`
  already expects — no reshaping needed there).
- **`backend/app/api/routes/rag_routes.py`** — `/api/search`, `/api/sources`,
  `/api/documents/{id}` now proxy to `ip_sakti_rag`.
- **`backend/app/api/routes/misc_routes.py`** — `/api/research/search`,
  `/api/resources`, `/api/rag/documents`, `/api/rag/telemetry` now proxy to
  `ip_sakti_rag`. `/api/translate` is untouched.
- **`backend/app/api/routes/health.py`** — reports `ip_sakti_rag`
  connectivity instead of local vector-store/graph status.
- **`backend/requirements.txt`** — removed `qdrant-client`, `neo4j`,
  `rank-bm25` (unused import), `networkx` (no longer imported anywhere in
  `backend/`).
- **`backend/.env.example`** — rewritten; see `setup_steps.md`.
- **`ip_sakti_rag/requirements.txt`** — **this file didn't exist in your
  zip.** I generated it from ip_sakti_rag's actual imports (`fastapi`,
  `google-genai`, `qdrant-client`, `neo4j`, `rank-bm25`, `pymongo`, `pypdf`,
  `pdf2image`, `pytesseract`, `beautifulsoup4`). Please sanity-check the
  pinned versions before deploying.

All of the above are in the zip attached to this message
(`backend_rag_integration_files.zip`) with the same relative paths — unzip it
over your project root to apply the changes.

### Functionality that changed shape (read this before you demo)

- **`POST /api/chat/stream`** (SSE streaming) is **gone**. `ip_sakti_rag`'s
  `/api/chat` is a single synchronous response, not a stream. If you need
  streaming back, it has to be added to `ip_sakti_rag/main.py` first — say
  the word and I'll write it.
- **`POST /api/documents/ingest`** and **`POST /api/admin/documents`**
  (adding a document at runtime) are gone. `ip_sakti_rag` ingests documents
  **offline** via `python -m ingest` / `scripts/ingest.py`, not through a
  live API endpoint. To add a document: drop it in
  `ip_sakti_rag/data/documents/`, re-run ingestion, restart `ip_sakti_rag`.
- **`GET /api/ipr/overview`** previously returned a static table from
  `decision_engines.ipr_overview()` (deleted). I approximated it with an
  `ip_sakti_rag` document search — the response shape is different now.
  Check `frontend/src/components/IPRNavigatorView.tsx`'s "at a glance" popup
  still renders correctly; if not, tell me what shape it expects and I'll
  match it exactly.
- **`POST /api/classify`** and **`POST /api/validate`** (standalone
  classification/citation-validation endpoints) are gone — that logic is
  now internal to `ip_sakti_rag`'s pipeline and isn't exposed as its own
  endpoint. If the frontend calls these directly (check
  `AdminView.tsx`/`WorkspaceView.tsx`), tell me and I'll add thin proxies.

### Verify the integration is real

1. Start `ip_sakti_rag` on :8001, then `backend` on :8000.
2. `curl http://localhost:8000/api/health` → `"rag_service": "connected (ok)"`.
3. Kill `ip_sakti_rag`, hit `/api/chat` on the backend → should return a
   clean `502` with `"RAG service is unreachable..."`, not a stack trace.
4. Restart `ip_sakti_rag`, send a real chat message, confirm citations come
   back with real document titles (from `ip_sakti_rag/data/documents/*.pdf`,
   not placeholder text).

## Deploy: Render (3 services) + Vercel (frontend)

### Step 1 — Deploy `ip_sakti_rag` to Render

- **Root Directory**: `ip_sakti_rag`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Env vars: `LLM_API_KEY`, `LLM_MODEL`, `QDRANT_URL`, `QDRANT_API_KEY`,
  `QDRANT_COLLECTION`, `NEO4J_ENABLED`, `NEO4J_URI`, `NEO4J_USERNAME`,
  `NEO4J_PASSWORD`, `MONGODB_URI` (optional), `RAG_SERVICE_SHARED_SECRET`
  (recommended in production — generate a random string).
- **If you rely on OCR ingestion** (`pdf2image`/`pytesseract`), Render's
  standard Python runtime doesn't have `poppler`/`tesseract` installed —
  you'd need a Docker-based service instead (there's no `Dockerfile` for
  `ip_sakti_rag` in the zip; say the word and I'll write one). If your
  corpus is already ingested (`data/processed/chunks.jsonl` ships with real
  data), you likely don't need to re-run ingestion in production at all —
  just deploy with the pre-built index.
- Confirm `https://<ip-sakti-rag>.onrender.com/api/health` responds.

### Step 2 — Deploy `backend` to Render

- **Root Directory**: `backend`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Env vars: `MONGODB_URI`, `FRONTEND_ORIGIN` (your Vercel URL),
  `RAG_SERVICE_URL` = the Render URL from Step 1,
  `RAG_SERVICE_SHARED_SECRET` = same value as Step 1, `TRANSLATION_PROVIDER`,
  `BHASHINI_*`, `JWT_SECRET`.
- Confirm `/api/health` shows `rag_service: connected`.

### Step 3 — `frontend/vercel.json`

Frontend calls are relative (`fetch('/api/...')`) with no configurable base
URL, so cross-domain deploys need a rewrite:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://<your-render-backend>.onrender.com/api/:path*"
    }
  ]
}
```

Point this at the **backend** service from Step 2, not `ip_sakti_rag` —
the frontend never talks to `ip_sakti_rag` directly.

### Step 4 — Deploy `frontend` to Vercel

- **Root Directory**: `frontend`
- Vite preset, build `npm run build`, output `dist` (usually auto-detected).
- Deploy, then go back to Step 2 and set `FRONTEND_ORIGIN` to the real
  Vercel URL if it changed, and redeploy `backend` so CORS matches.

### Step 5 — End-to-end check

Open the Vercel URL, log in, send a chat message. Network tab should show
`/api/chat` returning 200 from the Vercel domain (via the rewrite), with a
cited answer — confirming Vercel → Render `backend` → Render `ip_sakti_rag`
all work in production.

## Notes

- Free-tier Render services spin down when idle — with **three** services
  now, a cold start touches all of them on the first request after idle.
  Expect a slower first response.
- I did not touch `frontend/` source, `ip_sakti_rag/app/` internals, or
  `ip_sakti_rag/main.py` — only added its missing `requirements.txt`.

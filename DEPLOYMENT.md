# DEPLOYMENT.md — Render (Free Tier), All 3 Services

Three Render services, all free tier:

| Service | Type | Root Dir | Build | Start |
|---|---|---|---|---|
| `ip-sakti-rag` | Web Service | `ip_sakti_rag` | `pip install -r requirements.txt` | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| `ip-sakti-backend` | Web Service | `backend` | `pip install -r requirements.txt` | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| `ip-sakti-frontend` | Static Site | `frontend` | `npm install && npm run build` | (serves `dist/`) |

Delete/ignore `render.yaml` at the repo root if it still references the old
Node `server.ts` architecture — it doesn't match this stack. Create the
three services manually as below, or write a fresh Blueprint once you've
confirmed the manual setup works (safer for a first deploy).

## Step 1 — `ip-sakti-rag`

Render dashboard → New → Web Service → connect your repo → set:
- **Root Directory**: `ip_sakti_rag`
- **Runtime**: Python 3
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Plan**: Free

Environment variables (dashboard → Environment tab, not a committed file):
```
LLM_API_KEY=<your Gemini key>
LLM_MODEL=gemini-2.0-flash        (or whatever you're currently using)
QDRANT_URL=<your Qdrant Cloud cluster URL>
QDRANT_API_KEY=<your Qdrant Cloud API key>
QDRANT_COLLECTION=ip_sakti_chunks
NEO4J_ENABLED=true
NEO4J_URI=<your Neo4j Aura URI>
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=<your Neo4j Aura password>
MONGODB_URI=<your MongoDB Atlas URI>          (optional — chat/feedback logging)
TRANSLATION_PROVIDER=none                      (this service doesn't need Bhashini; backend/ handles UI translation)
RAG_SERVICE_SHARED_SECRET=<generate a random 32+ char string>
```

**Corpus**: the free-tier filesystem is ephemeral (wiped on every
redeploy/restart). If `ip_sakti_rag/data/processed/chunks.jsonl` is
committed to your repo (real indexed data, not empty), the deployed service
boots with it immediately — no need to re-run ingestion in production.
Confirm this file is **not** in `.gitignore` before deploying, or the live
service will have zero documents to retrieve from.

**OCR dependencies**: `pytesseract`/`pdf2image` need `tesseract-ocr` and
`poppler` system packages that Render's standard Python runtime doesn't
have. This only matters if you re-run ingestion over scanned PDFs *on
Render itself* — since your corpus should already be pre-ingested and
committed (previous paragraph), you likely never need this in production.
If you do, you'd need a Dockerfile-based Render service instead of the
plain Python runtime.

Deploy, then confirm: `https://ip-sakti-rag-xxxx.onrender.com/api/health`
→ `{"status": "ok"}`.

## Step 2 — `ip-sakti-backend`

New Web Service:
- **Root Directory**: `backend`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Plan**: Free

Environment variables:
```
APP_ENV=production
MONGODB_URI=<same MongoDB Atlas URI>
MONGODB_DB_NAME=ip_sakti
FRONTEND_ORIGIN=<your frontend's Render static site URL — set this AFTER step 3, then redeploy>
RAG_SERVICE_URL=<the ip-sakti-rag URL from Step 1>
RAG_SERVICE_SHARED_SECRET=<same value as Step 1, exactly>
TRANSLATION_PROVIDER=bhashini
BHASHINI_API_KEY=<your key>
BHASHINI_USER_ID=<your user id>
JWT_SECRET=<generate a long random string, different from RAG_SERVICE_SHARED_SECRET>
```

Deploy, then confirm: `https://ip-sakti-backend-xxxx.onrender.com/api/health`
shows `"rag_service": "connected (ok)"`. If it says unreachable, double
check `RAG_SERVICE_URL` has no trailing slash and uses `https://`.

## Step 3 — `ip-sakti-frontend`

New Static Site:
- **Root Directory**: `frontend`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`

The frontend calls `/api/...` as **relative paths** (see
`frontend/src/components/auth/authStorage.ts` and every view) — there's no
`VITE_API_BASE_URL` to set for a same-origin deploy. Since the frontend and
backend are on *different* Render domains, add a redirect/rewrite so
`/api/*` on the frontend's domain forwards to the backend. In the Render
Static Site's **Redirects/Rewrites** settings, add:
```
Source: /api/*
Destination: https://ip-sakti-backend-xxxx.onrender.com/api/:splat
Type: Rewrite (not Redirect)
```
(Render's static site redirect rules use this table in the dashboard, not a
`vercel.json`-style file — if your Render plan/UI instead expects a
`_redirects` file in `frontend/public/`, use:
`/api/*  https://ip-sakti-backend-xxxx.onrender.com/api/:splat  200`)

Deploy, then go back to Step 2 and set `FRONTEND_ORIGIN` to this static
site's real URL, and redeploy `ip-sakti-backend` so CORS allows it.

## Step 4 — End-to-end check

1. Open the frontend's Render URL.
2. Register a new account, log in.
3. Send a chat message — Network tab should show `/api/chat` returning 200
   from the frontend's own domain (via the rewrite), with a real cited
   answer.
4. Product Analyzer / TK & ABS: load a preset, Generate — should return a
   populated results page, not a blank one (confirms `PATCHES.md` was
   applied — see that file if this still fails).

## Free-tier realities

- **Both web services sleep after 15 minutes idle**, ~30-60s cold start
  each. A request right after idle time can trigger two sequential cold
  starts (backend wakes, then calls a sleeping `ip-sakti-rag` which also
  wakes) — worst case 60-120s for the very first request. This is normal
  for this setup on free tier, not a bug.
- **Static sites on Render don't sleep** (only Web Services do) — the
  frontend itself always loads instantly; only API calls are affected by
  the above.
- **MongoDB Atlas / Qdrant Cloud / Neo4j Aura free tiers** have their own
  independent inactivity/storage limits (e.g. Atlas free clusters can be
  paused after long inactivity) — check each provider's dashboard
  periodically if the app seems to stop returning data after weeks of no
  traffic.
- Gemini API free-tier rate limits apply per request now (embeddings run
  live on every search query, not only at ingest time) — watch for 429s
  under real traffic and consider caching or a paid tier if you scale up.

## Known gaps carried into production (see `PATCHES.md` for detail)

- `POST /api/admin/documents` (live document add) and `.../index`
  (re-index one doc) are gone — corpus updates require re-running
  `ip_sakti_rag/scripts/ingest.py` and redeploying `ip-sakti-rag` with the
  updated `data/processed/chunks.jsonl` committed.
- `POST /api/transcribe` (voice input) doesn't exist yet — the mic button
  in the UI will fail until this is built.
- Streaming chat (`/api/chat/stream`) is gone; the app already degrades
  gracefully to a normal synchronous response, just with one wasted failed
  request per message — harmless, just not ideal for latency.

# IP-SAKTI Sahayak — Setup Steps

Three sibling services, all at the same folder level in the repo:

```
ip_sakti_rag/   Python FastAPI — the actual RAG engine (retrieval, LLM
                reasoning, knowledge graph, vector store). Runs standalone.
backend/        Python FastAPI — auth, MongoDB persistence, translation.
                Calls ip_sakti_rag over HTTP for every RAG-backed operation.
frontend/       React 19 / Vite. Talks to backend/ over /api/*.
```

`backend/` no longer contains any retrieval/generation code itself — it's a
thin orchestration + persistence layer in front of `ip_sakti_rag`. See
`integration_steps.md` for exactly what changed and the full list of deleted
files.

> The root-level `server.ts` / `src/` / `package.json` / `render.yaml` /
> `docker-compose.yml` belong to a third, unused architecture. Ignore or
> delete them.

## 0. Prerequisites

- Python 3.12+
- Node.js 18+ and npm
- Your live credentials: Gemini (`LLM_API_KEY`), Qdrant Cloud, Neo4j Aura,
  MongoDB, Bhashini.

> **Heads up:** `ip_sakti_rag/.env` in the zip you gave me already contains
> real Gemini/Qdrant/Neo4j credentials, and `ip_sakti_rag/.gitignore`
> correctly excludes `.env` from git. Just double-check it was never
> committed to a public repo before this point — if it was, rotate those
> keys.

## 1. Start the RAG service first (`ip_sakti_rag/`)

This has to be running before `backend/` can serve any chat/product/IPR/
TK-ABS/research request — those all proxy to it now.

```bash
cd ip_sakti_rag
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt   # I added this file — it didn't exist in the zip
```

`requirements.txt` includes `pdf2image` and `pytesseract`, which need system
packages to actually work (only needed if you re-run ingestion over scanned
PDFs — the app boots fine without them):

```bash
# Debian/Ubuntu
sudo apt-get install -y poppler-utils tesseract-ocr
# macOS
brew install poppler tesseract
```

Your `.env` already exists with real credentials — just confirm it has:

```ini
LLM_API_KEY=<your gemini key>
LLM_MODEL=gemini-3.1-flash-lite
QDRANT_URL=<your qdrant cloud url>
QDRANT_API_KEY=<your qdrant key>
QDRANT_COLLECTION=ip_sakti_chunks
NEO4J_ENABLED=true
NEO4J_URI=<your neo4j aura uri>
NEO4J_USERNAME=<your neo4j user>
NEO4J_PASSWORD=<your neo4j password>
MONGODB_URI=<your mongodb uri>          # optional — chat/feedback persistence
RAG_SERVICE_SHARED_SECRET=              # optional — set to require the header below
```

The document corpus is already pre-ingested (`data/processed/chunks.jsonl`
ships in the zip). If you add new PDFs to `data/documents/`, re-run:

```bash
python -m ingest    # or: python scripts/ingest.py — check which exists in your copy
```

Run it:

```bash
uvicorn main:app --reload --port 8001
```

Verify: `http://localhost:8001/api/health` → `{"status": "ok"}`.

## 2. Backend setup (`backend/`)

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt   # I removed qdrant-client/neo4j/rank-bm25 — no longer needed here
cp .env.example .env
```

Edit `backend/.env`:

```ini
APP_ENV=development
APP_PORT=8000
FRONTEND_ORIGIN=http://localhost:3000

MONGODB_URI=<your mongodb uri>
MONGODB_DB_NAME=ip_sakti

RAG_SERVICE_URL=http://localhost:8001
RAG_SERVICE_SHARED_SECRET=     # must match ip_sakti_rag's value exactly, or leave both blank

TRANSLATION_PROVIDER=bhashini
BHASHINI_API_KEY=<your bhashini key>
BHASHINI_USER_ID=<your bhashini user id>
BHASHINI_ULCA_API_KEY=<your bhashini ulca key>

JWT_SECRET=<generate a long random string>
```

Run it:

```bash
uvicorn app.main:app --reload --port 8000
```

Verify: `http://localhost:8000/api/health` → should show
`"rag_service": "connected (ok)"`. If it says `"unreachable at ..."`,
`ip_sakti_rag` isn't running or `RAG_SERVICE_URL` is wrong.

## 3. Frontend setup (`frontend/`)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. Vite proxies `/api/*` to `http://localhost:8000`
(the backend) — unchanged by any of this.

## 4. Confirm all three are talking

Backend → ip_sakti_rag: `curl http://localhost:8000/api/health` shows
`rag_service: connected`.
Frontend → backend → ip_sakti_rag: log in on `localhost:3000`, send a chat
message, confirm a cited answer comes back.

## Running order matters

Start `ip_sakti_rag` **before** `backend` (backend doesn't crash if it's
down, but every RAG-backed request will fail until it's reachable). Order
between `backend` and `frontend` doesn't matter.

## Next: production deploy

See `integration_steps.md` for the 3-service Render deployment (plus
Vercel for the frontend) and the full list of files I changed/deleted.

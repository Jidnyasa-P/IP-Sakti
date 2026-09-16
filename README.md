# IP-SAKTI Sahayak

Multilingual, RAG-based, source-cited AI assistant for Intellectual Property
and regulatory guidance in Ayurveda (built for SIH26045).

## Architecture

Three sibling services:

```
ip_sakti_rag/   Python 3.12 + FastAPI — the RAG engine: hybrid BM25 +
                Qdrant vector retrieval, Gemini generation, Neo4j knowledge
                graph, citation validation, confidence scoring, safe
                abstention. Runs standalone on its own port.
backend/        Python 3.12 + FastAPI — auth, MongoDB persistence
                (conversations, product analyses, saved research, audit
                logs, expert escalations), translation. Calls ip_sakti_rag
                over HTTP for every RAG-backed operation; has no
                retrieval/generation code of its own.
frontend/       React 19 + Vite — chat UI, auth, admin, expert-advisory
                views. Talks only to backend/, never directly to
                ip_sakti_rag.
```

Request flow: `frontend → backend (auth + persistence) → ip_sakti_rag
(retrieval + generation) → backend → frontend`.

> The root-level `server.ts` / `src/` / `package.json` / `render.yaml` /
> `docker-compose.yml` in this repo belong to a different, unused
> architecture — safe to ignore or delete.

## Quick start

```bash
# 1. RAG engine (start first)
cd ip_sakti_rag
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# .env already has your Gemini/Qdrant/Neo4j credentials
uvicorn main:app --reload --port 8001

# 2. Backend (separate terminal)
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # set RAG_SERVICE_URL=http://localhost:8001, MongoDB, etc.
uvicorn app.main:app --reload --port 8000

# 3. Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. Full details: **`setup_steps.md`**.

## RAG integration & deployment

Exact list of files changed/deleted to wire `backend/` up to `ip_sakti_rag`,
what functionality changed shape (streaming chat removed, runtime document
ingest removed), and step-by-step Render (×2 services) + Vercel deployment:
see **`integration_steps.md`**.

## Key API endpoints (backend, proxying to ip_sakti_rag where noted)

| Endpoint | Purpose | Backed by |
|---|---|---|
| `GET /api/health` | Health check (includes ip_sakti_rag connectivity) | backend |
| `POST /api/chat` | Main chat endpoint | ip_sakti_rag (via backend) |
| `POST /api/products/analyze` | Product classification + regulatory/IPR/TK-ABS analysis | ip_sakti_rag |
| `POST /api/ipr/analyze` | IPR pathway analysis | ip_sakti_rag |
| `POST /api/abs/analyze` / `/api/tk-abs/analyze` | Traditional-knowledge/ABS analysis | ip_sakti_rag |
| `GET /api/search`, `/api/sources`, `/api/documents/{id}` | Document search/listing | ip_sakti_rag |
| `GET /api/rag/telemetry` | Query volume, confidence, feedback stats | ip_sakti_rag |
| `POST /api/expert-escalation` | Escalate a query to a human expert | backend |
| `POST /api/translate` | UI string translation | backend (separate from RAG) |

Full interactive docs at `/docs` on the backend once it's running.

## Repo layout

```
ip_sakti_rag/
  main.py                 FastAPI entrypoint (RAG service)
  app/
    pipeline.py             IPSaktiRAG — the class main.py calls
    retrieval/               Hybrid BM25 + Qdrant + Neo4j graph context
    generation/               Gemini grounded answer generation
    safety/                    Citation validation, confidence, abstention
    classification.py, jurisdiction.py
  data/documents/            Source PDFs (statutes, treaties, rules)
  data/processed/             Pre-built chunks/embeddings (chunks.jsonl)
  scripts/ingest.py           Offline ingestion — run after adding documents
  requirements.txt            (added — was missing from the original zip)

backend/
  app/
    main.py                  FastAPI entrypoint
    rag_client.py              HTTP client for ip_sakti_rag (added)
    core/config.py              Env settings (RAG_SERVICE_URL, Mongo, JWT, Bhashini)
    api/routes/                 chat, products, rag_routes, misc_routes, auth, experts, health
    services/                    conversation, audit, expert_escalation, pdf, auth
    translation/                  Bhashini / curated-dictionary UI translation
    database/session.py           MongoDB (mongomock fallback for demo mode)
  requirements.txt

frontend/
  src/
    components/                 Views (Chat, Admin, Research, Product Analyzer, etc.)
    context/                     Auth, language, jurisdiction, expert-advisory
  vite.config.ts                 Dev-time /api proxy to localhost:8000
  vercel.json                    Prod /api rewrite to the Render backend (added)
```

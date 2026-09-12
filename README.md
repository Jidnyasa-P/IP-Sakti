# IP-SAKTI Sahayak (SIH26045)

A multilingual, RAG-based, source-cited AI assistant for Intellectual
Property and regulatory guidance in Ayurveda, across national and
international regimes — **Team HackVeda**, Smart India Hackathon 2026.

Pipeline: **Classify → Route Jurisdiction → Retrieve → Reason → Validate → Cite**

```
IP-Sakti-Sahayak/
├── frontend/           React 19 + Vite 6 + TailwindCSS 4 (the UI you already built)
├── backend/             Python + FastAPI backend
├── scripts/              CLI utility: batch-ingest documents into the running backend
├── Dockerfile             Single-container build (frontend + backend, one image)
├── docker-compose.yml     Docker orchestration (demo mode by default)
├── .env.example           Root env file, used only by docker-compose
└── README.md               This file
```

---


## 1. Setup — local development (recommended for building/demoing)

You'll run two things in two terminals: the backend (port 8000) and the
frontend dev server (port 3000, which proxies `/api` calls to the backend).

### Prerequisites
- Python 3.10+ 
- Node.js 18+ and npm

### Terminal 1 — Backend
```bash
cd backend
python -m venv .venv

# macOS/Linux:
source .venv/bin/activate
# Windows PowerShell:
.venv\Scripts\Activate.ps1

pip install -r requirements.txt
cp .env.example .env          # Windows: copy .env.example .env
uvicorn app.main:app --reload --port 8000
```
Leave this running. Swagger docs: **http://localhost:8000/docs**

### Terminal 2 — Frontend
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:3000** — this is your actual app. Every `/api/...`
call it makes is transparently forwarded to the backend on port 8000.

### Running the backend tests
```bash
cd backend
python -m pytest tests/ -v
```
23 tests — API shape, the full chat/RAG pipeline end-to-end, classification,
jurisdiction routing, and citation-validation safety checks.

---

## 2. Setup — Docker (single command, production-like)

```bash
docker compose up app
```
Open **http://localhost:8000** — one container builds the frontend and
serves it directly from the FastAPI backend (no separate frontend server,
no CORS to worry about).

With live external services (Qdrant + Neo4j + MongoDB containers):
```bash
docker compose --profile full-stack up
```
Edit `.env` (copy from `.env.example`) first if you want to point at your
own managed Qdrant/Neo4j/MongoDB/Gemini/Bhashini instead of the bundled
containers.

---

## 3. API Endpoints 

| Method | Endpoint | Used by |
|---|---|---|
| GET | `/api/health` | System status check |
| POST | `/api/chat`, `/api/chat/stream` | Sahayak chat |
| GET/POST/DELETE | `/api/conversations`, `/api/conversations/{id}` | Chat session management |
| POST | `/api/conversations/{id}/feedback` | Thumbs up/down on answers |
| POST | `/api/products/analyze`, GET `/api/products` | Product Analyzer |
| POST | `/api/ipr/analyze` | IPR Navigator |
| POST | `/api/abs/analyze` | Traditional Knowledge & ABS module |
| GET | `/api/research/search`, `/api/documents/{id}` | Research repository |
| GET/POST/DELETE | `/api/workspace/saved-research` | My Workspace |
| GET | `/api/admin/documents`, `/api/admin/telemetry` | Admin & Telemetry view |
| POST | `/api/admin/documents`, `/api/admin/documents/{id}/index` | Admin document upload |
| POST | `/api/translate` | Multilingual UI strings |
| POST | `/api/classify`, `/api/search`, `/api/validate` | Canonical SIH-spec pipeline stages (standalone) |
| GET | `/api/sources` | Full indexed corpus listing |
| POST | `/api/documents/ingest` | Ingest a new document (also usable via `scripts/ingest_documents.py`) |
| POST | `/api/expert-escalation` | Manual escalation request |

Every one of these already exists in `backend/app/api/routes/` and matches
the exact `fetch(...)` calls already written in your `frontend/src/`
components — nothing needed to be added or renamed.

---

## 3. What was actually verified (before this zip was built)

- `pip install -r backend/requirements.txt` — clean install, no conflicts.
- `uvicorn app.main:app` — boots, connects to SQLite, logs demo/live status
  for every subsystem.
- `python -m pytest tests/ -v` — **23/23 passed.**
- `npm install && npm run build` in `frontend/` — builds cleanly to
  `frontend/dist/`.
- Both servers started together, and a **real request through the Vite
  proxy** (`localhost:3000/api/chat`) reached the FastAPI backend and
  returned a fully-formed, cited answer (statute sections, confidence
  score, classification, next steps) — confirming the frontend-to-backend
  wiring genuinely works end-to-end, not just in theory.


---

## 4. Environment Variables

Full commented list: `backend/.env.example`. Everything is optional.

| Variable | Effect when set | Fallback when blank |
|---|---|---|
| `LLM_API_KEY`, `LLM_MODEL` | Live Gemini reasoning | Rule-based synthesis |
| `QDRANT_URL`, `QDRANT_API_KEY` | Live Qdrant | Local TF-IDF index |
| `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` | Live Neo4j | In-process NetworkX graph |
| `DB_BACKEND=mongodb`, `MONGODB_URI` | MongoDB | SQLite (`backend/data/ip_sakti.db`) |
| `BHASHINI_API_KEY`, `BHASHINI_USER_ID` | Live Bhashini translation | Curated dictionary |
| `FRONTEND_ORIGIN` | CORS allow-list | `http://localhost:3000` |

---

## 5. Troubleshooting

**Frontend loads but every request fails / spinner never resolves**
→ Make sure the backend is actually running on port 8000 first
(`curl http://localhost:8000/api/health` should return JSON). The frontend
dev server proxies to it — if the backend isn't up, the proxy has nothing
to forward to.

**CORS error in the browser console**
→ Only happens if you access the frontend on a port other than 3000, or
the backend on a port other than 8000. If you change either, update
`FRONTEND_ORIGIN` in `backend/.env` and/or the proxy target in
`frontend/vite.config.ts`.

**`ModuleNotFoundError` on backend start**
→ You're not inside the virtual environment. Re-run
`source .venv/bin/activate` (or `.venv\Scripts\Activate.ps1` on Windows)
before `uvicorn`.

**Port already in use**
→ Something else is bound to 8000 or 3000. Kill it, or run the backend
with `--port 8001` and update the proxy target in `vite.config.ts` to match.

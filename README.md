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

## 1. What this package is

This combines your **updated frontend** (from `IP-Sakti-main.zip`) with the
**FastAPI backend** (from `IP-Sakti-complete.zip`) into one project that
runs together, as you asked for. Nothing in `frontend/src/` was touched —
every component, view, and piece of UI logic is exactly what you shipped.

Two small **wiring** changes were needed to make the two actually talk to
each other (neither touches frontend UI code or backend business logic):

| File | Change | Why |
|---|---|---|
| `frontend/vite.config.ts` | Added a dev-server `proxy` block forwarding `/api/*` to `http://localhost:8000` | Your frontend calls relative paths like `fetch('/api/chat')`. Without a proxy, the Vite dev server has nothing behind `/api` and every request 404s. This is standard Vite config, not a UI change. |
| `backend/app/main.py` | Changed the static-file path from `../../dist` to `../../frontend/dist` | The backend can optionally serve the built frontend directly (for Docker/production). Since your updated frontend now lives in a `frontend/` subfolder instead of the project root, this one path had to move with it. |

Both changes were tested — see **Section 6, "What was actually verified"**
below.

The old Express/TypeScript backend (`server.ts`, `server/gemini.ts`,
`server/rag/retrieval.ts`) that shipped in `main.zip` has been **left out**
of this package, per your note that you're using FastAPI, not
Express/TypeScript. If you want to keep those files for reference, they're
still sitting in your original `IP-Sakti-main.zip`.

---

## 2. Current state: dummy / demo mode

You mentioned you don't have a live database, ML models, RAG corpus, or
external APIs wired up yet — that's fine, **the backend is already built to
handle that gracefully.** Every external dependency is optional and falls
back to a real, working local equivalent:

| Component | If configured | If left blank (current state) |
|---|---|---|
| LLM reasoning | Live Gemini calls | Rule-based answer synthesis from retrieved text (no internet call) |
| Vector search | Live Qdrant | Local TF-IDF / BM25 index (in-process) |
| Knowledge graph | Live Neo4j | In-process NetworkX graph |
| App database | MongoDB | SQLite file, auto-created, zero setup |
| Translation | Live Bhashini | Curated Hindi/Marathi dictionary |

This is **not fake data returned with no logic** — it's a fully working
pipeline (classification → retrieval → citation → confidence scoring →
expert escalation) running against a small real corpus of Ayurveda-related
statutes bundled in `backend/data/authoritative_documents.json`. `/api/health`
always tells you exactly which parts are live vs. demo, and every chat
response includes `"demo_mode": true/false` so it's never presented as more
than it is.

When you're ready to plug in real services, just fill in the matching
variable in `backend/.env` — nothing else changes.

---

## 3. Setup — local development (recommended for building/demoing)

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

## 4. Setup — Docker (single command, production-like)

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

## 5. API Endpoints (already wired to the frontend)

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

## 6. What was actually verified (before this zip was built)

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

### Known pre-existing item (not introduced by this packaging step)

Running `tsc --noEmit` on the updated frontend surfaces a handful of type
mismatches between `frontend/src/types.ts` and fields used in
`ProductAnalyzerView.tsx` / `TraditionalKnowledgeView.tsx` (e.g.
`target_symptoms`, `distribution_channels`, and a couple of string-literal
union mismatches). **These do not block the app from running** — Vite's
dev server and `npm run build` both use esbuild for transpilation, which
doesn't fail on type errors, and the app was confirmed working above. Per
your instruction not to touch the frontend, these were left exactly as
they were in `main.zip`. If you want them fixed later, they're small,
localized type-definition mismatches, not architectural issues.

---

## 7. Environment Variables

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

## 8. Troubleshooting

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

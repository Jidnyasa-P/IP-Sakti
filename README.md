# IP-SAKTI Sahayak

A multilingual, RAG-based, source-cited AI assistant for Intellectual
Property and regulatory guidance in Ayurveda, across national and
international regimes.

Pipeline: **Classify → Route Jurisdiction → Retrieve → Reason → Validate → Cite**

```
IP-Sakti-Sahayak/
├── frontend/           React 19 + Vite 6 + TailwindCSS 4 (UI — unchanged design/layout)
├── backend/            Python + FastAPI + MongoDB backend
├── scripts/            CLI utility: batch-ingest documents into the running backend
├── Dockerfile          Single-container build (frontend + backend, one image)
├── docker-compose.yml  Docker orchestration (demo mode by default)
├── .env.example        Root env file, used only by docker-compose
├── INTEGRATION_REPORT.md   Full report of this MongoDB + auth integration
└── README.md           This file
```

See **`INTEGRATION_REPORT.md`** for the complete file-by-file account of
what changed in this integration (auth, roles, MongoDB collections, user
data isolation, test results).

---

## 1. What this app does now

- Real accounts: **register / login / logout**, JWT-based sessions.
- Five/six roles matching the frontend's existing role model — **Practitioner,
  Researcher, Expert, Admin, Organization, Startup** — with multi-role
  support (a user can hold several roles and switch their active one, via
  the existing ProfileView UI).
- Every conversation, product analysis, and saved-research item is tied to
  the real logged-in user — nobody can see another user's data.
- Admin-only endpoints (document management, telemetry) are enforced
  server-side, not just hidden in the UI.
- MongoDB is the application database (Atlas in production, or a
  zero-setup in-memory mock for local demos) — Qdrant (vectors) and Neo4j
  (knowledge graph) are untouched and handle what they always handled.

---

## 2. Setup — local development (recommended for building/demoing)

Two terminals: backend (port 8000) and frontend dev server (port 3000,
proxying `/api` calls to the backend).

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
Leave `MONGODB_URI` blank in `.env` to run against an in-memory MongoDB
mock (zero setup, resets on restart) — or follow **Section 9 of
`INTEGRATION_REPORT.md`** to point it at a real MongoDB Atlas cluster.

Swagger docs: **http://localhost:8000/docs**

### Terminal 2 — Frontend
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:3000**, register an account, and use the app.

### Running the backend tests
```bash
cd backend
python -m pytest tests/ -v
```
**38 tests** — auth (register/login/roles), user data isolation, RBAC,
the full chat/RAG pipeline, classification, jurisdiction routing, and
citation-validation safety checks. All run against the in-memory MongoDB
mock, so no live database is needed in CI.

---

## 3. Setup — Docker (single command, production-like)

```bash
docker compose up app
```
Open **http://localhost:8000**.

With live external services (Qdrant + Neo4j + MongoDB containers):
```bash
docker compose --profile full-stack up
```
Edit `.env` (copy from `.env.example`) first to point at MongoDB
Atlas / your own Qdrant / Neo4j / Gemini / Bhashini instead of the bundled
containers.

---

## 4. API Endpoints

| Auth required | Method | Endpoint | Used by |
|---|---|---|---|
| No | GET | `/api/health` | System status check |
| No | POST | `/api/auth/register`, `/api/auth/login` | Login/Register screens |
| No | POST | `/api/translate` | UI language switching (works pre-login) |
| Yes | GET | `/api/auth/me` | Session bootstrap/refresh |
| Yes | POST | `/api/auth/logout`, `/api/auth/roles`, `/api/auth/active-role` | Logout, role management (ProfileView) |
| Yes (owner) | POST | `/api/chat`, `/api/chat/stream`, `/api/query` | Sahayak chat |
| Yes (owner) | GET/POST/DELETE | `/api/conversations`, `/api/conversations/{id}` | Chat session management |
| Yes (owner) | POST | `/api/conversations/{id}/feedback` | Thumbs up/down |
| Yes (owner) | POST | `/api/products/analyze`, GET `/api/products` | Product Analyzer |
| Yes | POST | `/api/ipr/analyze` | IPR Navigator |
| Yes | POST | `/api/abs/analyze`, `/api/tk-abs/analyze` | Traditional Knowledge & ABS |
| Yes | GET | `/api/research/search`, `/api/documents/{id}` | Research repository |
| Yes (owner) | GET/POST/DELETE | `/api/workspace/saved-research` | My Workspace |
| **Admin only** | GET | `/api/admin/documents`, `/api/admin/telemetry` | Admin & Telemetry view |
| **Admin only** | POST | `/api/admin/documents`, `/api/admin/documents/{id}/index`, `/api/documents/ingest` | Document management |
| **Expert/Admin only** | GET/PATCH | `/api/expert-escalations`, `/api/expert-escalations/{id}` | Escalation queue (backend-only — see report) |
| Yes | POST | `/api/classify`, `/api/search`, `/api/validate` | Canonical pipeline stages |
| Yes | GET | `/api/sources` | Full indexed corpus listing |
| Yes | POST | `/api/expert-escalation` | Manual escalation request |

"Owner" means the endpoint returns/modifies only the current user's own
data (Admins can additionally view any conversation).

---

## 5. Environment Variables

Full commented list: `backend/.env.example`.

| Variable | Effect when set | Fallback when blank |
|---|---|---|
| `MONGODB_URI`, `MONGODB_DB_NAME` | Real MongoDB (Atlas or self-hosted) | In-memory mock (DEMO MODE, non-persistent) |
| `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_EXPIRE_MINUTES` | Session token signing | Insecure default secret — **change this before any real deployment** |
| `LLM_API_KEY`, `LLM_MODEL` | Live Gemini reasoning | Rule-based synthesis |
| `QDRANT_URL`, `QDRANT_API_KEY` | Live Qdrant | Local TF-IDF index |
| `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` | Live Neo4j | In-process NetworkX graph |
| `BHASHINI_API_KEY`, `BHASHINI_USER_ID` | Live Bhashini translation | Curated dictionary |
| `FRONTEND_ORIGIN` | CORS allow-list | `http://localhost:3000` |

---

## 6. Troubleshooting

**Login/Register fails with a network error**
→ Make sure the backend is running on port 8000
(`curl http://localhost:8000/api/health`). The frontend proxies `/api/*`
to it — if the backend isn't up, nothing works.

**"Invalid or expired session" right after logging in**
→ Check `JWT_SECRET` didn't change between when the token was issued and
now (e.g. backend restarted with a different `.env`). Log in again.

**403 on an endpoint you expect to work**
→ That endpoint is role-gated (Admin-only, or Expert/Admin-only — see the
table above) or it belongs to another user. Check the account's roles via
`GET /api/auth/me`.

**CORS error in the browser console**
→ Only happens off the standard ports (3000/8000). Update
`FRONTEND_ORIGIN` in `backend/.env` and/or the proxy target in
`frontend/vite.config.ts` if you changed either.

**`ModuleNotFoundError` on backend start**
→ You're not inside the virtual environment — re-activate it before
`uvicorn`.

**`npm install` fails with `EBADPLATFORM` / rollup errors**
→ Fixed in this integration (see `INTEGRATION_REPORT.md`, Section "Frontend
packaging fix"). If you still see it, delete `frontend/package-lock.json`
and `frontend/node_modules` and reinstall.

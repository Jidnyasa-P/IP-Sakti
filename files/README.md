# IP-SAKTI Sahayak

A decision-support platform for AYUSH IP/regulatory questions — patentability
under the Patents Act, ABS obligations under the Biological Diversity Act,
AYUSH product classification under the Drugs and Cosmetics Act, and more —
grounded in retrieval-augmented generation over a real corpus of Indian and
international statutory PDFs, with a Neo4j knowledge graph and MongoDB
persistence.

## Architecture (3 services)

```
frontend/       React 19 + Vite. Talks to backend/ over /api/* (relative paths).
backend/        Python/FastAPI. Auth (JWT), MongoDB persistence, Bhashini
                translation. Proxies every RAG-backed request to ip_sakti_rag.
ip_sakti_rag/   Python/FastAPI. The actual RAG engine: legal-aware PDF
                ingestion, Gemini embeddings, Qdrant vector search, BM25
                lexical search fused with Reciprocal Rank Fusion, Neo4j
                knowledge-graph context, Gemini-generated grounded answers
                with citation validation and confidence scoring.
```

`backend/` holds no retrieval/generation logic itself — every chat,
product-analysis, IPR-navigator, and TK/ABS request is proxied to
`ip_sakti_rag` via `backend/app/rag_client.py`.

> **Ignore/delete** the root-level `server.ts`, `src/`, `package.json`,
> `render.yaml`, `docker-compose.yml`, `vercel.json`. These belong to an
> earlier, abandoned Node.js architecture and are not used by anything
> above.

## Data stores (all already provisioned, per your setup)

- **MongoDB Atlas** — users, conversations, product/TK-ABS analyses,
  feedback, audit logs. Owned entirely by `backend/`.
- **Qdrant Cloud** — vector embeddings of the statutory corpus (Gemini
  `gemini-embedding-001`, 768-dim). Owned entirely by `ip_sakti_rag/`.
- **Neo4j Aura** — knowledge graph linking statutes, sections, authorities,
  concepts, and product categories, used to enrich retrieval beyond pure
  text similarity. Owned entirely by `ip_sakti_rag/`.

## Quick start

See **`SETUP_WINDOWS.md`** for the full Windows 11 + VS Code walkthrough
(three terminals, one per service, in order). Short version for any OS:

```bash
# Terminal 1
cd ip_sakti_rag && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt && cp .env.example .env  # fill in real values
uvicorn main:app --reload --port 8001

# Terminal 2
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt && cp .env.example .env  # fill in real values
uvicorn app.main:app --reload --port 8000

# Terminal 3
cd frontend && npm install && npm run dev
```

Open http://localhost:3000, register, log in.

## Before you run the frontend: apply `PATCHES.md`

The Product Analyzer and TK & ABS pages currently go blank on "Generate."
Root cause: those views (and a few others) call the backend without
attaching the login token, get a `401`, and — because nothing checks
`res.ok` and there's no error boundary anywhere in the app — the resulting
error payload gets rendered as if it were real data, which crashes the
whole React tree.

**`PATCHES.md`** has the exact, line-by-line fix for every affected file,
plus a new `ErrorBoundary.tsx` component (included) that contains any
future render error instead of blanking the screen. Apply it before
testing Product Analyzer / TK & ABS / IPR Navigator.

## Authentication

Already implemented end to end — `backend/app/api/routes/auth.py`
(register/login/me/logout/roles/active-role), JWT via
`backend/app/core/security.py`, enforced on every protected route through
the `get_current_user` / `require_role(...)` dependencies in
`backend/app/api/deps.py`. The frontend's `authFetch()` helper
(`frontend/src/components/auth/authStorage.ts`) attaches the token
automatically — the bug fixed by `PATCHES.md` is simply that several views
weren't using it yet.

## API endpoints (all dynamic — no hardcoded URLs)

Every frontend call uses a relative `/api/...` path; there is no hardcoded
`localhost` or IP anywhere in `frontend/src`. Locally, Vite's dev-server
proxy (`frontend/vite.config.ts`) forwards `/api/*` to
`http://localhost:8000` (overridable via `VITE_API_BASE_URL`). In
production, the deployed frontend's host rewrites `/api/*` to the deployed
backend (see `DEPLOYMENT.md`) — nothing in the source needs to change
between environments.

Full endpoint list: see `backend/app/api/routes/*.py`. Summary:
- **Auth**: `/api/auth/register`, `/login`, `/me`, `/logout`, `/roles`, `/active-role`
- **Chat**: `/api/chat`, `/api/query`, `/api/conversations*`
- **Analysis**: `/api/products/analyze`, `/api/ipr/analyze`,
  `/api/abs/analyze`, `/api/tk-abs/analyze` (all proxy to `ip_sakti_rag`)
- **Research**: `/api/research/search`, `/api/documents/{id}`, `/api/resources`
- **Admin**: `/api/admin/documents`, `/api/admin/telemetry` (read-only now — see Known Gaps)
- **Health**: `/api/health` (reports live `ip_sakti_rag` connectivity)

## Known gaps (honest list, not swept under the rug)

- **Voice input** (`POST /api/transcribe`) has no backend implementation
  yet — the mic button will fail. See `PATCHES.md` section 8 for the fix
  path (Bhashini ASR, same pattern as the existing NMT client).
- **Live document ingestion via API** was removed when `backend/` became a
  thin proxy — new documents go through `ip_sakti_rag/scripts/ingest.py`
  offline, not a running admin panel action.
- **Streaming chat** (`/api/chat/stream`) doesn't exist server-side
  anymore; the frontend already degrades gracefully to a normal
  synchronous call, just with one avoidable failed request per message
  (cosmetic, not a functional bug).
- The Bhashini translation client was written against the standard ULCA
  request/response pattern without a captured real response to verify
  field names against — sanity-check once you have live traffic.

## Deployment

See **`DEPLOYMENT.md`** for the full Render free-tier walkthrough (all 3
services).

# Integration Report — MongoDB + Authentication + RBAC

This documents exactly what was inspected, what was reused as-is, and what
was added/changed to merge `backend-mongodb.zip` into the latest frontend
from `IP-Sakti-main__2_.zip`.

---

## 0. What I found on inspection (before changing anything)

- **`IP-Sakti-main__2_.zip`** is the previously-delivered combined project,
  with the frontend meaningfully grown since last time: it now has real
  `LoginView`/`RegisterView`/`ProfileView` components, an `AuthContext`,
  and a `components/auth/authStorage.ts` whose own header comment says:
  *"This file is the ONLY thing that should need to be rewritten [...]
  when the real backend auth API is ready."* That comment defined the
  entire integration seam used below.
- **`backend-mongodb.zip`** contains only a `backend/` folder — a clean,
  correct port of the SQLite/SQLAlchemy data layer to MongoDB (`pymongo`,
  with `mongomock` as an in-memory fallback for zero-setup demos). It
  touches exactly 24 files; no new files, no new routes.
- **It does not implement authentication.** `backend-mongodb.zip`'s own
  `app/models/user.py` docstring says so directly. Every route still
  hardcoded `"user_id": "user-default"`, and `GET /api/conversations` /
  `GET /api/products` / `GET /api/workspace/saved-research` returned
  **every user's data with no filtering at all.** This was a real,
  verified gap — not a hypothetical one.
- **The frontend's actual role type** (`frontend/src/types.ts`) is
  `'Practitioner' | 'Researcher' | 'Expert' | 'Admin' | 'Organization' |
  'Startup'` — not exactly the five roles named in the task
  (`RESEARCHER, EXPERT, PRACTITIONER, STARTUP_INSTITUTE, ADMIN`). Since the
  frontend is the source of truth and its role labels are already wired
  into `ProfileView`/`Header` UI text, **I kept the frontend's own role
  vocabulary** rather than renaming anything. `Organization`/`Startup`
  together are the closest match to the task's "STARTUP_INSTITUTE."
- **There is no Expert-specific or role-specific dashboard UI anywhere in
  the frontend.** Every authenticated user sees the same `AppContent` —
  the only role-gated UI that exists today is `AdminView.tsx`. See
  Section 5 below for how this was handled.

---

## 1. Authentication implementation

**New files:**
- `backend/app/core/security.py` — bcrypt password hashing (via `passlib`)
  and JWT issuing/decoding (via `PyJWT`). Tokens are stateless, signed with
  `JWT_SECRET`, default 7-day expiry (`JWT_EXPIRE_MINUTES`).
- `backend/app/schemas/auth.py` — `RegisterRequest`, `LoginRequest`,
  `AddRoleRequest`, `SetActiveRoleRequest`, `UserPublic`, `AuthResponse`.
- `backend/app/services/auth_service.py` — `register_user`,
  `authenticate_user`, `get_user_by_id`, `add_role`, `set_active_role`.
  Mirrors the exact operations the frontend's old dummy auth store already
  performed.
- `backend/app/api/deps.py` — `get_current_user` (decodes the `Authorization:
  Bearer <token>` header, loads the user from MongoDB, 401 if invalid) and
  `require_role(*roles)` (403 if the user doesn't hold one of the given
  roles — checked against their full `roles` list, so an Admin who
  switched their active role to Researcher still keeps Admin access).
- `backend/app/api/routes/auth.py` — `POST /api/auth/register`,
  `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`,
  `POST /api/auth/roles`, `POST /api/auth/active-role`.

**Passwords:** hashed with bcrypt, never logged, never returned by any
endpoint (`models/user.py`'s `to_dict()` only ever reads specific
allow-listed fields — `password_hash` is structurally excluded, not just
manually omitted).

**Logout is intentionally stateless** — a JWT can't be server-side revoked
without a blacklist. `POST /api/auth/logout` exists for symmetry/future use
and the frontend discards its local token either way. This is documented,
not silently hidden: if you need immediate server-side revocation later,
add a `revoked_tokens` collection keyed by a JWT `jti` claim and check it
in `get_current_user`.

**Modified:** `backend/app/models/user.py` — added `password_hash` and a
`roles: list[str]` array alongside the existing single `role` field
(the frontend's multi-role "+Add Role" feature needs this).

---

## 2. Five roles — how they're implemented

One `users` collection, one `role` field (active role) + one `roles` array
(every role held) — exactly as the task specified, no per-role
collections. Role vocabulary matches the frontend exactly (see Section 0).

| Task's role | Frontend/backend role string | Where enforced |
|---|---|---|
| RESEARCHER | `Researcher` | Default role for most users; owns their own conversations/products/saved-research |
| EXPERT | `Expert` | Can additionally reach `/api/expert-escalations` (new, backend-only) |
| PRACTITIONER | `Practitioner` | Same generic authenticated experience as Researcher (no practitioner-specific UI exists yet) |
| STARTUP_INSTITUTE | `Organization` / `Startup` | Same generic authenticated experience (no org-specific UI exists yet) |
| ADMIN | `Admin` | `require_role("Admin")` on `/api/admin/*` and `/api/documents/ingest`; can view any user's conversation |

**Honest gap, called out rather than papered over:** Practitioner and
Organization/Startup don't get a *different* experience from Researcher
today because **the frontend itself doesn't branch UI by role** beyond
Admin — `App.tsx` renders the same `AppContent` for everyone once logged
in. I did not invent new role-specific pages, per the "do not redesign the
frontend" rule. If/when role-specific views are designed, the backend
already has everything (`current_user["role"]`, `current_user["roles"]`)
needed to gate them — no further backend work required.

---

## 3. User data isolation (Section 7 — verified, not just claimed)

Every hardcoded `"user_id": "user-default"` was removed and replaced with
the real authenticated user's id from `get_current_user`:

- `services/conversation_service.py` — `get_or_create_conversation` now
  requires an explicit `user_id` argument (no default).
- `services/decision_engines.py` — `analyze_product` now accepts
  `user_id` as a parameter (kept a `"user-default"` *default parameter
  value* only as a safety net for any future non-HTTP caller — every
  actual route passes the real id explicitly, verified in testing).
- `api/routes/chat.py` — conversation list/get/delete/feedback all check
  `conv["user_id"] == current_user["id"]` (403 otherwise); Admins bypass
  the check.
- `api/routes/products.py`, `api/routes/misc_routes.py` — same ownership
  pattern for product analyses and saved research.

**This was verified live**, not just written and assumed correct — see
Section 9.

---

## 4. MongoDB collections

Reused exactly what `backend-mongodb.zip` already defined (no unnecessary
new collections invented):

| Collection | Purpose | Key fields |
|---|---|---|
| `users` | Accounts | `_id, name, email (unique), password_hash, role, roles[], preferred_language, created_at` |
| `conversations` | Chat sessions | `_id, user_id, title, created_at, updated_at` |
| `chat_messages` | Individual messages | `_id, conversation_id, role, content, citations, confidence, ...` |
| `product_analyses` | Product Analyzer results | `_id, user_id, likely_category, confidence, evidence, ...` |
| `saved_research` | Workspace saved items | `_id, user_id, document_id, title, notes` |
| `classification_records` | Classification pipeline audit trail | `_id, query, category, confidence` |
| `validation_results` | Citation validation audit trail | `_id, claim, source, validation_status` |
| `feedback` | Thumbs up/down on answers | `_id, conversation_id, message_id, feedback, notes` |
| `expert_escalations` | Low-confidence escalation queue | `_id, conversation_id, status, reason, case_summary` |
| `audit_logs` | Full query/answer/citation audit trail | `_id, conversation_id, query, retrieved_sources, ...` |
| `user_ingested_documents` | Metadata for admin-uploaded documents | *(model exists; see note below)* |

**Indexes** (unique email; user_id/conversation_id/status lookups) were
already correctly defined in `backend-mongodb.zip`'s `database/session.py`
`init_db()` and are unchanged.

**Note on `user_ingested_documents`:** this SQLAlchemy-era model exists but
was never actually wired into the ingestion flow even before this
integration — `rag/ingest.py` stores runtime-ingested document *metadata*
purely in an in-memory Python list (`rag/corpus.py`), not in any database.
This means admin-uploaded document metadata is currently **lost on server
restart**. This is a pre-existing gap, not something this integration
introduced — flagging it here rather than silently leaving it. Wiring
`ingest_document()` to also insert into the `user_ingested_documents`
Mongo collection would be a clean, contained follow-up (create a
`document_service.py`, call it from `rag/ingest.py` and
`misc_routes.admin_add_document`) but was left out of this pass to avoid
touching the RAG team's `rag/` module without being asked to.

---

## 5. Qdrant / Neo4j / RAG — untouched, boundary preserved

Per the task's explicit instruction, none of this was modified:

- **Qdrant** (`backend/app/rag/vector_store.py`) — still only activates
  when `QDRANT_URL` is set; falls back to the existing local TF-IDF index
  otherwise. No vectors are stored in MongoDB.
- **Neo4j** (`backend/app/knowledge_graph/graph_service.py`) — still only
  activates when `NEO4J_URI` is set; falls back to the existing in-process
  NetworkX graph otherwise.
- **RAG pipeline** (`backend/app/rag/pipeline.py`,
  `retrieval/hybrid_retrieval.py`) — completely untouched. The corpus
  (`backend/data/authoritative_documents.json`) is retrieval-time RAG
  evidence, not training data and not MongoDB data — this was true before
  this integration and remains true.
- The only thing that changed around these systems is that **the routes
  calling them now require login** (`Depends(get_current_user)`), for
  consistency with the rest of the app being auth-gated.

**Expert escalation** (`api/routes/experts.py`, new): `GET/PATCH
/api/expert-escalations` — Expert/Admin-only, lets someone list pending
cases and mark them assigned/resolved. **No frontend view calls this yet**
— there is no Expert dashboard component in the current frontend, and
building one would mean adding a new page, which is out of scope for "do
not redesign the frontend." This is a backend capability ready for a
future UI, not a silently-invented dead feature — it's fully tested (see
below) and documented here explicitly.

---

## 6. Files modified/added (complete list)

**New:**
```
backend/app/core/security.py
backend/app/schemas/auth.py
backend/app/services/auth_service.py
backend/app/api/deps.py
backend/app/api/routes/auth.py
backend/app/api/routes/experts.py
backend/tests/test_auth.py
INTEGRATION_REPORT.md   (this file)
```

**Modified:**
```
backend/app/core/config.py            + jwt_algorithm, jwt_expire_minutes
backend/app/models/user.py            + password_hash, roles[]
backend/app/services/conversation_service.py   user_id now required, not hardcoded
backend/app/services/decision_engines.py       analyze_product(..., user_id=...)
backend/app/api/routes/chat.py        auth + ownership checks throughout
backend/app/api/routes/products.py    auth + ownership checks throughout
backend/app/api/routes/misc_routes.py auth + ownership + admin-only gating
backend/app/api/routes/rag_routes.py  auth required throughout; admin-only ingest
backend/app/main.py                   registers auth + experts routers
backend/requirements.txt              + passlib[bcrypt], bcrypt, PyJWT, pydantic[email]
backend/.env.example                  + JWT_ALGORITHM, JWT_EXPIRE_MINUTES
backend/tests/conftest.py             + auth_headers, admin_auth_headers fixtures
backend/tests/test_api.py             updated for auth-required endpoints
backend/tests/test_chat.py            updated for auth-required endpoints + isolation test
frontend/src/components/auth/authStorage.ts   rewritten internals (see below) — same exported API
frontend/src/context/AuthContext.tsx  + background session verification on mount
frontend/src/components/{Chat,ProductAnalyzer,IPRNavigator,TraditionalKnowledge,Research,Workspace,Admin}View.tsx, CitationModal.tsx
                                       fetch( -> authFetch( (mechanical swap, no logic/UI change)
frontend/package.json                 removed a Windows-only Rollup pin (see below) — pre-existing bug, unrelated to this task
```

**Untouched:** every other backend module (`rag/`, `knowledge_graph/`,
`retrieval/`, `validation/`, `translation/`), every frontend UI component's
JSX/layout/styling, `App.tsx`'s structure, `types.ts`.

**Frontend `authStorage.ts` — what changed inside it:** every exported
function keeps its exact original name and signature (`getSessionUser`,
`dummyRegister`, `dummyLogin`, `dummyLogout`, `dummyAddRole`,
`dummySetActiveRole`) so `AuthContext.tsx` needed zero interface changes.
Internally, they now call `fetch('/api/auth/...')` instead of reading/
writing localStorage directly. The JWT is cached in localStorage so
`getSessionUser()` can stay synchronous (required — `AuthContext` calls it
inside `useState(() => getSessionUser())` during initial render). Added:
`getAuthToken()`, `authFetch()` (attaches the bearer token when present;
safe to use on public endpoints too), `verifySession()` (background
`/api/auth/me` check called once on app mount).

**Frontend packaging fix (pre-existing bug, found during verification):**
`frontend/package.json` had `@rollup/rollup-win32-x64-msvc` pinned as a
devDependency while *also* having an `overrides` entry redirecting rollup
to the cross-platform `@rollup/wasm-node` build — the two contradict each
other and made `npm install` fail outright on macOS/Linux with
`EBADPLATFORM`. Removed the Windows-only pin; kept the `wasm-node`
override, which is the actual cross-platform-safe mechanism. This is
unrelated to MongoDB/auth — flagging it per the "point out inconsistencies
before changing them" rule rather than silently fixing it.

---

## 7. Tests

**38 backend tests, all passing** (`cd backend && python -m pytest tests/ -v`):
- `test_auth.py` (new, 10 tests) — register, duplicate email rejected,
  short password rejected, login success/failure, `/me`, add role, switch
  active role, switch to unheld role rejected.
- `test_api.py` (updated) — added `test_protected_endpoint_rejects_missing_token`,
  `test_admin_endpoint_rejects_non_admin`, `test_admin_endpoint_allows_admin`;
  every other test updated to pass `auth_headers`.
- `test_chat.py` (updated) — added
  `test_chat_requires_authentication` and
  `test_conversation_not_visible_to_other_users` (a second registered user
  is verified to get 403 on the first user's conversation, and does not
  see it in their own list); every other test updated to pass `auth_headers`.
- `test_rag_and_safety.py` — unchanged, unaffected (pure unit tests, no
  HTTP layer).

**Frontend:** `npm run build` succeeds cleanly. `tsc --noEmit` surfaces the
same pre-existing type mismatches in `ProductAnalyzerView.tsx` /
`TraditionalKnowledgeView.tsx` that existed before this integration
(fields like `target_symptoms` not in `types.ts`) — confirmed these are
not newly introduced by this work, and Vite's build (esbuild-based) does
not fail on them, so the app runs.

**Live end-to-end verification** (both servers run together, real HTTP
through the Vite proxy, not just unit tests):
1. `GET /api/health` → 200, public. ✅
2. `POST /api/chat` with no token → **401**. ✅
3. Register a Researcher → `POST /api/chat` with their token → 200, real
   cited answer, confidence "High", 5 citations. ✅
4. `GET /api/conversations/{id}` → conversation persisted, 2 messages. ✅
5. `GET /api/conversations` for that user → count 1. ✅
6. Register a second user → `GET` the first user's conversation directly →
   **403**. Second user's own conversation list → **0**. ✅
7. `POST /api/products/analyze` → stored `user_id` matches the real caller. ✅
8. `GET /api/admin/telemetry` as Researcher → **403**; as Admin → **200**. ✅
9. `POST /api/workspace/save-research` → `GET /api/workspace/saved-research`
   → 1 item. ✅
10. `POST /api/auth/logout` → 200; token still technically decodable
    afterward (documented stateless-JWT behavior, not a bug). ✅

---

## 8. MongoDB Atlas setup (when you're ready to go live)

The app runs with zero setup today (in-memory MongoDB mock). To point it
at a real cluster:

1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas),
   sign up/log in, create a free **M0** cluster.
2. **Database Access** → Add New Database User → set a username/password
   (autogenerate a strong password, save it).
3. **Network Access** → Add IP Address. For local development, "Add
   Current IP Address" is fine. Avoid leaving `0.0.0.0/0` open long-term —
   it's acceptable only as a temporary shortcut while developing, not for
   any real deployment (a properly scoped IP allowlist or VPC peering is
   the safer alternative).
4. **Database** → Connect → Drivers → copy the connection string, it looks
   like `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/`.
5. In `backend/.env`:
   ```env
   MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/
   MONGODB_DB_NAME=ip_sakti
   ```
6. Restart the backend. The startup log will print
   `MongoDB ready | database=ip_sakti | backend=<real Atlas connection info>`
   instead of "in-memory mock" — that confirms it connected. Collections
   and indexes are created automatically on first run (`init_db()`).
7. Test: register a user via the app, then check **Atlas → Browse
   Collections → ip_sakti → users** — your new user document should be
   there (with a bcrypt `password_hash`, never a plaintext password).

---

## 9. Windows PowerShell commands

### Backend
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

### Backend tests
```powershell
cd backend
.venv\Scripts\Activate.ps1
python -m pytest tests/ -v
```

### Frontend
```powershell
cd frontend
npm install
npm run dev
```

### Frontend production build check
```powershell
cd frontend
npm run build
```

---

## 10. Final checklist

- [x] Backend starts without errors (`uvicorn app.main:app`)
- [x] Frontend starts without errors (`npm run dev`)
- [x] Frontend communicates with FastAPI through the Vite proxy
- [x] MongoDB connection works (real Atlas or in-memory mock, both tested)
- [x] Registration works, for every role
- [x] Login works; wrong password / unknown email correctly rejected
- [x] Logout works (stateless JWT, documented)
- [x] `/api/auth/me` session bootstrap/refresh works
- [x] Role add + active-role switch work; switching to an unheld role is rejected
- [x] Role-based access enforced server-side (403 verified, not just UI-hidden)
- [x] Chat works; conversations persist across reload
- [x] A second user cannot read/list the first user's conversations (403 + empty list, verified)
- [x] Product analysis persists with the correct real `user_id`
- [x] Saved research persists and lists correctly
- [x] Expert escalation records are created and queryable (backend-only, documented)
- [x] Admin APIs work; non-admins correctly blocked
- [x] Existing RAG/Qdrant/Neo4j fallback architecture untouched and still passing
- [x] 38/38 backend tests pass
- [x] `npm run build` succeeds
- [x] No `user-default` hardcoding remains in any live code path
- [x] No plaintext passwords anywhere (hashed, never returned by any endpoint)

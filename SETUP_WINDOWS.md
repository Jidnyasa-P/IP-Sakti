# IP-SAKTI Sahayak — Windows 11 + VS Code Setup

Three services, run in three separate VS Code integrated terminals, in this
order (order matters — `backend` needs `ip_sakti_rag` reachable, `frontend`
needs `backend` reachable):

```
ip_sakti_rag/   Python — the RAG engine (retrieval, LLM, knowledge graph)
backend/        Python — auth, MongoDB, translation. Proxies RAG calls to ip_sakti_rag.
frontend/       React/Vite. Talks to backend/ over /api/*.
```

Ignore/delete the root-level `server.ts`, `src/`, `package.json`,
`render.yaml`, `docker-compose.yml` — leftover from an earlier, abandoned
Node-based architecture. They are not used.

## 0. Install once

- **Python 3.12+** — https://www.python.org/downloads/ — during install,
  tick **"Add python.exe to PATH"**.
- **Node.js 18+ (LTS)** — https://nodejs.org
- **VS Code** with the **Python** extension (Microsoft) and the **ES7+
  React/Redux/JS snippets** or just the built-in TS/JS support.
- **Git** (for cloning/pulling) if not already installed.
- Open the project folder in VS Code: `File > Open Folder...` → select the
  repo root (`IP-Sakti-main` or whatever you named it after cloning).

## 1. `ip_sakti_rag/` — the RAG engine (Terminal 1)

Open a terminal in VS Code: `` Terminal > New Terminal ``, then:

```powershell
cd ip_sakti_rag
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

If PowerShell blocks the activation script with an execution-policy error,
run this once (as your normal user, not admin) and retry:
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Copy the env template and fill in real values:
```powershell
copy .env.example .env
notepad .env
```
Required: `LLM_API_KEY` (Gemini), `QDRANT_URL`, `QDRANT_API_KEY`,
`QDRANT_COLLECTION`, and if you're using the knowledge graph:
`NEO4J_ENABLED=true`, `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`.

The corpus is already ingested if `data/processed/chunks.jsonl` exists in
your copy. If you add new PDFs to `data/documents/` (and list them in
`data/documents/manifest.json`), re-run:
```powershell
python scripts/ingest.py
```

Start it:
```powershell
uvicorn main:app --reload --port 8001
```

Verify in a browser: http://localhost:8001/api/health → `{"status": "ok"}`.
**Leave this terminal running.**

## 2. `backend/` — auth + persistence (Terminal 2)

New terminal (`` Ctrl+Shift+` ``, or the `+` in the terminal panel):

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
notepad .env
```

Fill in `backend/.env`:
```ini
APP_ENV=development
APP_PORT=8000
FRONTEND_ORIGIN=http://localhost:3000

MONGODB_URI=<your MongoDB Atlas connection string>
MONGODB_DB_NAME=ip_sakti

RAG_SERVICE_URL=http://localhost:8001
RAG_SERVICE_SHARED_SECRET=

TRANSLATION_PROVIDER=bhashini
BHASHINI_API_KEY=<your key>
BHASHINI_USER_ID=<your user id>

JWT_SECRET=<any long random string — generate one, don't leave this blank>
```

Start it:
```powershell
uvicorn app.main:app --reload --port 8000
```

Verify: http://localhost:8000/api/health → look for `"rag_service":
"connected (ok)"`. If it says `unreachable`, go back to Terminal 1 and
confirm `ip_sakti_rag` is actually running and `RAG_SERVICE_URL` matches
its port. **Leave this terminal running too.**

## 3. `frontend/` (Terminal 3)

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. Vite proxies `/api/*` to `http://localhost:8000`
automatically (see `frontend/vite.config.ts`) — you don't need to configure
a base URL for local dev.

## 4. First run — register a user and test end to end

1. On http://localhost:3000, register a new account (this hits `POST
   /api/auth/register` on the backend, stored in MongoDB).
2. Log in.
3. Send a chat message — should return a real, cited answer (grounded in
   `ip_sakti_rag`'s indexed PDFs, not a placeholder).
4. Try Product Analyzer: load one of the three preset buttons, click
   Generate. **If you're on the unpatched code, this currently shows a
   blank page — apply `PATCHES.md` first** (see the file included
   alongside this guide).
5. Try TK & ABS the same way.

## VS Code tips specific to this repo

- **Multi-root terminals**: use the terminal split/dropdown to keep all
  three running visibly at once instead of hunting through one terminal's
  history.
- **Python interpreter**: VS Code may default to the wrong Python. For each
  of `ip_sakti_rag/` and `backend/`, run `Python: Select Interpreter`
  (Ctrl+Shift+P) and pick that folder's `venv\Scripts\python.exe` so
  IntelliSense/linting matches what actually runs.
- **`.env` files are gitignored on purpose** — don't remove them from
  `.gitignore`. If you ever see real API keys inside a `.env` that's
  already committed to git history, rotate those keys immediately (git
  history keeps old commits even after you delete the file later).
- **Common Windows-specific errors**:
  - `ModuleNotFoundError: No module named 'app...'` when running a script
    directly — make sure you're running it from inside the correct folder
    (`ip_sakti_rag/` or `backend/`) with that folder's venv activated, and
    that you haven't manually deleted/moved files inside `app/` (a missing
    subfolder, not a missing `__init__.py`, is the usual cause — Python 3
    handles missing `__init__.py` fine on its own).
  - `UnicodeDecodeError` reading `.env` — save it as UTF-8 in Notepad
    (`Save As` → Encoding: UTF-8), not UTF-16, which Notepad sometimes
    defaults to.
  - PDF ingestion OCR (`pytesseract`/`pdf2image`) needs `tesseract-ocr` and
    `poppler` installed separately on Windows and added to PATH — only
    needed if you re-run ingestion over scanned (non-text) PDFs. Skip this
    if your corpus already has `data/processed/chunks.jsonl`.

## Next: production deployment

See **`DEPLOYMENT.md`** for deploying all three services to Render's free
tier.

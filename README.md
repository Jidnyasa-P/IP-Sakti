# IP-SAKTI Sahayak

Multilingual RAG-based AI assistant for IP and regulatory guidance in Ayurveda.

**This README is written specifically for Windows 11 + VS Code.** All commands
below are PowerShell (VS Code's default integrated terminal on Windows). Where
Command Prompt (cmd.exe) differs, it's called out.

This repo has **three parts**:

```
IP-Sakti\
├── frontend\             React + Vite chat UI
├── backend\               FastAPI backend (own built-in retrieval/graph fallbacks)
├── ip_sakti_rag_model\    Standalone RAG engine (real Qdrant + BM25 + Neo4j + Gemini)
└── scripts\
```

**Important — read before setting anything up:** `backend\` ships with its
_own_ built-in, zero-dependency fallbacks for vector search (a local
numpy/TF-IDF index) and graph context (an in-process NetworkX graph), so it
runs standalone with no external services. `ip_sakti_rag_model\` is a
separate, more complete RAG engine with real Qdrant, real BM25, optional real
Neo4j, and OCR-aware ingestion. **They are not wired together yet.** Section 6
shows how to point the backend at the real RAG engine instead of its built-in
fallback — do that once you have real source documents ingested.

---

## 1. Open the project in VS Code

```powershell
git clone https://github.com/Jidnyasa-P/IP-Sakti.git
cd IP-Sakti
code .
```

**Recommended VS Code extensions** (install from the Extensions panel,
`Ctrl+Shift+X`):

- **Python** (ms-python.python) + **Pylance** — for `backend\` and `ip_sakti_rag_model\`
- **ESLint** and **Prettier** — for `frontend\`
- **Docker** (ms-azuretools.vscode-docker) — if you use Docker for Qdrant/Neo4j
- **REST Client** or **Thunder Client** — handy for poking the FastAPI backend directly

This repo has three independent Python/Node roots. VS Code's Python extension
picks one interpreter per workspace by default — if you're switching between
`backend\` and `ip_sakti_rag_model\` a lot, either open each in its own VS Code
window (`code backend`, separately), or use a multi-root workspace
(`File → Add Folder to Workspace...`) and set the interpreter per-folder via
`Ctrl+Shift+P → Python: Select Interpreter`.

---

## 2. Prerequisites (Windows-specific)

| Tool                      | Install command (PowerShell, run as your normal user) | Needed for                                |
| ------------------------- | ----------------------------------------------------- | ----------------------------------------- |
| Python 3.10+              | `winget install Python.Python.3.11`                   | backend, ip_sakti_rag_model               |
| Node.js 18+               | `winget install OpenJS.NodeJS.LTS`                    | frontend                                  |
| Git                       | `winget install Git.Git`                              | cloning                                   |
| Docker Desktop (optional) | `winget install Docker.DockerDesktop`                 | local Qdrant/Neo4j servers                |
| Tesseract OCR (optional)  | see below                                             | ip_sakti_rag_model's scanned-PDF fallback |
| Poppler (optional)        | see below                                             | pdf2image, used by the OCR fallback       |

After installing, **close and reopen VS Code's terminal** so PATH updates take
effect. Verify with:

```powershell
python --version
node --version
git --version
```

### Installing Tesseract OCR on Windows

`winget` doesn't reliably package Tesseract with Windows binaries. Use the
UB-Mannheim installer instead:

1. Download from `https://github.com/UB-Mannheim/tesseract/wiki` (get the
   64-bit `.exe` installer).
2. Run it — default install path is `C:\Program Files\Tesseract-OCR\`.
3. Add that folder to your PATH: **Settings → System → About → Advanced
   system settings → Environment Variables → Path → New** → paste
   `C:\Program Files\Tesseract-OCR\`.
4. Restart VS Code's terminal, then verify: `tesseract --version`.
5. If `pytesseract` still can't find it, set the path explicitly at the top of
   `ip_sakti_rag_model\app\ingestion\extract.py`:
   ```python
   import pytesseract
   pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
   ```

### Installing Poppler on Windows

`pdf2image` (used by the OCR fallback) needs Poppler's binaries on PATH —
there's no pip package that ships the binaries on Windows.

1. Download the latest Windows release from
   `https://github.com/oschwartz10612/poppler-windows/releases` (get the
   `Release-xx.xx.x-0.zip`).
2. Extract it somewhere permanent, e.g. `C:\poppler\`.
3. Add `C:\poppler\Library\bin` to PATH the same way as Tesseract above.
4. Restart the terminal, verify: `pdftoppm -v`.

If you don't need OCR (i.e. all your source PDFs already have a text layer),
you can skip both of these — the pipeline runs fine without them and will
raise a clear error only if it actually hits a scanned PDF.

---

## 3. Qdrant setup (vector store)

`ip_sakti_rag_model` supports three modes, selected via `.env`.

### Option A — Local, on-disk (default, zero setup, free)

Do nothing. Leave `QDRANT_URL` blank. `qdrant-client` runs embedded, storing
vectors under `ip_sakti_rag_model\data\qdrant_local\`. No server, no account.

```env
QDRANT_LOCAL_PATH=./data/qdrant_local
QDRANT_COLLECTION=ip_sakti_chunks
QDRANT_URL=
QDRANT_API_KEY=
```

**Limitation:** only one process can access this folder at a time. Fine for
local dev; if VS Code's debugger and a manually-run terminal both try to open
it simultaneously you'll get a lock error — stop one first.

### Option B — Local Qdrant server via Docker Desktop

Make sure Docker Desktop is running (check the whale icon in the system tray),
then in the VS Code terminal:

```powershell
docker run -p 6333:6333 -p 6334:6334 `
  -v ${PWD}/qdrant_storage:/qdrant/storage `
  qdrant/qdrant
```

(Note the PowerShell line-continuation backtick `` ` `` — in cmd.exe use `^`
instead, or just put it on one line.)

`.env`:

```env
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
```

### Option C — Qdrant Cloud (free tier, for real deployment)

1. Sign up at `https://cloud.qdrant.io`.
2. Create a cluster on the free tier — **check the current free-tier storage
   limit on that page yourself**; it changes over time.
3. Copy the cluster URL and API key from the dashboard.
4. `.env`:

```env
QDRANT_URL=https://your-cluster-id.qdrant.io
QDRANT_API_KEY=your-cloud-api-key
```

Whichever you pick, run ingestion once documents + manifest are in place:

```powershell
cd ip_sakti_rag_model
python scripts\ingest.py
```

This downloads `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
on first run (~118MB, CPU-only, cached under `%USERPROFILE%\.cache\huggingface\`)
and upserts every chunk into whichever Qdrant target `.env` points at.

---

## 4. Neo4j setup (optional knowledge graph)

Fully optional — `NEO4J_ENABLED=false` (default) skips it entirely.

### Option A — Skip it (default)

```env
NEO4J_ENABLED=false
```

### Option B — Local Neo4j via Docker Desktop

```powershell
docker run -p 7474:7474 -p 7687:7687 `
  -e NEO4J_AUTH=neo4j/your-password-here `
  neo4j:5
```

Browser console at `http://localhost:7474`. `.env`:

```env
NEO4J_ENABLED=true
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password-here
```

### Option C — Neo4j Aura (managed, free tier)

1. Sign up at `https://neo4j.com/cloud/aura-free/`.
2. Create a free instance — **check the current free-tier node/relationship
   caps on that page yourself**.
3. Aura shows you a `neo4j+s://...` URI and a generated password once at
   creation — save it immediately.
4. `.env`:

```env
NEO4J_ENABLED=true
NEO4J_URI=neo4j+s://your-instance-id.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-generated-password
```

**Populating the graph** isn't automated by `scripts\ingest.py` — you write a
loader that reads `data\processed\chunks.jsonl` and creates nodes/edges via
`app\retrieval\graph.py`'s `KnowledgeGraphContext`. No schema is shipped
because the entity model depends on decisions you haven't made yet.

---

## 5. BM25 setup (lexical search)

Nothing to install beyond `pip install -r requirements.txt` — `rank-bm25` is
pure Python, no server, no account, no API key, works identically on Windows.
It rebuilds its index in-process from the ingested chunks every time
`IPSaktiRAG` is instantiated. There's no separate BM25 service to run.

---

## 6. Full setup (frontend + rag + backend)

Use three separate VS Code integrated terminals (`` Ctrl+Shift+` `` to open a
new one, or click the `+` in the terminal panel) — one per component.

### 6.1 RAG engine (`ip_sakti_rag_model\`)

```powershell
cd ip_sakti_rag_model
python -m venv .venv
.venv\Scripts\Activate.ps1
```

> If you get _"running scripts is disabled on this system"_, PowerShell's
> execution policy is blocking venv activation. Fix once, as your user (not
> admin): `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then retry.
> In cmd.exe instead, activate with `.venv\Scripts\activate.bat`.

```powershell
pip install -r requirements.txt
copy .env.example .env
```

Edit `.env` in VS Code (`code .env`), fill in `LLM_API_KEY` (optional —
offline grounded synthesis works without it) and your Qdrant/Neo4j choice from
Sections 3–4.

Add real source documents + fill in `data\documents\manifest.json` (see
`docs\SOURCE_ACQUISITION_GUIDE.md` for exactly what to fetch and from where),
then:

```powershell
python scripts\ingest.py
python scripts\test_queries.py
```

`test_queries.py` should print grounded, cited JSON answers — that's your
sanity check that ingestion + retrieval + generation all work end-to-end.

Select this venv as the interpreter for this folder in VS Code:
`Ctrl+Shift+P → Python: Select Interpreter → Enter interpreter path... →
.\.venv\Scripts\python.exe`.

### 6.2 Backend (`backend\`)

New terminal (`` Ctrl+Shift+` ``):

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Defaults: `APP_PORT=8000`, `FRONTEND_ORIGIN=http://localhost:3000`.

**Wiring the real RAG engine into the backend** (replacing its built-in
fallback): the backend has its own `app\rag\pipeline.py`. To use
`ip_sakti_rag_model` instead:

1. Make it importable from the backend's venv:
   ```powershell
   pip install -e ..\ip_sakti_rag_model
   ```
   (needs a minimal `pyproject.toml`/`setup.py` added to `ip_sakti_rag_model\`
   if one doesn't exist yet — ask me to generate one if you want this wired up).
2. In `backend\app\rag\pipeline.py`, replace the built-in retrieval/generation
   calls with `from app.pipeline import IPSaktiRAG` and delegate
   `answer_query`/`analyze_product`/`analyze_ipr`/`analyze_tk_abs` to it — the
   response shapes were designed to match the backend's Pydantic schemas in
   `backend\app\schemas\`.
3. Keep both `.env` files' Qdrant/Neo4j settings in sync.

Run it:

```powershell
uvicorn app.main:app --reload --port 8000
```

**VS Code debugging instead of a bare terminal run** — add this to
`.vscode\launch.json` (create the folder/file if missing):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "FastAPI: backend",
      "type": "debugpy",
      "request": "launch",
      "module": "uvicorn",
      "args": ["app.main:app", "--reload", "--port", "8000"],
      "cwd": "${workspaceFolder}\\backend",
      "envFile": "${workspaceFolder}\\backend\\.env"
    }
  ]
}
```

Then hit `F5` to run with breakpoints.

### 6.3 Frontend (`frontend\`)

Third terminal:

```powershell
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:3000` (see `frontend\vite.config.ts`) and proxies
`/api\*` to `http://localhost:8000`. Override if the backend runs elsewhere:

```powershell
$env:VITE_API_BASE_URL = "http://localhost:9000"
npm run dev
```

### 6.4 Run everything together

With the three terminals from 6.1–6.3 all left running, open
`http://localhost:3000` in your browser. If you're only running the RAG
engine standalone (not through `backend\`), you can instead serve its own
example FastAPI wrapper on port 8000:

```powershell
cd ip_sakti_rag_model
.venv\Scripts\Activate.ps1
uvicorn example_fastapi_integration:app --reload --port 8000
```

### 6.5 Docker Compose (optional, all-in-one)

Make sure Docker Desktop is running first. A `docker-compose.yml` exists at
the repo root for the frontend/backend pair. To add Qdrant and Neo4j as
services, extend it:

```yaml
services:
  qdrant:
    image: qdrant/qdrant
    ports: ["6333:6333"]
    volumes: ["./qdrant_storage:/qdrant/storage"]
  neo4j:
    image: neo4j:5
    ports: ["7474:7474", "7687:7687"]
    environment:
      - NEO4J_AUTH=neo4j/your-password-here
```

Then run:

```powershell
docker compose up --build
```

Point `backend`'s and `ip_sakti_rag_model`'s `.env` files at the Docker
service names (`qdrant`, `neo4j`) instead of `localhost` when running this way.

---

## 7. Troubleshooting (Windows-specific)

- **`.venv\Scripts\Activate.ps1` fails with "cannot be loaded because running
  scripts is disabled"** — see the `Set-ExecutionPolicy` fix in Section 6.1.
- **`pip install` fails on a package needing a C compiler** — rare for this
  project's dependencies, but if it happens, install
  "Desktop development with C++" via the Visual Studio Build Tools installer,
  or prefer the prebuilt wheel by upgrading pip first: `python -m pip install --upgrade pip`.
- **`qdrant-client` "storage folder is already accessed by another instance"**
  — only one process can use local on-disk mode at a time. Stop the other
  terminal/debugger session, or switch to Docker/Cloud mode.
- **OCR fallback doesn't trigger / `pytesseract.pytesseract.TesseractNotFoundError`**
  — Tesseract isn't on PATH. Re-check Section 2's Tesseract steps, restart the
  VS Code terminal (PATH changes don't apply to already-open terminals), or
  set `pytesseract.pytesseract.tesseract_cmd` explicitly as shown above.
- **`pdf2image.exceptions.PDFInfoNotInstalledError`** — same issue but for
  Poppler; re-check the Poppler PATH steps.
- **Frontend can't reach the backend / CORS errors** — confirm `backend` is
  running on the port `vite.config.ts` proxies to (default 8000), and that
  `FRONTEND_ORIGIN` in `backend\.env` matches `http://localhost:3000`.
- **Docker commands hang or fail with "Cannot connect to the Docker daemon"**
  — Docker Desktop isn't running. Start it from the Start menu and wait for
  the whale icon in the system tray to stop animating before retrying.
- **Line-ending warnings from Git (`LF will be replaced by CRLF`)** — harmless
  on Windows; if it bothers you, add a `.gitattributes` with
  `* text=auto eol=lf` at the repo root (ask me to generate one).

---

## 8. Where things actually live

| What                              | Where                                                 |
| --------------------------------- | ----------------------------------------------------- |
| Source-of-truth document manifest | `ip_sakti_rag_model\data\documents\manifest.json`     |
| Document sourcing instructions    | `ip_sakti_rag_model\docs\SOURCE_ACQUISITION_GUIDE.md` |
| Ingestion pipeline                | `ip_sakti_rag_model\scripts\ingest.py`                |
| Sample test queries               | `ip_sakti_rag_model\tests\sample_queries.json`        |
| RAG engine's env template         | `ip_sakti_rag_model\.env.example`                     |
| Backend's env template            | `backend\.env.example`                                |
| Backend API routes                | `backend\app\api\routes\`                             |
| Frontend API contract types       | `frontend\src\types.ts`                               |

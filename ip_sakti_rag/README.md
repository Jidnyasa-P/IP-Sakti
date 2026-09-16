> **Which implementation is "live"? (added 2026-09)**
> This folder contains two implementations. **The root-level microservice
> (`main.py`, `embeddings.py`, `bm25_index.py`, `graph.py`, `retrieval.py`,
> `ingest.py`) is the one being deployed to Render/Vercel and is under
> active maintenance.** The `app/` package below (with `scripts/ingest.py`,
> `pipeline.py`, the classification/jurisdiction/safety modules) was an
> earlier, heavier design for local/GPU-less prototyping and is **not**
> currently wired into deployment — most of this README describes `app/`,
> not the root service. To run the live pipeline:
> ```bash
> cd ip_sakti_rag
> pip install -r requirements.txt
> cp .env.example .env   # fill in LLM_API_KEY, QDRANT_*, NEO4J_*, MONGODB_URI
> python -m ingest        # extracts data/documents/*.pdf, embeds, upserts to Mongo+Qdrant+BM25
> uvicorn main:app --reload --port 8001   # local dev; Render start command: uvicorn main:app --host 0.0.0.0 --port $PORT
> ```
> If you want to migrate the safety/citation-validation/classification logic
> from `app/` onto the root service later, that's a deliberate follow-up
> task, not something silently merged here.

# IP-SAKTI RAG Engine

A standalone, modular **Retrieval-Augmented Generation** layer for **IP-SAKTI Sahayak**
(Multilingual RAG assistant for IP & regulatory guidance in Ayurveda).

This package is built to sit _behind_ your existing React frontend (`/frontend`) and the
FastAPI backend you are writing yourself. It does **not** touch or redesign the frontend.
It only implements the "brain": ingestion → hybrid retrieval → grounded generation →
citation/safety validation → structured output.

It was built by inspecting `Jidnyasa-P/IP-Sakti`:

- `frontend/src/types.ts` — the exact TypeScript contracts (`Citation`, `ConfidenceMetric`,
  `StructuredChatMessage`, `ProductAnalysisResult`, `IPRNavigatorResult`, `TKABSResult`, …)
- `server.ts` — the existing (prototype) Express routes: `/api/chat`, `/api/chat/stream`,
  `/api/products/analyze`, `/api/ipr/analyze`, `/api/abs/analyze` / `/api/tk-abs/analyze`,
  `/api/research/search`, `/api/rag/documents`, `/api/rag/telemetry`, `/api/translate`
- `server/rag/retrieval.ts` — the existing hybrid BM25 + "semantic" fusion + intent
  detection prototype logic (currently a stub without real embeddings/Qdrant)
- `scripts/ingest_documents.py` — the existing ingestion stub

**This package reimplements those same ideas in Python, for real**, with actual
multilingual embeddings, Qdrant vector search, BM25, optional re-ranking, optional
Neo4j, grounded Gemini generation, citation validation and safe abstention — and it
returns a response shape that is a superset of the frontend's `StructuredChatMessage`
so your FastAPI layer can pass it straight through.

---

## 1. Folder structure

```
ip_sakti_rag/
├── app/
│   ├── config.py                # env-driven settings (pydantic-settings)
│   ├── schemas.py                # Pydantic models — the structured contract
│   ├── language.py               # language + intent detection (en/hi/mr)
│   ├── classification.py         # product classification (5 categories)
│   ├── jurisdiction.py           # India / export / PCT jurisdiction detection
│   ├── ingestion/
│   │   ├── extract.py            # PDF/HTML/TXT extraction
│   │   ├── chunker.py            # legal-aware (section/clause) chunking
│   │   ├── metadata.py           # metadata + versioning schema, doc registry
│   │   └── embed_and_index.py    # embeddings → Qdrant + BM25 index build
│   ├── retrieval/
│   │   ├── bm25_index.py         # BM25 lexical index (rank_bm25)
│   │   ├── vector_index.py       # Qdrant wrapper (local file-mode or cloud)
│   │   ├── reranker.py           # optional cross-encoder re-ranking
│   │   ├── graph.py              # optional Neo4j knowledge-graph context
│   │   └── hybrid.py             # fusion of BM25 + vector + rerank + filters
│   ├── generation/
│   │   ├── prompts.py            # grounded-generation system prompt
│   │   ├── llm_client.py         # pluggable LLM client (Gemini free tier + offline fallback)
│   │   └── grounded_generator.py # builds evidence context, calls LLM, parses answer
│   ├── safety/
│   │   ├── citation_validator.py # every cited claim must map to a retrieved chunk
│   │   ├── confidence.py         # confidence scoring
│   │   └── abstention.py         # safe abstention + expert escalation logic
│   └── pipeline.py               # IPSaktiRAG — the single class your FastAPI backend calls
├── data/
│   ├── documents/                # put official source PDFs/HTML/TXT here
│   ├── processed/                # chunked+metadata JSONL produced by ingestion
│   └── qdrant_local/             # local on-disk Qdrant storage (free, no server needed)
├── scripts/
│   ├── ingest.py                 # CLI: run the full ingestion pipeline
│   └── test_queries.py           # CLI: run the sample test queries end-to-end
├── tests/
│   └── sample_queries.json
├── requirements.txt
└── .env.example
```

---

## 2. How this maps onto your existing frontend / routes

| Frontend needs (from `server.ts` / `types.ts`)                  | RAG module call                                      |
| --------------------------------------------------------------- | ---------------------------------------------------- |
| `POST /api/chat`, `/api/chat/stream` → `StructuredChatMessage`  | `rag.answer_query(query, language, conversation_id)` |
| `POST /api/products/analyze` → `ProductAnalysisResult`          | `rag.analyze_product(product_info)`                  |
| `POST /api/ipr/analyze` → `IPRNavigatorResult`                  | `rag.analyze_ipr(ipr_query)`                         |
| `POST /api/abs/analyze` / `/api/tk-abs/analyze` → `TKABSResult` | `rag.analyze_tk_abs(tk_query)`                       |
| `GET /api/research/search` → chunk/document search              | `rag.search_documents(query, filters)`               |
| `GET /api/rag/documents`                                        | `rag.list_documents(filters)`                        |
| `GET /api/rag/telemetry`                                        | `rag.get_telemetry()`                                |

Every method returns **plain JSON-serialisable dicts** (via `.model_dump()` on the
Pydantic schemas in `app/schemas.py`), so your FastAPI backend can do:

```python
from app.pipeline import IPSaktiRAG

rag = IPSaktiRAG()          # loaded once at startup

@app.post("/api/chat")
async def chat(payload: ChatRequest):
    result = rag.answer_query(
        query=payload.query,
        language=payload.language,
        conversation_id=payload.conversation_id,
    )
    return result   # matches StructuredChatMessage + retrieval_metadata
```

The core structured object (superset of what the task asked for) is:

```json
{
  "query": "...",
  "language": "en",
  "product_classification": null,
  "jurisdiction": ["India"],
  "intent": "IPR_PATENTABILITY",
  "answer": "...",
  "citations": [ { "index": 1, "chunk_id": "...", "document_id": "...", "title": "...", "authority": "...", "section": "...", "source": "...", "excerpt": "...", "page": 3 } ],
  "evidence": [ { "chunk_id": "...", "chunk_text": "...", "score": 0.81, ... } ],
  "confidence": { "level": "Moderate", "score": 0.52, "reasons": ["..."] },
  "needs_clarification": false,
  "needs_expert": false,
  "relevant_considerations": ["..."],
  "recommended_next_steps": ["..."],
  "disclaimer": "This is informational guidance, not legal advice. Consult a registered patent agent / regulatory affairs specialist for filings."
}
```

---

## 3. Local setup

```bash
cd ip_sakti_rag
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Fill in LLM_API_KEY (free tier) — optional. Without it the module runs in
# "offline grounded synthesis" mode (evidence-templated answer, no LLM cost/key needed).
```

### 3.1 Acquiring source documents (do this manually, per document)

See **`docs/SOURCE_ACQUISITION_GUIDE.md`** for the full authority-by-authority table
(IP India, NBA, CDSCO/AYUSH, FSSAI, Copyright Office, PPV&FRA, WIPO, CBD, MeitY) with
exact click-paths for each Act/Rule/Treaty this problem statement now covers. Summary
of the rules that guide this step:

- **Only download from the official regulator's own site.** Never substitute a
  law-firm blog, Wikipedia, or a coaching-site "bare act" copy — the exact wording,
  section numbers, and amendment dates matter for citation precision.
- **Static Acts/Rules/Regulations published as PDFs are fine to fetch** (via browser
  or the helper script below) — this isn't "scraping" in the risky sense, it's
  fetching a public government publication. **Don't** scrape live search portals
  (patent/trademark search databases, court databases) — they change constantly,
  aren't meant for bulk extraction, and often sit behind ToS/anti-bot protections.
- **Never fabricate or guess a direct PDF URL.** Government PDF links rotate/break
  often; always record the _page you found it on_, not a constructed URL.
- **Fill in `manifest.json` yourself**, reading title/authority/dates directly off
  the document — the ingestion pipeline deliberately refuses to guess this metadata
  (see `app/ingestion/metadata.py`).
- **`scripts/download_static_sources.py`** is a _helper_, not a guarantee — some
  government sites block generic user-agents or require a browser session, so treat
  any failure as "download this one manually" rather than a bug to chase.

### 3.2 TKDL — what you can and can't do

TKDL access is currently restricted to 14 national/regional patent offices under
bilateral non-disclosure access agreements (examiners only, search/examination
purposes only). A 2022 Cabinet decision approved widening access via a **paid
subscription model, phased in** — there is no public API or bulk dataset.

- This module **never** scrapes, reconstructs, or invents TKDL content — see
  `app/retrieval/tkdl_connector.py`, which is a disabled-by-default placeholder.
- If your institution obtains authorized TKDL access later, implement the real
  client call inside that file; nothing else in the pipeline needs to change.
- Until then, the system correctly does what it should: it tells the user TK
  prior-art needs to be checked via authorized TKDL access, and sets `needs_expert`.
- Optional, clearly-labeled substitute: a "classical-text awareness" flag built from
  genuinely public-domain digitized classical texts (e.g. NAMASTE/NIIMH, CCRAS
  publications) — see the `tkdl_connector.py` docstring. This must never be
  presented to a user as TKDL search; it's a much weaker "this might overlap with
  known classical literature, get it checked" heuristic.

### 3.3 Put source documents in `data/documents/`

Once you have real files with verified metadata, drop them into `data/documents/`
and fill in `data/documents/manifest.json` (copy `manifest.example.json`, which now
includes an entry per document type this expanded problem statement covers — Patents
Act, 2024 Patent Rules, Trade Marks Act, Designs Act, GI Act, Copyright Act, PPV&FR
Act, Biological Diversity Act/Amendment/2024 Rules, Drugs and Cosmetics Act, Drugs and
Magic Remedies Act, FSSAI Ayurveda-Aahar Regulations, DPDP Act 2023, PCT, Madrid/Hague,
Budapest Treaty, WIPO GRATK Treaty, Nagoya Protocol — most with `"url"` left as
`"VERIFY-AND-FILL"` where I could not confirm a stable official link myself; fill
those in only after you've actually located and read the document).
Supported formats: `.pdf`, `.html`, `.txt`.

### 3.4 Run ingestion

```bash
python scripts/ingest.py
```

This will:

1. Extract text from each file in `data/documents/` (`app/ingestion/extract.py`)
2. Perform legal-aware chunking by Chapter → Section → Clause (`chunker.py`)
3. Attach/validate metadata (title, authority, jurisdiction, publication/effective date,
   source URL, version) (`metadata.py`)
4. Embed each chunk with a free multilingual sentence-transformer model and upsert into
   a local (file-based, no server) Qdrant collection, plus build a BM25 index
   (`embed_and_index.py`)

Documents can be re-ingested any time (e.g. when a regulation is amended) — the LLM
never needs retraining, only the metadata/version fields change (`superseded_by`,
`effective_date`, `status`).

### 3.5 Test it

```bash
python scripts/test_queries.py
```

Runs the sample queries in `tests/sample_queries.json` through the full pipeline and
prints the structured JSON output, including the exact example from the brief:

> "Can I patent my new Ayurvedic formulation and export it to Germany?"

---

## 4. Design choices for a FREE, GPU-less SIH prototype

| Component       | Choice                                                                                                                                                                            | Why free / light                                                                                                                                                                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Embeddings      | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (118MB)                                                                                                             | Runs on CPU, covers en/hi/mr, no API cost                                                                                                                                                                                                                                                             |
| Vector store    | Qdrant, **local on-disk mode** (`qdrant-client` embedded, no server)                                                                                                              | Zero infra for dev; swap to **Qdrant Cloud free tier (1 GB cluster)** for deployment — verify current limits at qdrant.tech/pricing before relying on them                                                                                                                                            |
| Lexical search  | `rank_bm25` (pure Python)                                                                                                                                                         | No infra                                                                                                                                                                                                                                                                                              |
| Re-ranking      | Optional `cross-encoder/ms-marco-MiniLM-L-6-v2` via `sentence-transformers`, gated by `RERANKER_ENABLED`                                                                          | Small, CPU-ok; disable on very low RAM (Render/Railway free tier ~512MB)                                                                                                                                                                                                                              |
| Knowledge graph | Optional Neo4j (`app/retrieval/graph.py`), gated by `NEO4J_ENABLED`                                                                                                               | Neo4j Aura has a free tier (check current node/relationship caps before depending on it) — module runs fully without it                                                                                                                                                                               |
| LLM             | Google **Gemini** (`gemini-2.5-flash` / `gemini-2.0-flash`) via free-tier API key, same provider frontend already uses                                                            | Check current Google AI Studio free-tier rate limits before demo day; if unavailable/unset, an **offline grounded synthesis fallback** (`llm_client.py`) builds a templated, citation-grounded answer directly from retrieved chunks — the exact same "resilience" idea already in `server/gemini.ts` |
| Multilingual UI | `app/language.py` keeps translation modular — plug in Anuvadini/BHASHINI later via a `TranslationProvider` interface                                                              | Doesn't block prototype                                                                                                                                                                                                                                                                               |
| Deployment      | FastAPI backend (yours) + this module on **Render/Railway free web service** or a single **Hugging Face Space (CPU)**; Qdrant on local disk for demo or Qdrant Cloud free cluster | No GPU, no paid infra required                                                                                                                                                                                                                                                                        |

**Before deployment**, re-check current pricing/limits yourself for whichever of
Qdrant Cloud, Neo4j Aura, Google AI Studio, and your chosen hosting platform you use —
free tiers change often and this README should not be treated as pricing truth.

---

## 5. Safety pipeline (already wired into `pipeline.py`)

1. **Retrieval** — hybrid BM25 + vector, metadata-filtered by jurisdiction/topic/product type.
2. **Evidence-grounded generation** — the LLM is instructed to answer _only_ from the
   retrieved chunk text and to tag every claim with `[n]` matching a citation index.
   It is never treated as a source of truth on its own.
3. **Citation validation** (`safety/citation_validator.py`) — every `[n]` tag referenced
   in the answer must correspond to a citation that was actually retrieved; any citation
   index the model invents is stripped, logged, and drops the confidence a tier.
4. **Authority check** — chunk metadata must have a known `authority` from an allow-list
   before it can back a claim (prevents laundering low-trust text as authoritative).
5. **Confidence scoring** (`safety/confidence.py`) — combines top fused score, chunk
   count, and citation-validation pass rate into `High / Moderate / Low / Insufficient evidence`.
6. **Safe abstention** (`safety/abstention.py`) — below a configurable threshold, the
   pipeline sets `needs_clarification` or `needs_expert` and returns a hedged answer
   instead of a confident-sounding guess.
7. **Disclaimer** — always attached: _"This is informational guidance, not legal
   advice."_

---

## 6. requirements.txt / .env.example

See the accompanying files.

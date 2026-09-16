# IP-SAKTI: From-Scratch Setup Guide

Architecture recap (decided in our conversation):

- **Node/Express** stays as the main backend (auth, MongoDB, orchestration, Bhashini calls).
- **Python/FastAPI microservice** (`ip_sakti_rag_model/`) owns BM25 + Qdrant + Neo4j + embeddings.
- **Embeddings**: Google `text-embedding-004` via API (multilingual EN/HI/MR) — not a locally-loaded model, to stay inside Render free tier's 512MB RAM.
- **Reranking**: Reciprocal Rank Fusion (RRF) of BM25 + Qdrant results — no cross-encoder model, same RAM reasoning.
- **Deployment**: Render, free tier only, for everything.

---

## 1. Qdrant Cloud

You already have a cluster (`ip-sakti-kg`, eu-central-1). Get its URL and API key:

1. Qdrant Cloud console → your cluster → **Data Access Control** (or the cluster's "Connect" panel) → copy the **cluster URL** (looks like `https://xxxxx.eu-central-1-0.aws.cloud.qdrant.io:6333`) and generate an **API key**.
2. Create the collection (run once, from your machine):
   ```bash
   pip install qdrant-client
   QDRANT_URL="https://xxxxx...:6333" QDRANT_API_KEY="..." python scripts/qdrant_init.py
   ```
   This creates a `legal_corpus_chunks` collection sized for 768-dim vectors (matching `text-embedding-004`) with cosine distance.

**If you switch embedding models later**, the vector size (768) must match — a mismatch will raise a Qdrant error on upsert, not silently corrupt data, so it's safe.

---

## 2. Neo4j Aura

You already have an instance (`ip-sakti`, running). Get connection details:

1. Aura console → your instance → **Connect** → copy the **Connection URI** (`neo4j+s://xxxxx.databases.neo4j.io`) and the password you set when the instance was created (Aura only shows it once, at creation — if you've lost it, reset it from the console).
2. Open the **Query** tab in the Aura console (or connect via `cypher-shell`) and run the entire contents of `scripts/neo4j_schema.cypher`. This creates uniqueness constraints on `Statute`, `Section`, `Concept`, `Authority`, `ProductCategory`, `Form` nodes, and seeds a handful of nodes/relationships matching the sample data you shared (Section 3(p), 3(e), the Biological Diversity Act, etc.).
3. As you ingest more statutory provisions, extend this graph: one `Section` node per citable provision, linked to its `Statute`, `Authority`, any `Concept`s it defines, and `ProductCategory`/`Form` nodes it touches. This is manual/curated work — the graph encodes _legal relationships_ an LLM shouldn't be left to infer on its own (e.g. "Concept X bars Category Y").

---

## 3. MongoDB Atlas

You already have `IP-Sakti-Cluster` with the 11 collections from your export.

1. Get your connection string: Atlas console → cluster → **Connect** → **Drivers** → copy the `mongodb+srv://...` URI.
2. Run the migration/index script:
   ```bash
   mongosh "mongodb+srv://user:pass@cluster.mongodb.net/ip_sakti" scripts/mongo_setup.js
   ```
   This:
   - Creates a new **`legal_corpus_chunks`** collection — the single source of truth for full chunk text (used by BM25 + embeddings), instead of the truncated `excerpt` strings currently copy-pasted into `audit_logs`/`chat_messages`/`product_analyses`.
   - Creates a new **`legal_sources`** collection — one row per Act/Regulation, to actually track the "10+ years old, verify amendments" staleness your `audit_logs.warnings` already flag but nothing currently stores.
   - Adds indexes on every existing collection (`conversations`, `chat_messages`, `audit_logs`, `classification_records`, `validation_results`, `expert_escalations`, `product_analyses`, `saved_research`, `user_ingested_documents`, `feedback`) — none existed in your export, so every lookup was a full collection scan.
   - Enforces a **unique index on `users.email`**.
   - Migrates `users.role` (string) into `users.roles` (array) and drops `role`, so you stop maintaining two fields that can drift out of sync. **Update any app code reading `user.role` to read `user.roles` before running this.**

### `legal_corpus_chunks` schema (new)

```jsonc
{
  "_id": "chunk-CGPDTM-02", // stable across Mongo/Qdrant/Neo4j
  "document_id": "DOC-CGPDTM-TK-GUIDELINES",
  "title": "CGPDTM Guidelines — Patentability of Herbal Extraction ...",
  "authority": "CGPDTM, DPIIT",
  "section": "Chapter 5: Process Claims & Standardization",
  "source": "Guidelines for Examination of Patent Applications ...",
  "full_text": "<complete chunk text — used for BM25 + embeddings>",
  "display_excerpt": "<short quote for UI citations, kept under 15 words>",
  "page": 15,
  "language": "en",
  "effective_date": "2012-12-18",
  "last_verified_date": null,
  "embedding_model": "models/text-embedding-004",
  "embedding_dim": 768,
  "qdrant_point_id": "chunk-CGPDTM-02",
  "created_at": "...",
  "updated_at": "...",
}
```

`ingest.py` (below) writes this collection automatically — you don't hand-author these documents.

---

## 4. Python RAG microservice

Files are in `ip_sakti_rag_model/` (all provided): `main.py`, `retrieval.py`, `bm25_index.py`, `embeddings.py`, `graph.py`, `bhashini.py`, `ingest.py`, `requirements.txt`, `.env.example`.

```bash
cd ip_sakti_rag_model
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# fill in: LLM_API_KEY, QDRANT_URL, QDRANT_API_KEY, NEO4J_URI, NEO4J_PASSWORD,
#          MONGODB_URI, BHASHINI_API_KEY, BHASHINI_USER_ID, RAG_SERVICE_SHARED_SECRET
```

### 4a. Build the corpus manifest (this is the piece I don't have)

`ingest.py` expects `ip_sakti_rag_model/data/documents/manifest.json` — a JSON file with one entry per statutory chunk (see the docstring at the top of `ingest.py` for the exact shape). **I don't have your source legal texts** (the actual Acts, CGPDTM guidelines, TKDL framework docs, FSSAI notification, etc.) — only the short excerpts already embedded in your `audit_logs`/`product_analyses` samples, which are truncated with "..." and too short to embed or index meaningfully. See "What I still need from you" at the bottom.

### 4b. Run ingestion (once you have manifest.json)

```bash
python -m ingest
```

This embeds every chunk via Gemini, upserts vectors into Qdrant, writes full records into `legal_corpus_chunks`, and builds the local BM25 pickle. Re-run whenever the corpus changes.

### 4c. Run the service locally

```bash
uvicorn main:app --reload --port 8001
curl http://localhost:8001/health
curl -X POST http://localhost:8001/search \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: change-me-in-production" \
  -d '{"query": "Can Ashwagandha and Turmeric formulation be patented in India?"}'
```

---

## 5. Node backend integration

In your Express backend, add a client for the RAG microservice and call it from `/api/chat`, `/api/research/search`, etc., instead of (or alongside) the existing Gemini-direct logic:

```ts
// server/ragClient.ts
const RAG_URL = process.env.RAG_SERVICE_URL ?? "http://localhost:8001";
const SHARED_SECRET = process.env.RAG_SERVICE_SHARED_SECRET!;

export async function ragSearch(query: string, topK = 8) {
  const res = await fetch(`${RAG_URL}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": SHARED_SECRET,
    },
    body: JSON.stringify({ query, top_k: topK }),
  });
  if (!res.ok) throw new Error(`RAG service error: ${res.status}`);
  return res.json() as Promise<{
    results: { chunk_id: string; score: number }[];
  }>;
}
```

Then in your chat handler: call `ragSearch(query)` → fetch the matching `legal_corpus_chunks` docs from Mongo by `chunk_id` → feed their `full_text` to Gemini as context → translate the final answer via Bhashini if the user's UI language isn't English.

Add `RAG_SERVICE_URL` and `RAG_SERVICE_SHARED_SECRET` to the Node backend's own `.env` (must match the Python service's value).

---

## 6. Bhashini

Used **only** to translate the generated answer / UI strings into Hindi/Marathi — not for retrieval, since the corpus is embedded multilingually.

1. Register at the Bhashini portal and obtain `BHASHINI_USER_ID` + `BHASHINI_API_KEY` (the "Pre-requisites and Onboarding" page on the docs you linked walks through this).
2. `bhashini.py` implements the two-step ULCA call pattern (config call → resolves the NMT `serviceId` → inference call → actual translation). **I could only read the docs' table of contents, not the full request/response payload examples** (the page returned a nav-only snippet to my fetch), so treat `bhashini.py` as a best-effort skeleton — verify field names (`pipelineId`, response JSON paths) against the actual "Pipeline Config Call" / "Pipeline Compute Call" pages before relying on it, and paste me the response JSON if it doesn't match and I'll fix it.

---

## 7. Deploying to Render (free tier only)

Three separate Render services:

| Service             | Type               | Root dir              | Build                             | Start                                          |
| ------------------- | ------------------ | --------------------- | --------------------------------- | ---------------------------------------------- |
| `ip-sakti-frontend` | Static Site        | `frontend/`           | `npm install && npm run build`    | — (serves `dist/`)                             |
| `ip-sakti-backend`  | Web Service (free) | repo root             | `npm install && npm run build`    | `npm start`                                    |
| `ip-sakti-rag`      | Web Service (free) | `ip_sakti_rag_model/` | `pip install -r requirements.txt` | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

For each Web Service, set environment variables in the Render dashboard (**not** committed `.env` files) — mirror `.env.example` in each folder. Set `RAG_SERVICE_URL` on `ip-sakti-backend` to the internal or public URL Render assigns `ip-sakti-rag` (Render services on the same account can reach each other over their public `.onrender.com` URLs; private networking between services is a paid-tier feature, so the shared-secret header in `main.py` is your access control here since the RAG endpoint will be technically internet-reachable).

**Free-tier caveats to plan around:**

- Both web services **spin down after 15 minutes idle** and take ~30-60s to cold-start on the next request. Your first request after idle time will be slow on _both_ hops (Node waking up, then it calling a sleeping Python service which also has to wake up) — worst case, two sequential cold starts. Consider a lightweight external cron/uptime-pinger hitting `/api/health` and `/health` every 10 minutes if that's a problem for demo purposes (be aware this uses your free-tier hours).
- No persistent disk on free tier — this is fine here because Qdrant/Neo4j/Mongo are all _external managed services_, not containers running on Render. The only local state is `bm25_index.pkl`, which is rebuilt by `ingest.py`; if the Python service restarts (which it will, on every cold start after a deploy or idle spin-down) it needs that pickle file present in the deployed image (commit it, or run `ingest.py` as part of the Render build step) rather than expecting it to persist on disk between deploys.
- Watch Gemini API free-tier rate limits if traffic grows — embeddings now happen on every query, not just at ingest time.

---

## 8. Checklist before you consider this "done"

- [ ] `scripts/qdrant_init.py` run, collection visible in Qdrant Cloud console
- [ ] `scripts/neo4j_schema.cypher` run, constraints visible in Aura's schema view
- [ ] `scripts/mongo_setup.js` run, `legal_corpus_chunks`/`legal_sources` visible in Compass
- [ ] `manifest.json` built from real source documents, `python -m ingest` run successfully
- [ ] `/health` (Python) and `/api/health` (Node) both return 200 locally
- [ ] End-to-end: a chat query returns an answer citing a real `chunk_id` from `legal_corpus_chunks`
- [ ] Bhashini translation verified against real API responses (see section 6 caveat)
- [ ] All three Render services deployed, env vars set, cold-start behavior tested

---

## What I still need from you

1. **The actual source documents** — full text (PDF/HTML/plain text) of the Acts, CGPDTM guidelines, TKDL framework doc, FSSAI notification, Trade Marks Act sections, etc. that should populate `manifest.json`. The excerpts in your Mongo export are truncated previews, not usable as the real corpus.
2. **A sample Bhashini API response** (from the config + compute calls) once you have credentials, so I can correct `bhashini.py`'s field names against reality instead of the best-effort version above.
3. Confirmation of your Gemini API key's tier/quota, if you expect meaningful query volume — free tier rate limits matter now that embeddings happen per-query, not just at ingest.
# IP-SAKTI Sahayak

A full-stack legal intelligence platform for AYUSH researchers, IPR attorneys,
regulatory compliance teams, and bio-innovators in India — synthesizing
statutory frameworks (Patents Act, Biological Diversity Act, Drugs and
Cosmetics Act, FSSAI Ayurveda Aahar Regulations, TKDL, Trade Marks Act,
Designs Act, PPV&FR Act) via retrieval-augmented generation, with support
for English, Hindi and Marathi.

> See `SETUP_GUIDE.md` for full from-scratch setup instructions
> (Qdrant, Neo4j, MongoDB, the RAG microservice, and Render deployment).

## Architecture

```
┌────────────┐      ┌───────────────────┐      ┌──────────────────────────┐
│  frontend/ │◄────►│  server/ (Node,    │◄────►│  ip_sakti_rag_model/     │
│  React +   │ HTTP │  Express, auth,    │ HTTP │  (Python, FastAPI)       │
│  Vite      │      │  Mongo access,     │      │  - BM25 (rank_bm25)      │
└────────────┘      │  Bhashini calls)   │      │  - Qdrant (dense vector) │
                     └─────────┬─────────┘      │  - RRF fusion            │
                               │                 │  - Neo4j graph expand    │
                               ▼                 └────────────┬─────────────┘
                        ┌─────────────┐                        │
                        │ MongoDB     │        ┌───────────────┼───────────────┐
                        │ Atlas       │        ▼               ▼               ▼
                        └─────────────┘   Qdrant Cloud    Neo4j Aura     Gemini API
                                          (vectors)      (knowledge     (embeddings +
                                                          graph)         generation)
```

- **Frontend** (`frontend/`): React 19, TypeScript, Vite, Tailwind CSS v4.
- **Backend** (`server/`): Express.js/TypeScript — auth, MongoDB access,
  request orchestration, calls the RAG microservice internally, calls
  Bhashini for translating generated answers into Hindi/Marathi.
- **RAG microservice** (`ip_sakti_rag_model/`): Python/FastAPI — hybrid
  BM25 + Qdrant retrieval fused with Reciprocal Rank Fusion, Neo4j-backed
  knowledge-graph expansion, Gemini `text-embedding-004` for multilingual
  embeddings (English/Hindi/Marathi — no translation round-trip needed).
- **Data stores**: MongoDB Atlas (app data + canonical corpus text),
  Qdrant Cloud (vectors), Neo4j Aura (statutory knowledge graph).

## Why a separate Python microservice instead of one backend

The Node backend stays as the public-facing API (auth, Mongo, orchestration).
Everything vector/graph/lexical-search-related (Qdrant client, Neo4j driver,
BM25 index, RRF fusion) lives in a small internal Python/FastAPI service,
because those libraries and that ecosystem are Python-native. The Node
backend calls it over HTTP with a shared-secret header — see
`ip_sakti_rag_model/main.py`.

## Prerequisites

- Node.js v18+
- Python 3.11+
- Accounts: Qdrant Cloud, Neo4j Aura, MongoDB Atlas, Google AI Studio
  (Gemini API key), Bhashini (ULCA) API credentials — all free tiers.

## Local development

```bash
# Frontend + Node backend
npm install
npm run dev            # http://localhost:3000

# Python RAG microservice (separate terminal)
cd ip_sakti_rag_model
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # fill in QDRANT_URL, NEO4J_URI, MONGODB_URI, LLM_API_KEY, ...
uvicorn main:app --reload --port 8001
```

Full step-by-step (Qdrant collection creation, Neo4j schema, Mongo indexes,
corpus ingestion, Render deployment) is in **`SETUP_GUIDE.md`**.

## API Endpoints (Node backend)

- `GET /api/health`
- `POST /api/chat`, `POST /api/chat/stream`
- `POST /api/products/analyze`, `GET /api/products`
- `POST /api/ipr/analyze`
- `POST /api/abs/analyze`, `POST /api/tk-abs/analyze`
- `GET /api/research/search`
- `POST /api/translate`
- `GET /api/rag/documents`, `GET /api/rag/telemetry`
- `GET/POST /api/workspace/saved-research`

## RAG microservice endpoints (internal — not public)

- `GET /health`
- `POST /search` — hybrid BM25 + Qdrant + graph-expanded retrieval

## Legal Disclaimer

IP-SAKTI Sahayak is an informational decision-support platform for academic,
research, and preparatory regulatory analysis. It does not constitute
formal legal counsel. Formal statutory submissions, patent prosecutions,
and license applications should be vetted by registered patent agents,
advocates, or qualified regulatory affairs specialists.

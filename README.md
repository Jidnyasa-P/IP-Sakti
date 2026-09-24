# IP-SAKTI Sahayak

**Live Application:** https://ip-sakti-frontend.onrender.com/

Multilingual, RAG-based, source-cited AI assistant for Intellectual Property and regulatory guidance in Ayurveda (SIH26045).

## 1. Overview

IP-SAKTI Sahayak combines conversational AI, retrieval-augmented generation (RAG), authoritative source citation, IP/regulatory analysis, Traditional Knowledge and Access & Benefit Sharing (TK & ABS), research, workspace persistence, and expert/grievance workflows.

### Core capabilities

- Sahayak AI chat with source citations and confidence scoring
- Multilingual UI and translation
- Hybrid RAG retrieval
- Research and source discovery
- Product Analyzer
- IPR analysis
- TK & ABS analysis
- Workspace for saved sessions and user activity
- Notifications
- Grievance / Raise Your Query workflow
- Expert escalation
- Safe abstention and citation validation

## 2. Architecture

The deployed system uses three sibling services:

```text
ip_sakti_rag/   Python 3.12 + FastAPI
                RAG retrieval, generation, knowledge graph,
                confidence and citation validation

backend/        Python 3.12 + FastAPI
                Authentication, MongoDB persistence, API proxy,
                translation, expert/grievance workflows

frontend/       React 19 + Vite
                User interface
```

### Request flow

```text
Frontend → Backend → ip_sakti_rag → Backend → Frontend
                    |
                    ├─ BM25
                    ├─ Qdrant vector retrieval
                    ├─ Neo4j graph context
                    ├─ Gemini generation
                    ├─ Citation validation
                    └─ Confidence scoring
```

The frontend communicates with the backend. The backend communicates with `ip_sakti_rag` for RAG-backed operations.

> The root-level `server.ts`, `src/`, `package.json`, `render.yaml`, and `docker-compose.yml` belong to a different architecture and are not required for this three-service deployment.

## 3. Service Responsibilities

### ip_sakti_rag

Responsible for document retrieval, hybrid BM25/Qdrant retrieval, Neo4j context, Gemini generation, confidence scoring, safe abstention, citation validation, telemetry, TK/ABS analysis, product analysis and IPR analysis.

### backend

Responsible for authentication, authorization, MongoDB persistence, conversations, workspace data, product analyses, saved research, notifications, grievances, audit information, expert escalation, translation, and HTTP communication with the RAG service.

### frontend

Provides Sahayak AI, Research, Product Analyzer, IPR, TK & ABS, Expert Advisory, Workspace, notifications, grievances, authentication and citation UI.

## 4. Application Sections

### Sahayak AI

Main conversational interface for IP, Ayurveda, regulatory and related questions. Answers are generated through the backend/RAG pipeline and can include citations and confidence information.

### Research

Research-oriented source discovery and document-backed information.

### Product Analyzer

Product classification and regulatory/IP/TK-ABS analysis.

### TK & ABS

Traditional Knowledge and Access & Benefit Sharing analysis. Restricted TKDL access is handled explicitly; the application does not claim that an unavailable TKDL source was queried.

### Workspace

Persistent user activity including chat sessions, research sessions, product analyses, bookmarks, notifications and grievances.

### Grievances

Users can submit a query from Workspace. Low-confidence chat responses can also open the grievance workflow with the relevant conversation context.

## 5. Citation Architecture

Authoritative government and regulatory citation URLs are sourced from `manifest.json` document metadata.

```text
Document ID
    ↓
Document metadata
    ↓
manifest.json
    ↓
Authoritative source URL
    ↓
Citation UI
```

The manifest is the source of truth for authoritative citation URLs. Individual application sections should not maintain separate hardcoded government citation URLs.

## 6. API Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Backend/RAG health |
| `POST /api/chat` | Main chat |
| `POST /api/products/analyze` | Product analysis |
| `POST /api/ipr/analyze` | IPR analysis |
| `POST /api/abs/analyze` | ABS analysis |
| `POST /api/tk-abs/analyze` | TK & ABS analysis |
| `GET /api/search` | Document search |
| `GET /api/sources` | Source listing |
| `GET /api/documents/{id}` | Document/citation metadata |
| `GET /api/rag/telemetry` | RAG telemetry |
| `POST /api/expert-escalation` | Expert escalation |
| `POST /api/translate` | Translation |

FastAPI interactive documentation is available at `/docs` on the backend service.

## 7. Local Setup

### RAG engine

```bash
cd ip_sakti_rag
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Configure the backend environment, including:

```text
RAG_SERVICE_URL=http://localhost:8001
```

Then:

```bash
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## 8. Deployment

Deploy the three services independently:

1. `ip_sakti_rag`
2. `backend`
3. `frontend`

The RAG service should be available before the backend performs RAG-backed operations. The backend must be configured with the RAG service URL and MongoDB credentials. The frontend must be configured to use the deployed backend.

**Live application:** https://ip-sakti-frontend.onrender.com/

## 9. External Services

Depending on deployment configuration:

- Gemini API
- Qdrant
- Neo4j
- MongoDB
- Bhashini / translation services

Store credentials in environment variables or deployment secrets. Never commit secrets.

## 10. Data Persistence

MongoDB stores application-level persistent data such as users, conversations, messages, product analyses, saved research, notifications, grievances, audit information and expert escalation information.

The backend is the application persistence authority.

## 11. RAG Pipeline

```text
User query
   ↓
Classification / jurisdiction
   ↓
Hybrid retrieval
   ├─ BM25
   ├─ Qdrant
   └─ Neo4j context
   ↓
Context assembly
   ↓
Gemini generation
   ↓
Citation validation
   ↓
Confidence assessment
   ├─ Sufficient confidence → grounded answer
   └─ Low confidence → safe response / escalation
```

## 12. Project Structure

```text
ip_sakti_rag/
├── main.py
├── app/
│   ├── pipeline.py
│   ├── retrieval/
│   ├── generation/
│   ├── safety/
│   ├── classification.py
│   └── jurisdiction.py
├── data/
│   ├── documents/
│   └── processed/
├── scripts/
│   └── ingest.py
└── requirements.txt

backend/
├── app/
│   ├── main.py
│   ├── rag_client.py
│   ├── core/
│   ├── api/routes/
│   ├── services/
│   ├── translation/
│   └── database/
└── requirements.txt

frontend/
├── src/
│   ├── components/
│   └── context/
├── vite.config.ts
└── vercel.json
```

## 13. Troubleshooting

### Backend cannot reach RAG

Verify `RAG_SERVICE_URL` and confirm the RAG service is reachable.

### Frontend cannot reach backend

Check backend status, frontend API configuration, CORS and browser network requests.

### RAG answers are unavailable

Check Gemini credentials, Qdrant, Neo4j, processed documents/indexes and RAG logs.

### Citation is unavailable

Check the document ID, document metadata endpoint and corresponding `manifest.json` entry.

## 14. Documentation Files

- `setup_steps.md` — local environment and setup
- `integration_steps.md` — backend/RAG integration and deployment
- `IP-SAKTI-Sahayak-Technical-Documentation.docx` — detailed technical documentation supplied separately

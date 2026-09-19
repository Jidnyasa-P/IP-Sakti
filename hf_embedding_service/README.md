---
title: IP-SAKTI Embedding Service
emoji: 🔎
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
---

# IP-SAKTI Embedding Service

Private-by-token FastAPI service for the IP-SAKTI RAG engine.

It runs the exact embedding model used for the existing Qdrant collection:

`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`

Output: **384 dimensions**.

## Endpoints

- `GET /` — health/config information; does not warm the model.
- `GET /health` — same health response.
- `POST /embed` — accepts up to 32 texts and returns 384-D embeddings.

Set `EMBEDDING_SERVICE_TOKEN` as a Hugging Face Space Secret. The Render RAG
service must send the same value as `Authorization: Bearer <token>`.

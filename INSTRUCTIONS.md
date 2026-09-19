# IP-SAKTI — Move FastEmbed Inference Off Render Without Re-ingestion

## What this change does

Your existing Qdrant collection is already populated and must be preserved:

- Collection: `ip_sakti_chunks`
- Existing points: approximately 7,747
- Vector size: **384**
- Distance: **Cosine**
- Existing embedding model: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
- Existing embedding implementation: FastEmbed

The problem was not the Qdrant collection. The problem was loading the FastEmbed
ONNX model inside the Render `ip-sakti-rag` process.

This patch changes only the location of embedding inference:

    BEFORE
    Render ip-sakti-rag
        └── FastEmbed model in Render RAM
        └── Qdrant

    AFTER
    Render ip-sakti-rag
        └── HTTP request to embedding service
                    └── FastEmbed model
        └── Qdrant (same existing collection)

The RAG pipeline, BM25 retrieval, Qdrant retrieval, Neo4j enrichment, citation
validation, confidence scoring, safe abstention, Gemini answer generation,
MongoDB logging, API routes and frontend are otherwise unchanged.

## IMPORTANT: no re-ingestion

Do **NOT** delete `ip_sakti_chunks`.

Do **NOT** run the full ingestion command just because of this deployment change.

The new embedding service uses the same model name and 384-D output expected by
your current collection. Live user queries are embedded remotely and searched
against the existing vectors.

If you ever rebuild the corpus in the future, the ingestion code calls the same
`app.embeddings.embed_texts()` function, so it will use the remote service too.

## Files in this patch

### Render RAG service

- `ip_sakti_rag/app/embeddings.py`
  - Replaces local FastEmbed model loading with an HTTP client.
  - Keeps `EMBED_DIM = 384`.
  - Keeps the exact model identifier for documentation/compatibility.
  - Checks returned vector count and dimension.
  - Retries one transient failure.
  - Falls back to BM25 at the existing `hybrid.py` level if semantic embedding fails.

- `ip_sakti_rag/app/config.py`
  - Adds `EMBEDDING_SERVICE_URL`.
  - Adds optional `EMBEDDING_SERVICE_TOKEN`.
  - Adds `EMBEDDING_SERVICE_TIMEOUT`.
  - Does not change existing RAG settings.

- `ip_sakti_rag/app/retrieval/hybrid.py`
  - Comment/error wording only; retrieval logic is unchanged.

- `ip_sakti_rag/requirements-server.txt`
  - Removes FastEmbed/ONNX packages from the Render runtime.
  - Keeps Gemini for answer generation/reranking.
  - Keeps Qdrant, BM25, Neo4j, MongoDB and requests.

- `ip_sakti_rag/.env.example`
  - Documents the new embedding-service variables.

### Hugging Face embedding service

- `hf_embedding_service/app.py`
- `hf_embedding_service/requirements.txt`
- `hf_embedding_service/Dockerfile`
- `hf_embedding_service/README.md`

This service does ONLY embedding inference. It does not contain your legal
corpus, Qdrant credentials, Neo4j credentials, Gemini credentials, or frontend.

## Hugging Face deployment

### 1. Create the Space

Create a new Hugging Face Space and choose **Docker**.

The Space files in `hf_embedding_service/` are intended to be uploaded to the
ROOT of that Space, not inside an `hf_embedding_service` subdirectory.

The root of the HF Space should become:

    README.md
    Dockerfile
    requirements.txt
    app.py

### 2. Add the Secret

In the Space settings, add:

    EMBEDDING_SERVICE_TOKEN=<a long random value>

If you leave the token unset, the endpoint is unauthenticated. For a public
internet-facing service, use a token.

### 3. Wait for the Space to build

The service listens on port `7860`.

After it is running, open:

    https://YOUR-SPACE-NAME.hf.space/

You should see JSON similar to:

    {
      "status": "ok",
      "service": "ip-sakti-embedding-service",
      "model": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
      "dimension": 384
    }

### 4. Test the embedding endpoint

Example request:

    curl -X POST "https://YOUR-SPACE-NAME.hf.space/embed" \
      -H "Authorization: Bearer YOUR_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"texts":["Can an Ayurvedic formulation be patented in India?"]}'

The response must contain:

    "dimension": 384

and one 384-number vector for the supplied text.

## Render deployment

Keep your existing Render service:

    service: ip-sakti-rag
    Root Directory: ip_sakti_rag
    Runtime: Python 3
    Build Command: pip install -r requirements-server.txt
    Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT

Do NOT use the old `requirements.txt` as the Render build command.

Add these Render environment variables:

    EMBEDDING_SERVICE_URL=https://YOUR-SPACE-NAME.hf.space
    EMBEDDING_SERVICE_TOKEN=<same token as HF>
    EMBEDDING_SERVICE_TIMEOUT=120

Keep your existing variables unchanged:

    LLM_API_KEY=...
    LLM_MODEL=...
    QDRANT_URL=...
    QDRANT_API_KEY=...
    QDRANT_COLLECTION=ip_sakti_chunks
    NEO4J_ENABLED=...
    NEO4J_URI=...
    NEO4J_USERNAME=...
    NEO4J_PASSWORD=...
    MONGODB_URI=...
    RAG_SERVICE_SHARED_SECRET=...

Gemini is still used for answer generation and, if enabled, Gemini reranking.
It is NOT used for embeddings.

## Deployment order

Use this exact order:

1. Deploy the HF embedding service.
2. Verify `GET /` works.
3. Verify authenticated `POST /embed` returns 384-D vectors.
4. Add `EMBEDDING_SERVICE_URL` and `EMBEDDING_SERVICE_TOKEN` to Render.
5. Redeploy/restart `ip-sakti-rag`.
6. Check Render `/api/health`.
7. Test one English query.
8. Test one Hindi query.
9. Test one Marathi query.
10. Test a citation/source modal.
11. Test Product Analyzer / IPR Analyzer / TK-ABS routes.

## What NOT to do

### Do not delete Qdrant

The existing vectors are the reason no re-ingestion is required.

### Do not change the embedding model

Do not replace it with E5, BGE, MiniLM English, Gemini embeddings, etc. without
rebuilding the collection. A different embedding model/vector space is not
compatible with the existing Qdrant vectors.

### Do not add FastEmbed back to Render

The whole point of this change is to keep model inference outside the Render
RAG process.

### Do not put Qdrant/Gemini/Neo4j credentials in the HF Space

The embedding Space needs only its own optional bearer token.

## Why the existing Qdrant collection remains valid

Your Qdrant collection is 384-dimensional. The embedding service returns exactly
384 dimensions using the same FastEmbed model identifier. Qdrant therefore
continues to receive query vectors in the same dimensional vector space.

The service also rejects an unexpected vector dimension before the vector reaches
the RAG search layer. This prevents a silent 384-vs-other-dimension failure.

## Failure behaviour

If the HF embedding service is temporarily unavailable:

1. `embed_query()` raises a controlled error.
2. `HybridRetriever._semantic_search()` catches the error.
3. Existing BM25 retrieval still runs.
4. The request can still produce a lexical-only answer rather than a 502 solely
   because semantic embedding failed.

This preserves the existing graceful-degradation design.

## Cold starts / sleeping

A free compute environment may suspend after inactivity. The first embedding
request after a sleep can therefore be slower because the model has to load.
This is an infrastructure latency issue, not a Qdrant re-ingestion requirement.

For an SIH demo, warm the service with `GET /` and then make one `/embed` call
before the live demonstration.

## Verification checklist after deployment

### HF

- [ ] Space builds successfully.
- [ ] `/` returns status `ok`.
- [ ] `/embed` returns HTTP 200 with the correct token.
- [ ] Response dimension is 384.
- [ ] Hindi query embeds successfully.
- [ ] Marathi query embeds successfully.

### Render

- [ ] Build succeeds without `fastembed` / `onnxruntime` in the server runtime.
- [ ] `ip-sakti-rag` starts without loading a local embedding model.
- [ ] `/api/health` returns 200.
- [ ] English chat works.
- [ ] Hindi chat works.
- [ ] Marathi chat works.
- [ ] Qdrant semantic retrieval returns results.
- [ ] BM25 retrieval still works.
- [ ] Neo4j enrichment still works if enabled.
- [ ] Citations still appear.
- [ ] Citation modal still works.
- [ ] Product Analyzer still works.
- [ ] IPR Navigator still works.
- [ ] TK/ABS analysis still works.

### Qdrant

- [ ] Collection remains `ip_sakti_chunks`.
- [ ] Point count remains approximately 7,747.
- [ ] Vector size remains 384.
- [ ] Distance remains Cosine.
- [ ] No collection deletion/recreation occurred.

## Important current Hugging Face pricing note

As of September 2026, Hugging Face's official Spaces documentation says CPU
Basic has 2 vCPU / 16 GB RAM at no hourly hardware cost, but creating a Space
that runs compute (including Docker) requires an eligible paid plan. Therefore,
this Docker deployment is technically suitable for moving the model off Render,
but it should NOT be described as guaranteed "free on a free Hugging Face
account".

If your HF account cannot create/run Docker Spaces without a paid plan, stop
before changing the IP-SAKTI code further. The code in this patch is still the
correct separation architecture, but you would need a genuinely free compute
provider for the embedding service instead.

"""IP-SAKTI multilingual embedding microservice.

This service intentionally runs the SAME FastEmbed model that was used to
create the existing 384-dimensional Qdrant collection. Render calls /embed
instead of loading the model locally.
"""
from __future__ import annotations

import os
from functools import lru_cache

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from fastembed import TextEmbedding

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
EMBED_DIM = 384
TOKEN = os.getenv("EMBEDDING_SERVICE_TOKEN", "").strip()
BATCH_SIZE = 32

app = FastAPI(title="IP-SAKTI Embedding Service", version="1.0.0")


class EmbedRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=BATCH_SIZE)


@lru_cache(maxsize=1)
def get_model() -> TextEmbedding:
    print(f"[hf-embed] Loading {MODEL_NAME} ...")
    model = TextEmbedding(
        model_name=MODEL_NAME,
        threads=1,
    )
    print("[hf-embed] Model loaded.")
    return model


def check_token(authorization: str | None) -> None:
    if not TOKEN:
        return
    expected = f"Bearer {TOKEN}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/")
def health() -> dict:
    # Do not load the model for health checks; this keeps the Space responsive
    # and makes it obvious that a healthy process does not imply a warm model.
    return {
        "status": "ok",
        "service": "ip-sakti-embedding-service",
        "model": MODEL_NAME,
        "dimension": EMBED_DIM,
    }


@app.get("/health")
def health_alias() -> dict:
    return health()


@app.post("/embed")
def embed(
    payload: EmbedRequest,
    authorization: str | None = Header(default=None),
) -> dict:
    check_token(authorization)

    texts = [text.strip() for text in payload.texts]
    if any(not text for text in texts):
        raise HTTPException(status_code=400, detail="texts must not contain empty strings")

    model = get_model()
    vectors = [vector.tolist() for vector in model.embed(texts)]

    if len(vectors) != len(texts) or any(len(vector) != EMBED_DIM for vector in vectors):
        raise HTTPException(status_code=500, detail="Embedding dimension/count mismatch")

    return {
        "model": MODEL_NAME,
        "dimension": EMBED_DIM,
        "embeddings": vectors,
    }

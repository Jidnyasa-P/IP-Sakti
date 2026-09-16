"""
IP-SAKTI RAG microservice — called internally by the Node/Express backend.
Not exposed directly to the browser; put it behind RAG_SERVICE_SHARED_SECRET.
"""
import os

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from . import graph
from .retrieval import hybrid_search

app = FastAPI(title="IP-Sakti RAG microservice")

SHARED_SECRET = os.environ.get("RAG_SERVICE_SHARED_SECRET", "change-me-in-production")


def _check_secret(x_internal_secret: str | None) -> None:
    if x_internal_secret != SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")


class SearchRequest(BaseModel):
    query: str
    top_k: int = 8
    expand_graph: bool = True


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/search")
def search(req: SearchRequest, x_internal_secret: str | None = Header(default=None)):
    _check_secret(x_internal_secret)

    fused = hybrid_search(req.query, top_k=req.top_k)
    results = [{"chunk_id": cid, "score": score} for cid, score in fused]

    if req.expand_graph and results:
        try:
            results[0]["related_sections"] = graph.related_sections(results[0]["chunk_id"])
        except Exception:
            # Graph enrichment is best-effort — never fail the whole request
            # just because Neo4j is briefly unreachable.
            results[0]["related_sections"] = []

    return {"results": results}

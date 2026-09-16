"""
IP-SAKTI RAG microservice — called internally by the Node/Express backend
(server.ts in Jidnyasa-P/IP-Sakti). Not exposed directly to the browser;
put it behind RAG_SERVICE_SHARED_SECRET, and have the Express backend
proxy /api/research/search (and friends) to this service's /search.

Run locally / on Render with:
    uvicorn main:app --host 0.0.0.0 --port $PORT
(plain module-level imports below, not package-relative ones, so this
works whether you run it from inside ip_sakti_rag/ directly or as a
Render "Start Command" — matches how ingest.py is invoked too.)
"""
import os

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from pymongo import MongoClient

import graph
from retrieval import hybrid_search

app = FastAPI(title="IP-Sakti RAG microservice")

SHARED_SECRET = os.environ.get("RAG_SERVICE_SHARED_SECRET", "change-me-in-production")

_mongo = MongoClient(os.environ["MONGODB_URI"])[
    os.environ.get("MONGODB_DB_NAME", "ip_sakti")
]


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
    chunk_ids = [cid for cid, _score in fused]
    docs_by_id = {
        d["_id"]: d
        for d in _mongo.legal_corpus_chunks.find({"_id": {"$in": chunk_ids}})
    }

    results = []
    for cid, score in fused:
        doc = docs_by_id.get(cid, {})
        results.append(
            {
                "chunk_id": cid,
                "score": score,
                "document_id": doc.get("document_id"),
                "title": doc.get("title"),
                "authority": doc.get("authority"),
                "source": doc.get("source"),
                "section": doc.get("section"),
                "page": doc.get("page"),
                "excerpt": doc.get("display_excerpt"),
                "language": doc.get("language"),
            }
        )

    if req.expand_graph and results and results[0].get("document_id"):
        try:
            results[0]["related_sections"] = graph.related_sections(results[0]["document_id"])
        except Exception:
            # Graph enrichment is best-effort — never fail the whole request
            # just because Neo4j is briefly unreachable or auto-paused.
            results[0]["related_sections"] = []

    return {"results": results}

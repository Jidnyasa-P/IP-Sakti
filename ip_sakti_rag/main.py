"""
IP-SAKTI RAG microservice — FastAPI entrypoint.

Promoted from example_fastapi_integration.py (which said "copy whatever's
useful" — this is that): same routes, matching what server/routes.ts
already calls, plus:
  - a shared-secret check on every route except /api/health, so this
    service can be safely public on Render's free tier (no private
    networking there) while only your Node backend can actually use it.
  - CORS still permissive (frontend never calls this directly — only the
    Node backend does — but kept open in case you want to hit it directly
    while testing).

Run: uvicorn main:app --host 0.0.0.0 --port $PORT
"""
from __future__ import annotations

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import settings
from app.pipeline import IPSaktiRAG

app = FastAPI(title="IP-SAKTI RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

rag = IPSaktiRAG()  # loaded once at startup


def _check_secret(x_internal_secret: str | None) -> None:
    # If no secret is configured (e.g. local dev), skip the check entirely.
    if not settings.rag_service_shared_secret:
        return
    if x_internal_secret != settings.rag_service_shared_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")


class ChatRequest(BaseModel):
    query: str | None = None
    message: str | None = None
    conversation_id: str | None = None
    language: str | None = None


class FeedbackRequest(BaseModel):
    message_id: str
    feedback: str  # "helpful" | "unhelpful"
    notes: str | None = None


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/chat")
def chat(payload: ChatRequest, x_internal_secret: str | None = Header(default=None)):
    _check_secret(x_internal_secret)
    query = (payload.query or payload.message or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query is required.")
    return rag.answer_query(query=query, language=payload.language, conversation_id=payload.conversation_id)


@app.post("/api/products/analyze")
def analyze_product(product_info: dict, x_internal_secret: str | None = Header(default=None)):
    _check_secret(x_internal_secret)
    if not product_info.get("product_name") or not product_info.get("ingredients"):
        raise HTTPException(status_code=400, detail="Product name and ingredients are required.")
    return rag.analyze_product(product_info)


@app.post("/api/ipr/analyze")
def analyze_ipr(ipr_query: dict, x_internal_secret: str | None = Header(default=None)):
    _check_secret(x_internal_secret)
    return rag.analyze_ipr(ipr_query)


@app.post("/api/abs/analyze")
@app.post("/api/tk-abs/analyze")
def analyze_tk_abs(tk_query: dict, x_internal_secret: str | None = Header(default=None)):
    _check_secret(x_internal_secret)
    return rag.analyze_tk_abs(tk_query)


@app.get("/api/research/search")
def research_search(
    q: str = "",
    topic: str | None = None,
    authority: str | None = None,
    x_internal_secret: str | None = Header(default=None),
):
    _check_secret(x_internal_secret)
    return rag.search_documents(query=q, topic=topic, authority=authority)


@app.get("/api/rag/documents")
def rag_documents(x_internal_secret: str | None = Header(default=None)):
    _check_secret(x_internal_secret)
    return rag.list_documents()


@app.get("/api/documents/{document_id}")
def document_detail(document_id: str, x_internal_secret: str | None = Header(default=None)):
    _check_secret(x_internal_secret)
    doc = rag.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return doc


@app.get("/api/rag/telemetry")
def telemetry(x_internal_secret: str | None = Header(default=None)):
    _check_secret(x_internal_secret)
    return rag.get_telemetry()


@app.post("/api/conversations/{conversation_id}/feedback")
def feedback(
    conversation_id: str, payload: FeedbackRequest, x_internal_secret: str | None = Header(default=None)
):
    _check_secret(x_internal_secret)
    rag.record_feedback(helpful=payload.feedback == "helpful")
    return {"success": True}

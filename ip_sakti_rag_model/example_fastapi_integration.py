"""
EXAMPLE ONLY — shows how your own FastAPI backend can wire up this RAG module
to match the routes your existing frontend/server.ts prototype already calls.
You said you'll build the main FastAPI backend yourself — copy whatever's
useful from here, this file is not meant to be your production server.

Run directly for a quick smoke test:
    uvicorn example_fastapi_integration:app --reload --port 8000
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.pipeline import IPSaktiRAG

app = FastAPI(title="IP-SAKTI RAG API")

# Adjust to your actual frontend origin(s) in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

rag = IPSaktiRAG()  # loaded once at startup


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
def chat(payload: ChatRequest):
    query = (payload.query or payload.message or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query is required.")
    return rag.answer_query(query=query, language=payload.language, conversation_id=payload.conversation_id)


@app.post("/api/products/analyze")
def analyze_product(product_info: dict):
    if not product_info.get("product_name") or not product_info.get("ingredients"):
        raise HTTPException(status_code=400, detail="Product name and ingredients are required.")
    return rag.analyze_product(product_info)


@app.post("/api/ipr/analyze")
def analyze_ipr(ipr_query: dict):
    return rag.analyze_ipr(ipr_query)


@app.post("/api/abs/analyze")
@app.post("/api/tk-abs/analyze")
def analyze_tk_abs(tk_query: dict):
    return rag.analyze_tk_abs(tk_query)


@app.get("/api/research/search")
def research_search(q: str = "", topic: str | None = None, authority: str | None = None):
    return rag.search_documents(query=q, topic=topic, authority=authority)


@app.get("/api/rag/documents")
def rag_documents():
    return rag.list_documents()


@app.get("/api/documents/{document_id}")
def document_detail(document_id: str):
    doc = rag.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return doc


@app.get("/api/rag/telemetry")
def telemetry():
    return rag.get_telemetry()


@app.post("/api/conversations/{conversation_id}/feedback")
def feedback(conversation_id: str, payload: FeedbackRequest):
    rag.record_feedback(helpful=payload.feedback == "helpful")
    return {"success": True}

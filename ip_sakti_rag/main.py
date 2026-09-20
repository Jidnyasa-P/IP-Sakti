"""
IP-SAKTI RAG service — FastAPI entrypoint.

Promoted from example_fastapi_integration.py (which said "copy whatever's
useful" — this is that): same routes, matching what server/routes.ts
already calls, plus:
  - a shared-secret check on every route except /api/health.
  - MongoDB persistence for chat/feedback when MONGODB_URI is configured.
  - Neo4j GraphRAG context is used by the FastAPI RAG pipeline when configured.

Run: uvicorn main:app --host 0.0.0.0 --port $PORT
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import settings
from app.database.mongo import save_feedback
from app.pipeline import IPSaktiRAG

# Use a lifespan context manager to initialize the RAG pipeline explicitly at startup
rag: IPSaktiRAG = None # type: ignore

@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag
    rag = IPSaktiRAG()  # loaded once at startup
    yield

app = FastAPI(title="IP-SAKTI RAG API", lifespan=lifespan)

# Optimized CORS configuration for communication with Vercel
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins including production and dynamic Vercel previews
    allow_credentials=True,
    allow_methods=["*"],  # Allows GET, POST, OPTIONS, etc.
    allow_headers=["*"],  # Essential to accept your 'X-Internal-Secret' header from Vercel
)

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
    # "india" | "international" -- the toggle's value, enforced server-side
    # by app/safety/scope_guard.py (see app/pipeline.py's answer_query).
    jurisdiction: str | None = None


class FeedbackRequest(BaseModel):
    message_id: str
    feedback: str  # "helpful" | "unhelpful"
    notes: str | None = None


@app.get("/")
def root():
    return {"name": "IP-SAKTI RAG API", "docs": "/docs", "health": "/api/health"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/chat")
def chat(payload: ChatRequest, x_internal_secret: str | None = Header(default=None)):
    _check_secret(x_internal_secret)
    query = (payload.query or payload.message or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query is required.")
    return rag.answer_query(query=query, language=payload.language, conversation_id=payload.conversation_id, jurisdiction=payload.jurisdiction)


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
    document_type: str | None = None,
    x_internal_secret: str | None = Header(default=None),
):
    _check_secret(x_internal_secret)
    return rag.search_documents(query=q, topic=topic, authority=authority, document_type=document_type)


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


@app.get("/api/documents/{document_id}/source")
def document_source(document_id: str, x_internal_secret: str | None = Header(default=None)):
    """
    NEW: serves the actual ingested source file (usually a PDF) for a
    citation's "view original document" link -- distinct from the
    "official cited section" link in sectionLinks.tsx, which points at an
    external government site. This one proves the citation traces back to
    a specific file YOU ingested, not a third-party page that may change.

    Looks up the filename via manifest.json's {filename: {id: ...}} shape
    (DocumentMetadata itself doesn't store the original filename) and
    streams it straight from disk -- no extra storage, no extra cost, it's
    already sitting in data/documents/.
    """
    _check_secret(x_internal_secret)
    manifest_path = settings.documents_dir / "manifest.json"
    if not manifest_path.exists():
        raise HTTPException(status_code=404, detail="No document manifest found.")

    import json
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    filename = next((fn for fn, meta in manifest.items() if meta.get("id") == document_id), None)
    if not filename:
        raise HTTPException(status_code=404, detail="Document not found in manifest.")

    file_path = settings.documents_dir / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Source file is listed in the manifest but missing on disk.")

    from fastapi.responses import FileResponse
    return FileResponse(path=str(file_path), media_type="application/pdf", filename=filename)


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
    save_feedback(conversation_id, payload.message_id, payload.feedback, payload.notes)
    return {"success": True}

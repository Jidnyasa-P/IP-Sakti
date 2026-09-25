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
from app.database.mongo import save_feedback, delete_conversation
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


class AttachmentRequest(BaseModel):
    filename: str
    content_type: str
    data_base64: str


class ChatRequest(BaseModel):
    query: str | None = None
    message: str | None = None
    conversation_id: str | None = None
    language: str | None = None
    # "india" | "international" -- the toggle's value, enforced server-side
    # by app/safety/scope_guard.py (see app/pipeline.py's answer_query).
    jurisdiction: str | None = None
    attachment_context: str | None = None


class FeedbackRequest(BaseModel):
    message_id: str
    feedback: str  # "helpful" | "unhelpful"
    notes: str | None = None


@app.get("/")
def root():
    return {"name": "IP-SAKTI RAG API", "docs": "/docs", "health": "/api/health"}


@app.api_route("/api/health", methods=["GET", "HEAD"])
def health():
    return {"status": "ok"}


@app.post("/api/chat")
def chat(payload: ChatRequest, x_internal_secret: str | None = Header(default=None)):
    _check_secret(x_internal_secret)
    query = (payload.query or payload.message or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query is required.")
    return rag.answer_query(
        query=query, language=payload.language, conversation_id=payload.conversation_id,
        jurisdiction=payload.jurisdiction, attachment_context=payload.attachment_context,
    )


@app.post("/api/attachment/context")
def attachment_context(payload: AttachmentRequest, x_internal_secret: str | None = Header(default=None)):
    _check_secret(x_internal_secret)
    import base64
    from io import BytesIO

    try:
        raw = base64.b64decode(payload.data_base64, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid attachment data.")

    if not raw:
        raise HTTPException(status_code=400, detail="The selected attachment is empty.")
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Attachments must be 10 MB or smaller.")

    filename = payload.filename or "attachment"
    content_type = (payload.content_type or "application/octet-stream").lower()
    suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

    # Text-bearing documents are extracted locally in the RAG service.
    text = ""
    if content_type == "application/pdf" or suffix == "pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(BytesIO(raw))
            pages = []
            for page in reader.pages[:30]:
                pages.append(page.extract_text() or "")
            text = "\n\n".join(pages).strip()
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Could not read this PDF: {exc}")
    elif suffix == "docx" or content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        try:
            from docx import Document
            doc = Document(BytesIO(raw))
            text = "\n".join(p.text for p in doc.paragraphs if p.text.strip()).strip()
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Could not read this DOCX file: {exc}")
    elif content_type.startswith("text/") or suffix in {"txt", "md", "csv", "json"}:
        try:
            text = raw.decode("utf-8", errors="replace").strip()
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Could not read this text file: {exc}")
    elif content_type.startswith("image/"):
        from app.generation.llm_client import GroqClient
        vision = GroqClient()
        text = vision.generate_image_context(raw, content_type)
        if not text:
            raise HTTPException(
                status_code=503,
                detail="The image could not be analyzed right now. Please retry once the vision model is available.",
            )
    else:
        raise HTTPException(status_code=415, detail="Supported attachments are PDF, DOCX, TXT, MD, CSV, JSON, and common image formats.")

    text = text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="No readable content was found in this attachment.")

    # Keep the attachment context bounded so one large file cannot crowd out
    # the user's actual question or the retrieved legal evidence.
    text = text[:16000]
    return {"success": True, "filename": filename, "context": text}


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


@app.delete("/api/conversations/{conversation_id}")
def delete_chat_conversation(conversation_id: str, x_internal_secret: str | None = Header(default=None)):
    _check_secret(x_internal_secret)
    delete_conversation(conversation_id)
    return {"success": True, "deleted_id": conversation_id, "permanent": True}


@app.post("/api/conversations/{conversation_id}/feedback")
def feedback(
    conversation_id: str, payload: FeedbackRequest, x_internal_secret: str | None = Header(default=None)
):
    _check_secret(x_internal_secret)
    rag.record_feedback(helpful=payload.feedback == "helpful")
    save_feedback(conversation_id, payload.message_id, payload.feedback, payload.notes)
    return {"success": True}

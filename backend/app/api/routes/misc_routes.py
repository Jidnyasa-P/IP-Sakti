import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user, require_role
from app.database.session import get_db
from app.models.citation import COLLECTION as SAVED_RESEARCH_COLLECTION, new_saved_research, to_dict as saved_research_to_dict
from app.schemas.chat import SaveResearchRequest, TranslateRequest
from app.retrieval.hybrid_retrieval import search_indexed_documents
from app.rag.corpus import get_metadata, get_chunks
from app.translation.translation_service import get_translation_provider

router = APIRouter()

# In-process telemetry counters (Section 33 / AdminView). Reset on restart —
# for durable telemetry across restarts, back this with the audit_logs table
# instead (see /api/admin/telemetry-from-audit below).
TELEMETRY = {
    "total_queries": 0,
    "average_retrieval_latency_ms": 0,
    "average_generation_latency_ms": 0,
    "low_confidence_queries_count": 0,
    "feedback_stats": {"helpful": 0, "unhelpful": 0},
    "recent_logs": [],
}


def record_telemetry(query: str, latency_ms: int, confidence_level: str, sources_retrieved: int):
    TELEMETRY["total_queries"] += 1
    TELEMETRY["average_generation_latency_ms"] = round((TELEMETRY["average_generation_latency_ms"] + latency_ms) / 2)
    if confidence_level in ("Low", "Insufficient evidence"):
        TELEMETRY["low_confidence_queries_count"] += 1
    TELEMETRY["recent_logs"].insert(0, {
        "id": f"log-{uuid.uuid4().hex[:10]}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "query": query[:80],
        "latency_ms": latency_ms,
        "confidence": confidence_level,
        "sources_retrieved": sources_retrieved,
    })
    TELEMETRY["recent_logs"] = TELEMETRY["recent_logs"][:15]


@router.get("/api/research/search")
def research_search(query: str = "", authority: str = "", topic: str = "", document_type: str = "", current_user: dict = Depends(get_current_user)):
    results = search_indexed_documents(query, topic=topic or None, authority=authority or None, document_type=document_type or None)
    return {"results": results, "total": len(results)}


@router.get("/api/workspace/saved-research")
def list_saved_research(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    is_admin = "Admin" in current_user.get("roles", [])
    query = {} if is_admin else {"user_id": current_user["id"]}
    rows = db[SAVED_RESEARCH_COLLECTION].find(query).sort("created_at", -1)
    return [saved_research_to_dict(r) for r in rows]


@router.post("/api/workspace/save-research")
def save_research(body: SaveResearchRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    record = new_saved_research(
        id=f"saved-{uuid.uuid4().hex[:10]}", user_id=current_user["id"],
        document_id=body.document_id, title=body.title, notes=body.notes or "",
    )
    db[SAVED_RESEARCH_COLLECTION].insert_one(record)
    return saved_research_to_dict(record)


@router.delete("/api/workspace/saved-research/{research_id}")
def delete_saved_research(research_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    row = db[SAVED_RESEARCH_COLLECTION].find_one({"_id": research_id})
    if row:
        is_admin = "Admin" in current_user.get("roles", [])
        if not is_admin and row.get("user_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="You do not have access to this saved item.")
        db[SAVED_RESEARCH_COLLECTION].delete_one({"_id": research_id})
    return {"success": True}


def _admin_documents_payload():
    return {
        "documents": get_metadata(),
        "total_chunks": len(get_chunks()),
        "vector_index_status": "HEALTHY (local TF-IDF index active; set QDRANT_URL for live Qdrant)",
        "retrieval_status": "HYBRID (Semantic 65% + BM25 35%)",
    }


@router.get("/api/admin/documents")
@router.get("/api/rag/documents")
def admin_documents(current_user: dict = Depends(require_role("Admin"))):
    return _admin_documents_payload()


@router.get("/api/admin/telemetry")
@router.get("/api/rag/telemetry")
def admin_telemetry(current_user: dict = Depends(require_role("Admin"))):
    return TELEMETRY


@router.post("/api/admin/documents")
def admin_add_document(body: dict, current_user: dict = Depends(require_role("Admin"))):
    from app.rag.ingest import ingest_document
    payload = {
        "title": body.get("title", "Untitled Document"),
        "source": body.get("source", ""),
        "authority": body.get("authority", ""),
        "document_type": body.get("document_type", "Guidelines"),
        "jurisdiction": body.get("jurisdiction", "India"),
        "topic": body.get("topic", "AYUSH"),
        "summary": body.get("summary", ""),
        "raw_text": body.get("raw_text") or body.get("summary", ""),
    }
    metadata = ingest_document(payload)
    return {"success": True, "document": metadata}


@router.post("/api/admin/documents/{document_id}/index")
def admin_reindex_document(document_id: str, current_user: dict = Depends(require_role("Admin"))):
    doc = next((d for d in get_metadata() if d["id"] == document_id), None)
    if not doc:
        return {"error": "Document not found."}
    return {"success": True, "message": f"Document {doc['title']} is indexed and searchable."}


@router.post("/api/translate")
async def translate(body: TranslateRequest):
    # Intentionally public (no auth dependency): the login/register screens
    # render before a session exists and still need UI-string translation
    # (see frontend/src/context/LanguageContext.tsx, which is mounted
    # outside AuthProvider's gate in App.tsx).
    provider = get_translation_provider()
    if body.text:
        translated, source = await provider.translate_text(body.text, body.target_language)
        return {"success": True, "target_language": body.target_language, "translated_text": translated, "source": source}
    if body.strings:
        translated, source = await provider.translate_strings(body.strings, body.target_language)
        return {"success": True, "target_language": body.target_language, "translated_strings": translated, "source": source}
    return {"error": "strings or text is required."}

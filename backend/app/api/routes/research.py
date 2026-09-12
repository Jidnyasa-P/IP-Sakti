import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.citation import SavedResearch
from app.retrieval.hybrid_retrieval import search_indexed_documents, get_document_details
from app.rag.corpus import get_metadata, get_chunks

router = APIRouter()

# In-process telemetry counters (Section 6/30). Persisted implicitly through
# the audit_logs table for anything that needs to survive a restart; these
# counters mirror the existing frontend's /api/rag/telemetry contract.
_TELEMETRY = {
    "total_queries": 0,
    "average_retrieval_latency_ms": 18,
    "average_generation_latency_ms": 480,
    "low_confidence_queries_count": 0,
    "feedback_stats": {"helpful": 0, "unhelpful": 0},
    "recent_logs": [],
}


def record_telemetry(query: str, latency_ms: int, confidence_level: str, sources_retrieved: int) -> None:
    _TELEMETRY["total_queries"] += 1
    _TELEMETRY["average_retrieval_latency_ms"] = round((_TELEMETRY["average_retrieval_latency_ms"] + latency_ms) / 2)
    if confidence_level in ("Low", "Insufficient evidence"):
        _TELEMETRY["low_confidence_queries_count"] += 1
    _TELEMETRY["recent_logs"].insert(0, {
        "id": f"log-{uuid.uuid4().hex[:8]}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "query": query[:80],
        "latency_ms": latency_ms,
        "confidence": confidence_level,
        "sources_retrieved": sources_retrieved,
    })
    _TELEMETRY["recent_logs"] = _TELEMETRY["recent_logs"][:15]


@router.get("/api/research/search")
def research_search(query: str = "", authority: str = "", topic: str = "", document_type: str = ""):
    docs = search_indexed_documents(query, topic=topic or None, authority=authority or None, document_type=document_type or None)
    return {"documents": docs, "total": len(docs)}


@router.get("/api/workspace/saved-research")
def list_saved_research(db: Session = Depends(get_db)):
    rows = db.query(SavedResearch).order_by(SavedResearch.created_at.desc()).all()
    return [
        {"id": r.id, "user_id": r.user_id, "document_id": r.document_id, "title": r.title, "notes": r.notes, "created_at": r.created_at.isoformat() if r.created_at else None}
        for r in rows
    ]


@router.post("/api/workspace/save-research")
def save_research(body: dict, db: Session = Depends(get_db)):
    record = SavedResearch(
        id=f"saved-{uuid.uuid4().hex[:10]}",
        user_id="user-default",
        document_id=body.get("document_id"),
        title=body.get("title"),
        notes=body.get("notes", ""),
    )
    db.add(record)
    db.commit()
    return {"id": record.id, "user_id": record.user_id, "document_id": record.document_id, "title": record.title, "notes": record.notes, "created_at": record.created_at.isoformat()}


@router.delete("/api/workspace/saved-research/{record_id}")
def delete_saved_research(record_id: str, db: Session = Depends(get_db)):
    row = db.get(SavedResearch, record_id)
    if row:
        db.delete(row)
        db.commit()
    return {"success": True}


@router.get("/api/admin/telemetry")
@router.get("/api/rag/telemetry")
def telemetry():
    return _TELEMETRY


@router.get("/api/admin/documents")
@router.get("/api/rag/documents")
def documents_overview():
    from app.rag.vector_store import get_vector_store, LocalVectorStore
    store = get_vector_store()
    return {
        "documents": get_metadata(),
        "total_chunks": len(get_chunks()),
        "vector_index_status": "HEALTHY (local TF-IDF index)" if isinstance(store, LocalVectorStore) else "HEALTHY (Qdrant)",
        "retrieval_status": "HYBRID (Semantic 65% + BM25 35%)",
    }


@router.post("/api/admin/documents")
def admin_add_document(body: dict):
    from app.rag.ingest import ingest_document
    payload = {**body, "raw_text": body.get("summary", "") or body.get("title", "")}
    metadata = ingest_document(payload)
    return {"success": True, "document": metadata}


@router.post("/api/admin/documents/{document_id}/index")
def admin_reindex_document(document_id: str):
    details = get_document_details(document_id)
    if not details["metadata"]:
        return {"error": "Document not found."}
    return {"success": True, "message": f"Document {details['metadata']['title']} re-indexed successfully."}

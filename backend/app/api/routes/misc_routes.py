import uuid
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user, require_role
from app.database.session import get_db
from app.models.citation import COLLECTION as SAVED_RESEARCH_COLLECTION, new_saved_research, to_dict as saved_research_to_dict
from app.models.grievance import COLLECTION as GRIEVANCE_COLLECTION, new_grievance, to_dict as grievance_to_dict
from app.schemas.chat import SaveResearchRequest, TranslateRequest, GrievanceCreateRequest
from app.translation.translation_service import get_translation_provider
import app.rag_client as rag_client

router = APIRouter()


@router.get("/api/research/search")
async def research_search(query: str = "", authority: str = "", topic: str = "", document_type: str = "", current_user: dict = Depends(get_current_user)):
    # CHANGED: previously wrapped the RAG service's response as
    # {"results": ..., "total": ...} and dropped `document_type` entirely.
    # ResearchView.tsx reads `data.documents` / `data.matching_chunks`
    # directly off this response, so pass ip_sakti_rag's shape straight
    # through instead of re-wrapping it, and forward document_type so the
    # "Document Type" filter actually does something.
    return await rag_client.search_documents(
        query=query, topic=topic or None, authority=authority or None, document_type=document_type or None
    )


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


@router.get("/api/workspace/grievances")
def list_grievances(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    rows = db[GRIEVANCE_COLLECTION].find({"user_id": current_user["id"]}).sort("created_at", -1)
    return [grievance_to_dict(row) for row in rows]


@router.post("/api/workspace/grievances")
def create_grievance(
    body: GrievanceCreateRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    # If a chat context was supplied, verify that it belongs to this user.
    if body.conversation_id:
        conversation = db["conversations"].find_one({
            "_id": body.conversation_id,
            "user_id": current_user["id"],
        })
        if not conversation:
            raise HTTPException(status_code=404, detail="Related conversation was not found.")

    record = new_grievance(
        id=f"grievance-{uuid.uuid4().hex[:12]}",
        user_id=current_user["id"],
        category=body.category.strip(),
        subject=body.subject.strip(),
        description=body.description.strip(),
        conversation_id=body.conversation_id,
        message_id=body.message_id,
        related_query=(body.related_query or "").strip() or None,
    )
    db[GRIEVANCE_COLLECTION].insert_one(record)
    return grievance_to_dict(record)


@router.get("/api/resources")
async def resources_mini_tab(current_user: dict = Depends(get_current_user)):
    """Lightweight document listing for the frontend's smaller Resources
    tab. Now sourced from ip_sakti_rag instead of the local corpus."""
    docs = await rag_client.list_documents()
    resources = [
        {
            "id": doc.get("id"),
            "title": doc.get("title"),
            "source": doc.get("source"),
            "authority": doc.get("authority"),
            "document_type": doc.get("document_type"),
            "jurisdiction": doc.get("jurisdiction"),
            "topic": doc.get("topic"),
            "url": doc.get("url"),
            "summary": doc.get("summary"),
        }
        for doc in docs
    ]
    return {"resources": resources, "total": len(resources)}


@router.get("/api/admin/documents")
@router.get("/api/rag/documents")
async def admin_documents(current_user: dict = Depends(require_role("Admin"))):
    docs = await rag_client.list_documents()
    return {
        "documents": docs,
        "total_chunks": sum(d.get("chunk_count", 0) for d in docs),
        "vector_index_status": "HEALTHY (ip_sakti_rag)",
        "retrieval_status": "HYBRID (ip_sakti_rag: semantic + BM25 + reciprocal rank fusion)",
    }


@router.get("/api/admin/telemetry")
@router.get("/api/rag/telemetry")
async def admin_telemetry(current_user: dict = Depends(require_role("Admin"))):
    return await rag_client.get_telemetry()


# NOTE: POST /api/admin/documents (add a document at runtime) is no longer
# available -- see the comment in app/api/routes/rag_routes.py. ip_sakti_rag
# ingests documents offline via its own scripts/ingest.py.


@router.post("/api/translate")
async def translate(body: TranslateRequest):
    # Intentionally public (no auth dependency): the login/register screens
    # render before a session exists and still need UI-string translation.
    # Unrelated to RAG -- unchanged.
    provider = get_translation_provider()
    if body.text:
        translated, source = await provider.translate_text(body.text, body.target_language)
        return {"success": True, "target_language": body.target_language, "translated_text": translated, "source": source}
    if body.strings:
        translated, source = await provider.translate_strings(body.strings, body.target_language)
        return {"success": True, "target_language": body.target_language, "translated_strings": translated, "source": source}
    return {"error": "strings or text is required."}

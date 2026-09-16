import uuid
from dataclasses import asdict
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user
from app.database.session import get_db
from app.schemas.chat import SearchRequest, ExpertEscalationRequest
from app.services import expert_escalation_service
from app.models.expert_escalation import COLLECTION as EXPERT_ESCALATIONS_COLLECTION, new_expert_escalation
import app.rag_client as rag_client

router = APIRouter()


@router.post("/api/search")
async def search(body: SearchRequest, current_user: dict = Depends(get_current_user)):
    results = await rag_client.search_documents(query=body.query)
    return {"query": body.query, "results": results[: body.top_k]}


@router.get("/api/sources")
async def sources(current_user: dict = Depends(get_current_user)):
    return {"sources": await rag_client.list_documents()}


@router.get("/api/documents/{document_id}")
async def document_details(document_id: str, current_user: dict = Depends(get_current_user)):
    details = await rag_client.get_document(document_id)
    if not details:
        raise HTTPException(status_code=404, detail="Document not found.")
    return details


# NOTE: there is no live document-ingest endpoint anymore. ip_sakti_rag
# builds its corpus offline via `python scripts/ingest.py` (see
# ip_sakti_rag/README.md) rather than through a runtime API -- so
# POST /api/documents/ingest (previously backed by app/rag/ingest.py, now
# deleted) has no equivalent here. To add a document, drop its source file
# into ip_sakti_rag/data/documents/ and re-run the ingestion script; the
# running ip_sakti_rag service needs a restart to pick up the new index.


@router.post("/api/expert-escalation")
def expert_escalation(body: ExpertEscalationRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    decision = expert_escalation_service.evaluate_escalation(
        query=body.query,
        confidence_level="Low",
        has_conflicts=False,
        jurisdiction_coverage_available=True,
        user_requested=True,
    )
    record_id = f"esc-{uuid.uuid4().hex[:10]}"
    record = new_expert_escalation(
        id=record_id,
        conversation_id=body.conversation_id,
        recommended=True,
        reason=body.reason or decision.reason,
        case_summary=decision.case_summary or body.query[:200],
    )
    db[EXPERT_ESCALATIONS_COLLECTION].insert_one(record)
    expert_escalation_service.notify_real_service(record_id)
    return {"success": True, "escalation_id": record_id, "status": record["status"]}

import uuid
from dataclasses import asdict
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user, require_role
from app.database.session import get_db
from app.schemas.chat import ClassifyRequest, SearchRequest, ValidateRequest, ExpertEscalationRequest
from app.schemas.domain import DocumentIngestRequest
from app.services import classification_service, expert_escalation_service
from app.rag.vector_store import get_vector_store
from app.retrieval.hybrid_retrieval import get_document_details
from app.validation.citation_validation import validate_citation
from app.rag.ingest import ingest_document
from app.rag.corpus import get_metadata
from app.models.expert_escalation import COLLECTION as EXPERT_ESCALATIONS_COLLECTION, new_expert_escalation
from app.models.classification import COLLECTION as CLASSIFICATION_COLLECTION, new_classification_record
from app.models.validation_result import COLLECTION as VALIDATION_RESULTS_COLLECTION, new_validation_result

router = APIRouter()


@router.post("/api/classify")
def classify(body: ClassifyRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    result = classification_service.classify(body.text)
    record = new_classification_record(
        id=f"cls-{uuid.uuid4().hex[:10]}",
        query=body.text,
        category=result.category,
        confidence=result.confidence,
        reasoning_summary=result.reasoning_summary,
        needs_clarification=result.needs_clarification,
        clarification_questions=result.clarification_questions,
    )
    db[CLASSIFICATION_COLLECTION].insert_one(record)
    return asdict(result)


@router.post("/api/search")
def search(body: SearchRequest, current_user: dict = Depends(get_current_user)):
    store = get_vector_store()
    results = store.query(body.query, top_k=body.top_k)
    return {"query": body.query, "results": results}


@router.post("/api/validate")
def validate(body: ValidateRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    outcome = validate_citation(body.claim, body.chunk_id)
    db[VALIDATION_RESULTS_COLLECTION].insert_one(new_validation_result(
        id=f"val-{uuid.uuid4().hex[:10]}",
        claim=outcome.claim,
        source=outcome.source,
        source_exists=outcome.source_exists,
        content_supports_claim=outcome.content_supports_claim,
        authority_valid=outcome.authority_valid,
        validation_status=outcome.validation_status,
        details={"warnings": outcome.warnings},
    ))
    return asdict(outcome)


@router.get("/api/sources")
def sources(current_user: dict = Depends(get_current_user)):
    return {"sources": get_metadata()}


@router.get("/api/documents/{document_id}")
def document_details(document_id: str, current_user: dict = Depends(get_current_user)):
    details = get_document_details(document_id)
    if not details["metadata"]:
        raise HTTPException(status_code=404, detail="Document not found.")
    return details


@router.post("/api/documents/ingest")
def documents_ingest(body: DocumentIngestRequest, current_user: dict = Depends(require_role("Admin"))):
    metadata = ingest_document(body.model_dump())
    return {"success": True, "document": metadata}


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

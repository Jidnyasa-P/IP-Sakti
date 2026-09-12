import uuid
from dataclasses import asdict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.chat import ClassifyRequest, SearchRequest, ValidateRequest, ExpertEscalationRequest
from app.schemas.domain import DocumentIngestRequest
from app.services import classification_service, expert_escalation_service
from app.rag.vector_store import get_vector_store
from app.retrieval.hybrid_retrieval import get_document_details
from app.validation.citation_validation import validate_citation
from app.rag.ingest import ingest_document
from app.rag.corpus import get_metadata
from app.models.expert_escalation import ExpertEscalation
from app.models.classification import ClassificationRecord

router = APIRouter()


@router.post("/api/classify")
def classify(body: ClassifyRequest, db: Session = Depends(get_db)):
    result = classification_service.classify(body.text)
    record = ClassificationRecord(
        id=f"cls-{uuid.uuid4().hex[:10]}",
        query=body.text,
        category=result.category,
        confidence=result.confidence,
        reasoning_summary=result.reasoning_summary,
        needs_clarification=str(result.needs_clarification).lower(),
        clarification_questions=result.clarification_questions,
    )
    db.add(record)
    db.commit()
    return asdict(result)


@router.post("/api/search")
def search(body: SearchRequest):
    store = get_vector_store()
    results = store.query(body.query, top_k=body.top_k)
    return {"query": body.query, "results": results}


@router.post("/api/validate")
def validate(body: ValidateRequest, db: Session = Depends(get_db)):
    outcome = validate_citation(body.claim, body.chunk_id)
    from app.models.validation_result import ValidationResultRecord
    db.add(ValidationResultRecord(
        id=f"val-{uuid.uuid4().hex[:10]}",
        claim=outcome.claim,
        source=outcome.source,
        source_exists=outcome.source_exists,
        content_supports_claim=outcome.content_supports_claim,
        authority_valid=outcome.authority_valid,
        validation_status=outcome.validation_status,
        details={"warnings": outcome.warnings},
    ))
    db.commit()
    return asdict(outcome)


@router.get("/api/sources")
def sources():
    return {"sources": get_metadata()}


@router.get("/api/documents/{document_id}")
def document_details(document_id: str):
    details = get_document_details(document_id)
    if not details["metadata"]:
        raise HTTPException(status_code=404, detail="Document not found.")
    return details


@router.post("/api/documents/ingest")
def documents_ingest(body: DocumentIngestRequest):
    metadata = ingest_document(body.model_dump())
    return {"success": True, "document": metadata}


@router.post("/api/expert-escalation")
def expert_escalation(body: ExpertEscalationRequest, db: Session = Depends(get_db)):
    decision = expert_escalation_service.evaluate_escalation(
        query=body.query,
        confidence_level="Low",
        has_conflicts=False,
        jurisdiction_coverage_available=True,
        user_requested=True,
    )
    record = ExpertEscalation(
        id=f"esc-{uuid.uuid4().hex[:10]}",
        conversation_id=body.conversation_id,
        recommended=True,
        reason=body.reason or decision.reason,
        case_summary=decision.case_summary or body.query[:200],
    )
    db.add(record)
    db.commit()
    expert_escalation_service.notify_real_service(record.id)
    return {"success": True, "escalation_id": record.id, "status": record.status}

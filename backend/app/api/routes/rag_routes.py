import uuid
from dataclasses import asdict
from fastapi import APIRouter, Depends, HTTPException, Response

from app.api.deps import get_current_user
from app.database.session import get_db
from app.schemas.chat import SearchRequest, ExpertEscalationRequest
from app.services import expert_escalation_service, email_service, notification_service
from app.models.expert_escalation import COLLECTION as EXPERT_ESCALATIONS_COLLECTION, new_expert_escalation
import app.rag_client as rag_client

router = APIRouter()


@router.post("/api/search")
async def search(body: SearchRequest, current_user: dict = Depends(get_current_user)):
    # search_documents() now returns {"documents": [...], "matching_chunks": [...]}
    # (see ip_sakti_rag/app/pipeline.py) rather than a bare list — updated to match.
    result = await rag_client.search_documents(query=body.query)
    return {"query": body.query, "results": result.get("matching_chunks", [])[: body.top_k]}


@router.get("/api/sources")
async def sources(current_user: dict = Depends(get_current_user)):
    return {"sources": await rag_client.list_documents()}


@router.get("/api/documents/{document_id}")
async def document_details(document_id: str, current_user: dict = Depends(get_current_user)):
    details = await rag_client.get_document(document_id)
    if not details:
        raise HTTPException(status_code=404, detail="Document not found.")
    return details


@router.get("/api/documents/{document_id}/source")
async def document_source(document_id: str, current_user: dict = Depends(get_current_user)):
    """NEW: streams the real ingested source PDF back to the browser, for
    CitationModal's "View Source PDF" link -- proof the citation traces to
    an actual file, not just a description of one."""
    result = await rag_client.get_document_source_bytes(document_id)
    if not result:
        raise HTTPException(status_code=404, detail="Source file not found.")
    content, media_type, filename = result
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


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
    if body.expert_type not in {"ayurveda", "legal", "regulatory"}:
        raise HTTPException(status_code=400, detail="Please choose a valid expert type.")

    expert_label = {
        "ayurveda": "Ayurveda Expert",
        "legal": "Legal / IP Expert",
        "regulatory": "Regulatory Affairs Expert",
    }[body.expert_type]

    # Route to one verified expert of the selected type. The assignment is
    # persisted so the expert console can show only cases actually assigned
    # to that expert.
    matching_expert = db["users"].find_one({
        "roles": "Expert",
        "expert_type": body.expert_type,
        "email_verified": True,
    }, sort=[("last_login_at", -1), ("created_at", 1)])

    record_id = f"esc-{uuid.uuid4().hex[:10]}"
    record = new_expert_escalation(
        id=record_id,
        conversation_id=body.conversation_id,
        recommended=True,
        reason=body.reason or decision.reason,
        case_summary=decision.case_summary or body.query[:200],
        expert_type=body.expert_type,
        user_id=current_user["id"],
        query=body.query,
        assigned_expert_id=matching_expert.get("_id") if matching_expert else None,
        assigned_expert_name=matching_expert.get("name") if matching_expert else None,
        assigned_expert_email=matching_expert.get("email") if matching_expert else None,
        status="assigned" if matching_expert else "pending",
    )
    db[EXPERT_ESCALATIONS_COLLECTION].insert_one(record)

    # Always confirm submission to the requester. If an eligible expert exists,
    # notify that expert as well.
    email_service.send_expert_request_to_user(
        current_user["email"], current_user["name"], expert_label
    )
    notification_service.notify(
        db, current_user["id"], "expert_request", "Expert guidance request submitted",
        f"Your request for a {expert_label} has been submitted. You will see assignment or status updates here.",
        data={"escalation_id": record_id, "expert_type": body.expert_type},
        severity="info",
    )

    expert_notified = False
    if matching_expert and matching_expert.get("email") != current_user.get("email"):
        expert_notified = email_service.send_expert_request_to_expert(
            matching_expert["email"],
            matching_expert.get("name", "Expert"),
            current_user["name"],
            expert_label,
            body.query,
        )
        notification_service.notify(
            db, matching_expert["_id"], "expert_request", "New expert consultation request",
            f"A new {expert_label} consultation request from {current_user["name"]} has been assigned to you.",
            data={"escalation_id": record_id, "expert_type": body.expert_type},
            severity="warning",
        )

    expert_escalation_service.notify_real_service(record_id)
    return {
        "success": True,
        "escalation_id": record_id,
        "status": record["status"],
        "expert_type": body.expert_type,
        "expert_type_label": expert_label,
        "expert_found": bool(matching_expert),
        "expert_notified": expert_notified,
        "expert": ({
            "id": matching_expert.get("_id"),
            "name": matching_expert.get("name", "Expert"),
            "email": matching_expert.get("email"),
            "type": expert_label,
        } if matching_expert else None),
    }

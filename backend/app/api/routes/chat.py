import json
import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.conversation import Conversation, ChatMessage
from app.schemas.chat import ChatRequest, QueryRequest, FeedbackRequest, NewConversationRequest
from app.rag.pipeline import run_pipeline
from app.services import conversation_service, audit_service, expert_escalation_service
from app.models.expert_escalation import ExpertEscalation
from app.api.routes.misc_routes import record_telemetry

router = APIRouter()


async def _handle_query(db: Session, query: str, conversation_id: str | None, language: str, target_market: str | None = None) -> dict:
    if not query:
        raise HTTPException(status_code=400, detail="Query is required.")

    conv = conversation_service.get_or_create_conversation(db, conversation_id, query, language)
    result = await run_pipeline(query, language=language, target_market=target_market)

    user_msg = conversation_service.add_message(
        db, conversation_id=conv.id, role="user", content=query, language=result["detected_language"],
    )
    assistant_msg = conversation_service.add_message(
        db,
        conversation_id=conv.id,
        role="assistant",
        content=result["answer"],
        answer=result["answer"],
        relevant_considerations=result["relevant_considerations"],
        recommended_next_steps=result["recommended_next_steps"],
        citations=result["citations"],
        confidence=result["confidence"],
        warnings=result["warnings"],
        classification=result["classification"],
        jurisdiction=result["jurisdiction"],
        expert_escalation=result["expert_escalation"],
        language=result["detected_language"],
    )
    conversation_service.touch_conversation(db, conv)

    audit_service.record_audit_log(
        db,
        conversation_id=conv.id,
        query=query,
        classification=result["classification"],
        jurisdiction=result["jurisdiction"],
        retrieved_sources=result["citations"],
        validation_status=result["validation_status"],
        confidence=result["confidence"],
        warnings=result["warnings"],
        model_info={"model_used": result["model_used"], "demo_mode": result["demo_mode"]},
        latency_ms=result["latency_ms"],
    )

    record_telemetry(query, result["latency_ms"]["total_ms"], result["confidence"]["level"], len(result["citations"]))

    if result["expert_escalation"]["recommended"]:
        db.add(ExpertEscalation(
            id=f"esc-{uuid.uuid4().hex[:10]}",
            conversation_id=conv.id,
            recommended=True,
            reason=result["expert_escalation"]["reason"],
            case_summary=result["expert_escalation"]["case_summary"],
        ))
        db.commit()

    return {
        "conversation_id": conv.id,
        "message": conversation_service.message_to_dict(assistant_msg),
        "result": result,
    }


@router.post("/api/chat")
async def chat(body: ChatRequest, db: Session = Depends(get_db)):
    query = body.resolved_query()
    outcome = await _handle_query(db, query, body.conversation_id, body.language)
    return {
        "conversation_id": outcome["conversation_id"],
        "message": outcome["message"],
        "retrieval_metadata": {
            "intent": outcome["result"]["detected_intent"],
            "language": outcome["result"]["detected_language"],
            "latency_ms": outcome["result"]["latency_ms"]["total_ms"],
        },
    }


@router.post("/api/chat/stream")
async def chat_stream(body: ChatRequest, db: Session = Depends(get_db)):
    query = body.resolved_query()

    async def event_generator():
        try:
            outcome = await _handle_query(db, query, body.conversation_id, body.language)
            yield f"data: {json.dumps({'type': 'complete', **outcome})}\n\n"
        except HTTPException as exc:
            yield f"data: {json.dumps({'type': 'error', 'error': exc.detail})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/api/query")
async def query_endpoint(body: QueryRequest, db: Session = Depends(get_db)):
    """Canonical SIH-spec endpoint (Section 25/26)."""
    outcome = await _handle_query(db, body.query, body.conversation_id, body.language, body.target_market)
    result = outcome["result"]
    return {
        "conversation_id": outcome["conversation_id"],
        "answer": result["answer"],
        "classification": result["classification"],
        "jurisdiction": result["jurisdiction"],
        "recommended_actions": [
            {"step": i + 1, "action": step, "reason": "", "source": ""}
            for i, step in enumerate(result["recommended_next_steps"])
        ],
        "compliance_requirements": [],
        "citations": result["citations"],
        "evidence": result["citations"],
        "warnings": result["warnings"],
        "confidence": result["confidence"]["score"],
        "confidence_detail": result["confidence"],
        "expert_escalation": result["expert_escalation"],
        "language": result["detected_language"],
        "demo_mode": result["demo_mode"],
        "knowledge_graph_context": result["knowledge_graph_context"],
        "conflicts": result["conflicts"],
        "validation_status": result["validation_status"],
    }


@router.get("/api/conversations")
def list_conversations(db: Session = Depends(get_db)):
    convs = db.query(Conversation).order_by(Conversation.updated_at.desc()).all()
    return [
        conversation_service.conversation_to_dict(c, conversation_service.recent_messages(db, c.id, limit=1000))
        for c in convs
    ]


@router.get("/api/conversations/{conversation_id}")
def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    conv = db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    messages = conversation_service.recent_messages(db, conversation_id, limit=1000)
    return conversation_service.conversation_to_dict(conv, messages)


@router.post("/api/conversations")
def create_conversation(body: NewConversationRequest, db: Session = Depends(get_db)):
    conv = conversation_service.get_or_create_conversation(db, None, body.title or "New Research Session", body.language)
    return conversation_service.conversation_to_dict(conv, [])


@router.delete("/api/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    conv = db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    db.query(ChatMessage).filter(ChatMessage.conversation_id == conversation_id).delete()
    db.delete(conv)
    db.commit()
    return {"success": True, "deleted_id": conversation_id}


@router.post("/api/conversations/{conversation_id}/feedback")
def submit_feedback(conversation_id: str, body: FeedbackRequest, db: Session = Depends(get_db)):
    msg = db.get(ChatMessage, body.message_id)
    if msg and msg.conversation_id == conversation_id:
        msg.feedback = body.feedback
        msg.feedback_notes = body.notes
        db.commit()
    from app.models.feedback import Feedback
    db.add(Feedback(id=f"fb-{uuid.uuid4().hex[:10]}", conversation_id=conversation_id, message_id=body.message_id, feedback=body.feedback, notes=body.notes))
    db.commit()
    return {"success": True}

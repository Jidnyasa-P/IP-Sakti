import json
import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.conversation import CONVERSATIONS_COLLECTION, CHAT_MESSAGES_COLLECTION
from app.models.expert_escalation import COLLECTION as EXPERT_ESCALATIONS_COLLECTION, new_expert_escalation
from app.models.feedback import COLLECTION as FEEDBACK_COLLECTION, new_feedback
from app.schemas.chat import ChatRequest, QueryRequest, FeedbackRequest, NewConversationRequest
from app.rag.pipeline import run_pipeline
from app.services import conversation_service, audit_service
from app.api.routes.misc_routes import record_telemetry

router = APIRouter()


def _get_owned_conversation(db, conversation_id: str, user_id: str, is_admin: bool) -> dict:
    """Fetch a conversation and enforce ownership (Section 7: user data
    isolation) — Admins may access any conversation, everyone else only
    their own."""
    conv = db[CONVERSATIONS_COLLECTION].find_one({"_id": conversation_id})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    if not is_admin and conv.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="You do not have access to this conversation.")
    return conv


async def _handle_query(db, query: str, conversation_id: str | None, language: str, user_id: str, target_market: str | None = None) -> dict:
    if not query:
        raise HTTPException(status_code=400, detail="Query is required.")

    conv = conversation_service.get_or_create_conversation(db, conversation_id, query, language, user_id=user_id)

    result = await run_pipeline(query, language=language, target_market=target_market)

    conversation_service.add_message(
        db, conversation_id=conv["_id"], role="user", content=query, language=result["detected_language"],
    )
    assistant_msg = conversation_service.add_message(
        db,
        conversation_id=conv["_id"],
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
        conversation_id=conv["_id"],
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
        db[EXPERT_ESCALATIONS_COLLECTION].insert_one(new_expert_escalation(
            id=f"esc-{uuid.uuid4().hex[:10]}",
            conversation_id=conv["_id"],
            recommended=True,
            reason=result["expert_escalation"]["reason"],
            case_summary=result["expert_escalation"]["case_summary"],
        ))

    return {
        "conversation_id": conv["_id"],
        "message": conversation_service.message_to_dict(assistant_msg),
        "result": result,
    }


@router.post("/api/chat")
async def chat(body: ChatRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    query = body.resolved_query()
    outcome = await _handle_query(db, query, body.conversation_id, body.language, user_id=current_user["id"])
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
async def chat_stream(body: ChatRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    query = body.resolved_query()

    async def event_generator():
        try:
            outcome = await _handle_query(db, query, body.conversation_id, body.language, user_id=current_user["id"])
            yield f"data: {json.dumps({'type': 'complete', **outcome})}\n\n"
        except HTTPException as exc:
            yield f"data: {json.dumps({'type': 'error', 'error': exc.detail})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/api/query")
async def query_endpoint(body: QueryRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Canonical SIH-spec endpoint (Section 25/26)."""
    outcome = await _handle_query(db, body.query, body.conversation_id, body.language, user_id=current_user["id"], target_market=body.target_market)
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
def list_conversations(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Section 7: a user only ever sees their own conversations. Admins see
    every conversation (needed for future admin oversight views)."""
    is_admin = "Admin" in current_user.get("roles", [])
    query = {} if is_admin else {"user_id": current_user["id"]}
    convs = list(db[CONVERSATIONS_COLLECTION].find(query).sort("updated_at", -1))
    return [
        conversation_service.conversation_to_dict(c, conversation_service.recent_messages(db, c["_id"], limit=1000))
        for c in convs
    ]


@router.get("/api/conversations/{conversation_id}")
def get_conversation(conversation_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    is_admin = "Admin" in current_user.get("roles", [])
    conv = _get_owned_conversation(db, conversation_id, current_user["id"], is_admin)
    messages = conversation_service.recent_messages(db, conversation_id, limit=1000)
    return conversation_service.conversation_to_dict(conv, messages)


@router.post("/api/conversations")
def create_conversation(body: NewConversationRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    conv = conversation_service.get_or_create_conversation(
        db, None, body.title or "New Research Session", body.language, user_id=current_user["id"],
    )
    return conversation_service.conversation_to_dict(conv, [])


@router.delete("/api/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    is_admin = "Admin" in current_user.get("roles", [])
    _get_owned_conversation(db, conversation_id, current_user["id"], is_admin)
    db[CHAT_MESSAGES_COLLECTION].delete_many({"conversation_id": conversation_id})
    db[CONVERSATIONS_COLLECTION].delete_one({"_id": conversation_id})
    return {"success": True, "deleted_id": conversation_id}


@router.post("/api/conversations/{conversation_id}/feedback")
def submit_feedback(conversation_id: str, body: FeedbackRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    is_admin = "Admin" in current_user.get("roles", [])
    _get_owned_conversation(db, conversation_id, current_user["id"], is_admin)

    msg = db[CHAT_MESSAGES_COLLECTION].find_one({"_id": body.message_id})
    if msg and msg.get("conversation_id") == conversation_id:
        db[CHAT_MESSAGES_COLLECTION].update_one(
            {"_id": body.message_id},
            {"$set": {"feedback": body.feedback, "feedback_notes": body.notes}},
        )
    db[FEEDBACK_COLLECTION].insert_one(new_feedback(
        id=f"fb-{uuid.uuid4().hex[:10]}",
        conversation_id=conversation_id,
        message_id=body.message_id,
        feedback=body.feedback,
        notes=body.notes,
    ))
    return {"success": True}

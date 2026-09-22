import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.conversation import CONVERSATIONS_COLLECTION, CHAT_MESSAGES_COLLECTION
from app.models.expert_escalation import COLLECTION as EXPERT_ESCALATIONS_COLLECTION, new_expert_escalation
from app.models.feedback import COLLECTION as FEEDBACK_COLLECTION, new_feedback
from app.schemas.chat import ChatRequest, QueryRequest, FeedbackRequest, NewConversationRequest, RenameConversationRequest
from app.services import conversation_service, audit_service, expert_escalation_service
import app.rag_client as rag_client

router = APIRouter()


def _get_owned_conversation(db, conversation_id: str, user_id: str, is_admin: bool) -> dict:
    """Fetch a conversation and enforce ownership (Section 7: user data
    isolation) -- Admins may access any conversation, everyone else only
    their own."""
    conv = db[CONVERSATIONS_COLLECTION].find_one({"_id": conversation_id})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    if not is_admin and conv.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="You do not have access to this conversation.")
    return conv


async def _handle_query(db, query: str, conversation_id: str | None, language: str, user_id: str, jurisdiction: str | None = None) -> dict:
    if not query:
        raise HTTPException(status_code=400, detail="Query is required.")

    # FIXED ("19+ blank chats"): this used to call get_or_create_conversation
    # (which INSERTs a conversation document) before calling the RAG
    # microservice. On free-tier hosting the RAG service cold-starts /
    # sleeps and regularly times out or errors after several retries (see
    # rag_client._request) -- when that happened, the conversation record
    # was already sitting in MongoDB with zero messages, and every retry
    # produced another one. Now: resolve/generate the conversation id
    # without writing anything, call the RAG service first, and only create
    # the conversation record (and its messages) once we actually have a
    # response to store. A failed call now raises RagServiceError with
    # nothing written to the database at all -- no more orphaned blanks.
    existing_conv = db[CONVERSATIONS_COLLECTION].find_one({"_id": conversation_id}) if conversation_id else None
    working_conversation_id = existing_conv["_id"] if existing_conv else (conversation_id or conversation_service.new_conversation_id())

    # All retrieval + reasoning happens in the ip_sakti_rag microservice now.
    # FIXED: `jurisdiction` (the India/International toggle's value) used to
    # be accepted here as `target_market` but never actually forwarded to
    # rag_client.chat() -- the toggle had zero effect on the backend. Now
    # forwarded through so ip_sakti_rag's scope guard can enforce it
    # (see ip_sakti_rag/app/safety/scope_guard.py).
    rag_result = await rag_client.chat(query=query, language=language, conversation_id=working_conversation_id, jurisdiction=jurisdiction)

    # Only now -- once the RAG call has actually succeeded -- do we create
    # (or fetch) the conversation record, reusing working_conversation_id so
    # it matches what was just sent to/returned by the RAG service.
    conv = existing_conv or conversation_service.get_or_create_conversation(
        db, working_conversation_id, query, language, user_id=user_id,
    )

    confidence = rag_result.get("confidence") or {}
    raw_confidence_score = confidence.get("score")
    confidence_score = (
        float(raw_confidence_score)
        if isinstance(raw_confidence_score, (int, float))
        else None
    )
    if confidence_score is not None and confidence_score > 1:
        confidence_score = confidence_score / 100.0

    # `rag_result["needs_expert"]` is now just ip_sakti_rag's own confidence
    # < 70% check (see decide_abstention) -- it is not an actual user
    # request, and passing it as `user_requested=True` produced a
    # misleading "User explicitly requested expert consultation" reason on
    # every low-confidence answer. `confidence_score` below already drives
    # the same low-confidence escalation correctly, so it's simply dropped
    # here; `user_requested` is reserved for a real explicit ask (there
    # isn't one on this code path).
    escalation = expert_escalation_service.evaluate_escalation(
        query=query,
        confidence_level=confidence.get("level", "Low"),
        confidence_score=confidence_score,
        has_conflicts=False,
        jurisdiction_coverage_available=bool(rag_result.get("jurisdiction")),
    )

    conversation_service.add_message(
        db, conversation_id=conv["_id"], role="user", content=query, language=rag_result.get("language"),
    )
    assistant_msg = conversation_service.add_message(
        db,
        conversation_id=conv["_id"],
        role="assistant",
        content=rag_result.get("answer"),
        answer=rag_result.get("answer"),
        relevant_considerations=rag_result.get("relevant_considerations", []),
        recommended_next_steps=rag_result.get("recommended_next_steps", []),
        citations=rag_result.get("citations", []),
        confidence=confidence,
        warnings=[rag_result["disclaimer"]] if rag_result.get("needs_clarification") else [],
        classification={"category": rag_result.get("product_classification")},
        jurisdiction=rag_result.get("jurisdiction"),
        expert_escalation={
            "recommended": escalation.recommended,
            "reason": escalation.reason,
            "case_summary": escalation.case_summary,
        },
        language=rag_result.get("language"),
        # True when ip_sakti_rag's scope guard blocked this before retrieval/
        # generation ran (off-topic, prompt injection, or wrong jurisdiction
        # toggle) -- see ip_sakti_rag/app/safety/scope_guard.py. `answer` is
        # then only the warning/redirect message. Frontend renders this
        # distinctly (see ChatView.tsx).
        scope_blocked=bool(rag_result.get("scope_blocked")),
    )
    conversation_service.touch_conversation(db, conv)

    audit_service.record_audit_log(
        db,
        conversation_id=conv["_id"],
        query=query,
        classification={"category": rag_result.get("product_classification")},
        jurisdiction=rag_result.get("jurisdiction"),
        retrieved_sources=rag_result.get("citations", []),
        validation_status="validated",
        confidence=confidence,
        warnings=[],
        model_info={"model_used": "ip_sakti_rag", "demo_mode": None},
        latency_ms=rag_result.get("retrieval_metadata", {}).get("latency_ms"),
    )

    if escalation.recommended:
        db[EXPERT_ESCALATIONS_COLLECTION].insert_one(new_expert_escalation(
            id=f"esc-{uuid.uuid4().hex[:10]}",
            conversation_id=conv["_id"],
            recommended=True,
            reason=escalation.reason,
            case_summary=escalation.case_summary,
        ))

    return {
        "conversation_id": conv["_id"],
        "message": conversation_service.message_to_dict(assistant_msg),
        "result": rag_result,
        "escalation": escalation,
        "scope_blocked": bool(rag_result.get("scope_blocked")),
    }


@router.post("/api/chat")
async def chat(body: ChatRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    query = body.resolved_query()
    outcome = await _handle_query(
        db, query, body.conversation_id, body.language, user_id=current_user["id"], jurisdiction=body.resolved_jurisdiction(),
    )
    return {
        "conversation_id": outcome["conversation_id"],
        "message": outcome["message"],
        "retrieval_metadata": outcome["result"].get("retrieval_metadata", {}),
        "scope_blocked": outcome["scope_blocked"],
    }


@router.post("/api/query")
async def query_endpoint(body: QueryRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Canonical SIH-spec endpoint (Section 25/26)."""
    outcome = await _handle_query(db, body.query, body.conversation_id, body.language, user_id=current_user["id"], jurisdiction=body.target_market)
    result = outcome["result"]
    escalation = outcome["escalation"]
    return {
        "conversation_id": outcome["conversation_id"],
        "answer": result.get("answer"),
        "classification": {"category": result.get("product_classification")},
        "jurisdiction": result.get("jurisdiction"),
        "recommended_actions": [
            {"step": i + 1, "action": step, "reason": "", "source": ""}
            for i, step in enumerate(result.get("recommended_next_steps", []))
        ],
        "compliance_requirements": [],
        "citations": result.get("citations", []),
        "evidence": result.get("evidence", []),
        "warnings": [],
        "confidence": (result.get("confidence") or {}).get("score"),
        "confidence_detail": result.get("confidence"),
        "expert_escalation": {
            "recommended": escalation.recommended,
            "reason": escalation.reason,
            "case_summary": escalation.case_summary,
        },
        "language": result.get("language"),
        "demo_mode": None,
        "knowledge_graph_context": None,
        "conflicts": [],
        "validation_status": "validated",
    }


@router.get("/api/conversations")
def list_conversations(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Section 7: a user only ever sees their own conversations. Admins see
    every conversation (needed for future admin oversight views)."""
    is_admin = "Admin" in current_user.get("roles", [])
    query = {} if is_admin else {"user_id": current_user["id"]}

    # One-time self-cleanup for the pre-existing "blank chats" bug: earlier
    # versions of _handle_query could leave behind a conversation record
    # with message_seq == 0 (created, then never got any messages because
    # the RAG call failed/timed out -- see _handle_query above, which no
    # longer does this going forward). A conversation can only legitimately
    # reach message_seq == 0 if its very first message insert hasn't
    # happened yet, which now only occurs in the instant between
    # get_or_create_conversation() and add_message() within a single
    # request -- so it's safe to purge any that are more than a couple of
    # minutes old; a conversation actively mid-request is never that stale.
    stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=2)
    db[CONVERSATIONS_COLLECTION].delete_many({
        **query,
        "message_seq": 0,
        "created_at": {"$lt": stale_cutoff},
    })

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


@router.patch("/api/conversations/{conversation_id}")
def rename_conversation(conversation_id: str, body: RenameConversationRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    is_admin = "Admin" in current_user.get("roles", [])
    _get_owned_conversation(db, conversation_id, current_user["id"], is_admin)
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Conversation title cannot be empty.")
    title = title[:80]
    db[CONVERSATIONS_COLLECTION].update_one(
        {"_id": conversation_id},
        {"$set": {"title": title, "updated_at": datetime.now(timezone.utc)}},
    )
    conv = db[CONVERSATIONS_COLLECTION].find_one({"_id": conversation_id})
    messages = conversation_service.recent_messages(db, conversation_id, limit=1000)
    return conversation_service.conversation_to_dict(conv, messages)


@router.delete("/api/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    is_admin = "Admin" in current_user.get("roles", [])
    _get_owned_conversation(db, conversation_id, current_user["id"], is_admin)
    db[CHAT_MESSAGES_COLLECTION].delete_many({"conversation_id": conversation_id})
    db[CONVERSATIONS_COLLECTION].delete_one({"_id": conversation_id})
    return {"success": True, "deleted_id": conversation_id}


@router.post("/api/conversations/{conversation_id}/feedback")
async def submit_feedback(conversation_id: str, body: FeedbackRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
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
    # Mirror the feedback into ip_sakti_rag so its own telemetry stays in sync.
    try:
        await rag_client.submit_feedback(conversation_id, body.message_id, body.feedback, body.notes)
    except rag_client.RagServiceError:
        pass  # local feedback record already saved; RAG-side mirror is best-effort
    return {"success": True}

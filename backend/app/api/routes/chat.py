import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from bson import ObjectId

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.conversation import CONVERSATIONS_COLLECTION, CHAT_MESSAGES_COLLECTION
from app.models.conversation import _json_safe
from app.models.expert_escalation import COLLECTION as EXPERT_ESCALATIONS_COLLECTION, new_expert_escalation
from app.models.feedback import COLLECTION as FEEDBACK_COLLECTION, new_feedback
from app.schemas.chat import ChatRequest, QueryRequest, FeedbackRequest, NewConversationRequest, RenameConversationRequest
from app.services import conversation_service, audit_service, expert_escalation_service
from app.services.conversation_service import ConversationDeletedError
from app.services.email_service import send_query_email, send_expert_request_email
import app.rag_client as rag_client

router = APIRouter()


def current_user_email(db, user_id: str) -> str | None:
    user = db["users"].find_one({"_id": user_id})
    return user.get("email") if user else None

def current_user_name(db, user_id: str) -> str:
    user = db["users"].find_one({"_id": user_id})
    return user.get("name", "there") if user else "there"


def _conversation_id_candidates(conversation_id: str) -> list:
    """Support current string IDs and legacy MongoDB ObjectId IDs."""
    value = str(conversation_id)
    candidates = [value]
    try:
        candidates.append(ObjectId(value))
    except Exception:
        pass
    return candidates


def _conversation_lookup_filter(conversation_id: str) -> dict:
    candidates = _conversation_id_candidates(conversation_id)
    return {
        "$or": [
            {"_id": candidate} for candidate in candidates
        ] + [
            {"conversation_id": candidate} for candidate in candidates
        ]
    }


def _get_owned_conversation(db, conversation_id: str, user_id: str, is_admin: bool) -> dict:
    """Fetch a live conversation by canonical id or legacy conversation_id."""
    if db["deleted_conversations"].find_one({"conversation_id": str(conversation_id), "user_id": user_id}):
        raise HTTPException(status_code=410, detail="Conversation was permanently deleted.")

    conv = db[CONVERSATIONS_COLLECTION].find_one(_conversation_lookup_filter(conversation_id))
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    if not is_admin and conv.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="You do not have access to this conversation.")

    # Also reject a legacy record whose canonical id has already been
    # tombstoned. This closes the old-id/canonical-id resurrection path.
    for candidate in {str(conv.get("_id")), str(conv.get("conversation_id"))}:
        if db["deleted_conversations"].find_one({"conversation_id": candidate, "user_id": user_id}):
            raise HTTPException(status_code=410, detail="Conversation was permanently deleted.")
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
    # Deleted sessions are tombstoned so an in-flight/stale client request can
    # never recreate the exact same conversation after the user removed it.
    requested_conversation_id = str(conversation_id) if conversation_id else None
    if requested_conversation_id:
        deleted_marker = db["deleted_conversations"].find_one({
            "conversation_id": requested_conversation_id,
            "user_id": user_id,
        })
        if deleted_marker:
            # A session that the user explicitly deleted must never be reused,
            # even when an old tab/in-flight request sends the deleted id.
            raise HTTPException(status_code=410, detail="Conversation was permanently deleted.")

    existing_conv = (
        db[CONVERSATIONS_COLLECTION].find_one({
            "$and": [_conversation_lookup_filter(str(conversation_id)), {"user_id": user_id}]
        })
        if conversation_id else None
    )

    if existing_conv:
        # Use the authenticated user's canonical stored ID.
        working_conversation_id = str(existing_conv["_id"])
    elif conversation_id:
        requested_id = str(conversation_id)
        # If the requested ID belongs to another account, never send that ID
        # to the RAG service or attempt to persist it. Allocate a new ID for
        # this user so accounts remain completely isolated.
        foreign_conv = db[CONVERSATIONS_COLLECTION].find_one(
            _conversation_lookup_filter(requested_id)
        )
        working_conversation_id = (
            conversation_service.new_conversation_id()
            if foreign_conv
            else requested_id
        )
    else:
        working_conversation_id = conversation_service.new_conversation_id()

    # All retrieval + reasoning happens in the ip_sakti_rag microservice now.
    # FIXED: `jurisdiction` (the India/International toggle's value) used to
    # be accepted here as `target_market` but never actually forwarded to
    # rag_client.chat() -- the toggle had zero effect on the backend. Now
    # forwarded through so ip_sakti_rag's scope guard can enforce it
    # (see ip_sakti_rag/app/safety/scope_guard.py).
    rag_result = await rag_client.chat(query=query, language=language, conversation_id=working_conversation_id, jurisdiction=jurisdiction)

    # A delete may have happened while the RAG request was running. Never
    # recreate that deleted session after the user explicitly removed it.
    if requested_conversation_id and db["deleted_conversations"].find_one({
        "conversation_id": requested_conversation_id,
        "user_id": user_id,
    }):
        raise HTTPException(status_code=410, detail="Conversation was deleted while the request was in progress.")
    if db["deleted_conversations"].find_one({
        "conversation_id": str(working_conversation_id),
        "user_id": user_id,
    }):
        raise HTTPException(status_code=410, detail="Conversation was permanently deleted.")

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

    try:
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
    except ConversationDeletedError:
        raise HTTPException(status_code=410, detail="Conversation was permanently deleted.")

    # A delete can race the message write. Always re-check the tombstone before
    # returning the result so an explicit delete cannot be resurrected by an
    # in-flight request.
    if db["deleted_conversations"].find_one({
        "conversation_id": str(conv["_id"]),
        "user_id": user_id,
    }):
        raise HTTPException(status_code=410, detail="Conversation was permanently deleted.")

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

    send_query_email(user_email := current_user_email(db, user_id), current_user_name(db, user_id), query) if user_email else None

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
        "conversation_id": _json_safe(outcome["conversation_id"]),
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
        "conversation_id": _json_safe(outcome["conversation_id"]),
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
    """Return only live conversations for the authenticated user.

    Deleted conversation IDs are permanently filtered by their tombstones so
    an old/stale worker or client cannot make a removed session reappear.
    """
    is_admin = "Admin" in current_user.get("roles", [])
    user_id = current_user["id"]
    query = {} if is_admin else {"user_id": user_id}

    # Clean up only truly stale blank records from old deployments.
    stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=2)
    db[CONVERSATIONS_COLLECTION].delete_many({
        **query,
        "message_seq": 0,
        "created_at": {"$lt": stale_cutoff},
    })

    tombstone_query = {} if is_admin else {"user_id": user_id}
    tombstone_ids = {
        str(row.get("conversation_id"))
        for row in db["deleted_conversations"].find(tombstone_query, {"conversation_id": 1})
        if row.get("conversation_id") is not None
    }

    # Filter in Python so legacy ObjectId `_id` values are compared by their
    # string representation too. This prevents an old deleted session from
    # returning simply because its Mongo type differs from current IDs.
    all_convs = list(db[CONVERSATIONS_COLLECTION].find(query).sort("updated_at", -1))
    convs = [
        c for c in all_convs
        if str(c.get("_id")) not in tombstone_ids
        and str(c.get("conversation_id")) not in tombstone_ids
    ]
    return [
        conversation_service.conversation_to_dict(
            c, conversation_service.recent_messages(db, str(c["_id"]), limit=1000)
        )
        for c in convs
    ]


@router.get("/api/conversations/{conversation_id}")
def get_conversation(conversation_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    is_admin = "Admin" in current_user.get("roles", [])
    conv = _get_owned_conversation(db, conversation_id, current_user["id"], is_admin)
    canonical_id = str(conv["_id"])
    messages = conversation_service.recent_messages(db, canonical_id, limit=1000)
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
    conv = _get_owned_conversation(db, conversation_id, current_user["id"], is_admin)
    canonical_id = str(conv["_id"])
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Conversation title cannot be empty.")
    title = title[:80]
    db[CONVERSATIONS_COLLECTION].update_one(
        {"_id": canonical_id},
        {"$set": {"title": title, "updated_at": datetime.now(timezone.utc)}},
    )
    conv = db[CONVERSATIONS_COLLECTION].find_one({"_id": canonical_id})
    messages = conversation_service.recent_messages(db, canonical_id, limit=1000)
    return conversation_service.conversation_to_dict(conv, messages)


@router.delete("/api/conversations")
async def delete_all_conversations(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Permanently delete every chat/research session belonging to the user."""
    user_id = current_user["id"]
    convs = list(db[CONVERSATIONS_COLLECTION].find({"user_id": user_id}, {"_id": 1, "conversation_id": 1}))
    now = datetime.now(timezone.utc)

    all_ids: set[str] = set()
    for conv in convs:
        canonical_id = str(conv.get("_id"))
        aliases = {canonical_id}
        if conv.get("conversation_id") is not None:
            aliases.add(str(conv.get("conversation_id")))
        all_ids.update(aliases)
        for conversation_id in aliases:
            db["deleted_conversations"].update_one(
                {"conversation_id": conversation_id, "user_id": user_id},
                {"$set": {"conversation_id": conversation_id, "user_id": user_id, "deleted_at": now}},
                upsert=True,
            )

    if all_ids:
        db[CHAT_MESSAGES_COLLECTION].delete_many({"conversation_id": {"$in": list(all_ids)}})
        db[CONVERSATIONS_COLLECTION].delete_many({"user_id": user_id})
        for collection_name in (
            "feedback",
            "expert_escalations",
            "classification_records",
            "validation_results",
            "audit_logs",
        ):
            db[collection_name].delete_many({"conversation_id": {"$in": list(all_ids)}})
        for conversation_id in all_ids:
            background_tasks.add_task(rag_client.delete_conversation, conversation_id)

    return {"success": True, "deleted_count": len(convs), "permanent": True}


@router.delete("/api/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    is_admin = "Admin" in current_user.get("roles", [])
    user_id = current_user["id"]

    conv = db[CONVERSATIONS_COLLECTION].find_one(_conversation_lookup_filter(conversation_id))

    # Verify ownership before creating any deletion marker. This prevents one
    # user from writing a side-effecting tombstone for another user's chat.
    if conv and not is_admin and conv.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="You do not have access to this conversation.")

    tombstone_user_id = conv.get("user_id") if conv else user_id
    if conv:
        canonical_id = str(conv["_id"])
        id_values = _conversation_id_candidates(canonical_id)
        if conv.get("conversation_id") is not None:
            id_values.extend(_conversation_id_candidates(str(conv.get("conversation_id"))))
        id_values.extend(_conversation_id_candidates(str(conversation_id)))
        # De-duplicate values while preserving both ObjectId and string types.
        ids = set()
        for value in id_values:
            try:
                ids.add((type(value).__name__, str(value)))
            except Exception:
                pass
        message_ids = list({value for _, value in ids})
        message_id_values = []
        for value in message_ids:
            message_id_values.extend(_conversation_id_candidates(value))
    else:
        message_id_values = _conversation_id_candidates(str(conversation_id))
        canonical_id = str(conversation_id)

    tombstone_ids = set(message_ids if conv else [str(conversation_id)])
    now = datetime.now(timezone.utc)
    for deleted_id in tombstone_ids:
        db["deleted_conversations"].update_one(
            {"conversation_id": deleted_id, "user_id": tombstone_user_id},
            {
                "$set": {
                    "conversation_id": deleted_id,
                    "user_id": tombstone_user_id,
                    "deleted_at": now,
                }
            },
            upsert=True,
        )

    if conv:
        db[CHAT_MESSAGES_COLLECTION].delete_many({"conversation_id": {"$in": message_id_values}})
        db[CONVERSATIONS_COLLECTION].delete_one({"_id": conv["_id"]})

        # Remove related application-side records that belong exclusively to
        # this session. A grievance is intentionally retained because it is a
        # user-submitted record and has its own lifecycle in Workspace.
        for collection_name in (
            "feedback",
            "expert_escalations",
            "classification_records",
            "validation_results",
            "audit_logs",
        ):
            db[collection_name].delete_many({"conversation_id": {"$in": list(tombstone_ids)}})
    else:
        canonical_id = str(conversation_id)

    # Keep ip_sakti_rag's separate persistence in sync without making the
    # user's delete button wait for a Render cold start. The local tombstone
    # above already makes resurrection impossible on the backend.
    for deleted_id in tombstone_ids:
        background_tasks.add_task(rag_client.delete_conversation, deleted_id)

    return {"success": True, "deleted_id": canonical_id, "permanent": True}



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

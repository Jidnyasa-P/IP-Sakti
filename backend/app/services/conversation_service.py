"""
Conversation / session management (Section 7).

Follow-up queries within the same conversation_id may use prior context
(handled by the caller passing recent messages into the reasoning step), but
context is scoped strictly to that conversation_id — a different
conversation's history is never mixed in.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.conversation import Conversation, ChatMessage


def get_or_create_conversation(db: Session, conversation_id: str | None, title_hint: str, language: str) -> Conversation:
    if conversation_id:
        conv = db.get(Conversation, conversation_id)
        if conv:
            return conv
    new_id = conversation_id or f"conv-{uuid.uuid4().hex[:12]}"
    conv = Conversation(
        id=new_id,
        user_id="user-default",
        title=(title_hint[:48] + "...") if len(title_hint) > 50 else title_hint,
        language=language,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def recent_messages(db: Session, conversation_id: str, limit: int = 6) -> list[ChatMessage]:
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
        .all()[::-1]
    )


def add_message(db: Session, **kwargs) -> ChatMessage:
    msg = ChatMessage(id=f"msg-{uuid.uuid4().hex[:12]}", **kwargs)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def touch_conversation(db: Session, conversation: Conversation) -> None:
    conversation.updated_at = datetime.now(timezone.utc)
    db.commit()


def conversation_to_dict(conv: Conversation, messages: list[ChatMessage]) -> dict:
    return {
        "id": conv.id,
        "user_id": conv.user_id,
        "title": conv.title,
        "language": conv.language,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
        "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
        "messages": [message_to_dict(m) for m in messages],
    }


def message_to_dict(m: ChatMessage) -> dict:
    return {
        "id": m.id,
        "conversation_id": m.conversation_id,
        "role": m.role,
        "content": m.content,
        "answer": m.answer,
        "relevant_considerations": m.relevant_considerations or [],
        "recommended_next_steps": m.recommended_next_steps or [],
        "citations": m.citations or [],
        "confidence": m.confidence,
        "warnings": m.warnings or [],
        "classification": m.classification,
        "jurisdiction": m.jurisdiction,
        "expert_escalation": m.expert_escalation,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "feedback": m.feedback,
        "feedback_notes": m.feedback_notes,
        "language": m.language,
    }

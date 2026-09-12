from sqlalchemy import Column, String, DateTime, JSON, ForeignKey
from datetime import datetime, timezone
from app.database.session import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True)
    user_id = Column(String, default="user-default")
    title = Column(String, default="New Research Session")
    language = Column(String, default="en")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True)
    conversation_id = Column(String, ForeignKey("conversations.id"))
    role = Column(String)  # user | assistant
    content = Column(String)
    answer = Column(String, nullable=True)
    relevant_considerations = Column(JSON, default=list)
    recommended_next_steps = Column(JSON, default=list)
    citations = Column(JSON, default=list)
    confidence = Column(JSON, nullable=True)
    warnings = Column(JSON, default=list)
    classification = Column(JSON, nullable=True)
    jurisdiction = Column(JSON, nullable=True)
    expert_escalation = Column(JSON, nullable=True)
    feedback = Column(String, nullable=True)
    feedback_notes = Column(String, nullable=True)
    language = Column(String, default="en")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

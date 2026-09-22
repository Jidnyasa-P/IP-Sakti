from typing import Optional, Any
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    language: str = "en"
    semantic_weight: float = 0.65
    keyword_weight: float = 0.35
    query: Optional[str] = None
    message: Optional[str] = None  # legacy alias used by some frontend paths
    # Jurisdiction / market context: "india" | "international". FIXED --
    # the frontend (ChatView.tsx) actually sends this request body key as
    # `jurisdiction`, not `target_market`; `target_market` had no matching
    # field here at all, so Pydantic silently dropped it on every request
    # and the India/International toggle had zero effect on the backend.
    # Both fields are kept (some other callers may still use
    # target_market) -- see resolved_jurisdiction() below for which wins.
    jurisdiction: Optional[str] = None
    target_market: Optional[str] = None

    def resolved_query(self) -> str:
        return (self.query or self.message or "").strip()

    def resolved_jurisdiction(self) -> Optional[str]:
        return self.jurisdiction or self.target_market


class QueryRequest(BaseModel):
    query: str
    conversation_id: Optional[str] = None
    language: str = "en"
    target_market: Optional[str] = None


class ClassifyRequest(BaseModel):
    text: str


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5


class ValidateRequest(BaseModel):
    claim: str
    chunk_id: str


class FeedbackRequest(BaseModel):
    message_id: str
    feedback: str  # helpful | unhelpful
    notes: Optional[str] = None


class NewConversationRequest(BaseModel):
    title: Optional[str] = None
    language: str = "en"


class RenameConversationRequest(BaseModel):
    title: str


class SaveResearchRequest(BaseModel):
    document_id: str
    title: str
    notes: Optional[str] = ""


class TranslateRequest(BaseModel):
    target_language: str
    strings: Optional[dict[str, str]] = None
    text: Optional[str] = None


class ExpertEscalationRequest(BaseModel):
    conversation_id: Optional[str] = None
    query: str
    reason: Optional[str] = None

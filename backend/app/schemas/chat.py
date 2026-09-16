from typing import Optional, Any
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    language: str = "en"
    semantic_weight: float = 0.65
    keyword_weight: float = 0.35
    query: Optional[str] = None
    message: Optional[str] = None  # legacy alias used by some frontend paths
    # Jurisdiction / market context (Section 8). Optional and additive: lets
    # the chat request carry the India/International (or Domestic (India) /
    # Export / Both) distinction directly, now that this is no longer tied
    # to a navbar-level toggle. Same field name/vocabulary already used by
    # QueryRequest.target_market and ProductInformation.target_market —
    # intentionally not introducing a second "jurisdiction" field alongside
    # it. See app/services/jurisdiction_service.py for accepted values.
    target_market: Optional[str] = None

    def resolved_query(self) -> str:
        return (self.query or self.message or "").strip()


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

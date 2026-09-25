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
    # Extracted text/visual context from a user attachment. The raw file is
    # processed transiently and is not persisted as a conversation message.
    attachment_context: Optional[str] = None
    attachment_name: Optional[str] = None

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
    # Which kind of expert the user picked from the low-confidence redirect
    # options (e.g. "ayurveda", "legal", "ip_patent"). Optional/free-form so
    # the frontend's list of expert categories can change without a schema
    # change here.
    expert_type: Optional[str] = None



class GrievanceCreateRequest(BaseModel):
    category: str = Field(..., min_length=1, max_length=80)
    subject: str = Field(..., min_length=1, max_length=160)
    description: str = Field(..., min_length=1, max_length=5000)
    conversation_id: Optional[str] = None
    message_id: Optional[str] = None
    related_query: Optional[str] = None


class ContactRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: str = Field(..., min_length=3, max_length=254)
    subject: str = Field(..., min_length=1, max_length=160)
    message: str = Field(..., min_length=1, max_length=5000)

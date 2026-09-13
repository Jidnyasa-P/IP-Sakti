"""
Builds the evidence context from retrieved chunks, calls the LLM (or offline
fallback), and returns a structured {answer, relevant_considerations,
recommended_next_steps} dict — never raw/untrusted LLM text without a defined
shape.
"""
from __future__ import annotations

from app.generation.llm_client import LLMClient, offline_grounded_synthesis
from app.generation.prompts import build_prompt
from app.schemas import DocumentChunk

_llm_client: LLMClient | None = None


def get_llm_client() -> LLMClient:
    global _llm_client
    if _llm_client is None:
        _llm_client = LLMClient()
    return _llm_client


def generate_grounded_answer(query: str, language: str, chunks: list[DocumentChunk]) -> dict:
    evidence_context = "\n\n".join(
        f"[{i + 1}] Title: {c.title}\nAuthority: {c.authority}\nSection: {c.section}\nText: {c.chunk_text}"
        for i, c in enumerate(chunks)
    )

    client = get_llm_client()
    result = client.generate_json(build_prompt(query, language, evidence_context)) if client.available else {}

    if not result or "answer" not in result:
        result = offline_grounded_synthesis(query, language, chunks)

    result.setdefault("relevant_considerations", [])
    result.setdefault("recommended_next_steps", [])
    return result

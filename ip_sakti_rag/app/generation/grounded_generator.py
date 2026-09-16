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


def generate_grounded_answer(query: str, language: str, chunks: list[DocumentChunk], graph_context: dict | None = None) -> dict:
    evidence_context = "\n\n".join(
        f"[{i + 1}] Title: {c.title}\nAuthority: {c.authority}\nSection: {c.section}\nText: {c.chunk_text}"
        for i, c in enumerate(chunks)
    )

    if graph_context:
        evidence_context += "\n\n[GRAPH CONTEXT]\n" + _format_graph_context(graph_context)

    client = get_llm_client()
    result = client.generate_json(build_prompt(query, language, evidence_context)) if client.available else {}

    if not result or "answer" not in result:
        result = offline_grounded_synthesis(query, language, chunks)

    result.setdefault("relevant_considerations", [])
    result.setdefault("recommended_next_steps", [])
    return result


def _format_graph_context(context: dict) -> str:
    lines = []
    for key in ("related_regulations", "related_authorities", "notes"):
        values = context.get(key) or []
        if values:
            lines.append(f"{key}: " + "; ".join(str(v) for v in values))
    return "\n".join(lines) or "No graph relationships found."

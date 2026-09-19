"""
Pluggable LLM client.

If LLM_API_KEY is set and valid, calls Google's Gemini API. If not set (or
the call fails/times out), falls back to a fully offline, deterministic,
evidence-templated answer -- mirroring the "resilience engine" already
designed into the existing prototype, so the whole system still works with
zero API keys and zero cost for a demo.

FIXED: this file was calling `genai.configure(...)` and
`genai.GenerativeModel(...)` -- that's the OLD, deprecated
`google-generativeai` SDK's API shape. But `from google import genai`
actually imports the NEW, unified `google-genai` package (the one pinned in
requirements-server.txt, and the same one app/embeddings.py already uses
correctly) -- and that package's `genai` module has neither `.configure()`
nor `.GenerativeModel`. Every real Gemini call was throwing an
AttributeError, silently caught by the `except Exception` below, which set
`self.available = False` and made every single request fall through to
`offline_grounded_synthesis` -- regardless of whether LLM_API_KEY was
valid. That's why every answer looked like a raw, unstructured dump of
retrieved chunk text with "no live LLM reasoning was applied" tacked on:
that message is `offline_grounded_synthesis`'s own fallback text, and it
was running on every single query, not just when the key was actually
missing.

Swap in another provider (Groq, local Ollama, etc.) by adding another
branch here -- nothing else in the pipeline needs to change.
"""
from __future__ import annotations

import json
import re

from app.config import settings
from app.schemas import DocumentChunk


def _is_key_valid(key: str | None) -> bool:
    if not key:
        return False
    key = key.strip()
    return bool(key) and not key.upper().startswith("YOUR_")


class LLMClient:
    def __init__(self):
        self.available = _is_key_valid(settings.LLM_API_KEY)
        self._client = None
        if self.available:
            try:
                from google import genai  # unified SDK -- see module docstring

                self._client = genai.Client(api_key=settings.LLM_API_KEY)
            except Exception as exc:  # pragma: no cover - optional dependency path
                print(f"[llm_client] Gemini client init failed, using offline fallback: {exc}")
                self.available = False

    def generate_json(self, prompt: str, timeout_s: float = 12.0) -> dict:
        if self.available and self._client is not None:
            try:
                from google.genai import types  # unified SDK -- see module docstring

                response = self._client.models.generate_content(
                    model=settings.LLM_MODEL,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                    ),
                )
                return _safe_parse_json(response.text)
            except Exception as exc:
                print(f"[llm_client] Gemini call failed, falling back offline: {exc}")
        return {}  # signal to caller: use offline synthesis


def _safe_parse_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {}


def offline_grounded_synthesis(query: str, language: str, chunks: list[DocumentChunk]) -> dict:
    """
    Deterministic fallback: builds a templated, citation-grounded answer
    directly from retrieved chunk text, with no LLM call at all. Used when no
    LLM key is configured, or the LLM call genuinely fails -- the platform
    must never go fully silent just because a paid/rate-limited API is
    unavailable. Now that LLMClient actually works, this should be rare.
    """
    if not chunks:
        return {
            "answer": (
                "I could not find sufficient indexed authoritative evidence to answer this "
                "query with confidence. Please rephrase with more specific terms (e.g. the "
                "relevant Act/Section, product type, or jurisdiction), or consult a "
                "registered patent agent / regulatory affairs specialist."
            ),
            "relevant_considerations": [
                "No matching statutory or regulatory provisions were retrieved from the indexed knowledge base."
            ],
            "recommended_next_steps": [
                "Refine the query with more specific legal/regulatory terms.",
                "Escalate to a human expert for a definitive answer.",
            ],
        }

    lines = [f"Based on the indexed authoritative sources most relevant to your query:"]
    for i, c in enumerate(chunks, start=1):
        snippet = c.chunk_text.strip().replace("\n", " ")
        snippet = snippet[:320] + ("..." if len(snippet) > 320 else "")
        lines.append(f"[{i}] Under {c.title} ({c.authority}), {c.section}: {snippet}")

    answer = " ".join(lines)
    answer += (
        " These provisions are the closest statutory/regulatory match found in the indexed "
        "corpus; confirm applicability to your exact fact pattern with a qualified expert "
        "before relying on this for a filing or compliance decision."
    )

    return {
        "answer": answer,
        "relevant_considerations": [
            f"Evidence drawn from {len(chunks)} indexed source(s); no live LLM reasoning was applied — this is a direct evidence summary.",
            "Cross-check the cited section/authority against the latest official gazette text before acting.",
        ],
        "recommended_next_steps": [
            "Review the full text of the cited section(s) at the official source URL.",
            "Consult a registered patent agent, regulatory affairs specialist, or NBA/ABS advisor for a filing-ready opinion.",
        ],
    }

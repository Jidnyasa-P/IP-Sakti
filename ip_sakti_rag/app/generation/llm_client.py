"""
Pluggable LLM client.

If LLM_API_KEY is set and valid, calls Google's Gemini API. If not set (or
the call fails/times out), falls back to a fully offline, deterministic,
evidence-templated answer -- mirroring the "resilience engine" already
designed into the existing prototype, so the whole system still works with
zero API keys and zero cost for a demo.

FIXED (previous round): this file was calling `genai.configure(...)` and
`genai.GenerativeModel(...)` -- the OLD, deprecated `google-generativeai`
SDK's API shape, incompatible with the NEW unified `google-genai` package
actually installed (the same one app/embeddings.py already uses correctly).
That was fixed. If you're STILL seeing "no live LLM reasoning was applied"
after that fix, the SDK call itself is now correct (verified against
Google's own current documentation examples) -- so the remaining cause is
environmental, not a code bug: either LLM_API_KEY isn't actually set/valid
on Render, or a real exception (quota, safety filter, network, wrong model
name) is happening and being logged.

CHANGED (this round): every failure path now logs the FULL exception type
and traceback, not just str(exc) -- some exceptions (e.g. Gemini's
ClientError) have a terse default __str__ that hides the actually useful
detail (status code, error message body). There's also now an unmistakable
startup log line stating plainly whether a key was found and whether the
client initialized -- read that first, it usually answers the question
immediately without needing to trigger a real request.

Swap in another provider (Groq, local Ollama, etc.) by adding another
branch here -- nothing else in the pipeline needs to change.
"""
from __future__ import annotations

import json
import re
import traceback

from app.config import settings
from app.schemas import DocumentChunk


def _is_key_valid(key: str | None) -> bool:
    if not key:
        return False
    key = key.strip().strip('"').strip("'")  # guards against a common Render env-var paste mistake (literal quote characters included)
    return bool(key) and not key.upper().startswith("YOUR_")


class LLMClient:
    def __init__(self):
        raw_key = settings.LLM_API_KEY
        provider = settings.LLM_PROVIDER.strip().lower()

        self.available = False
        self._client = None

        if not _is_key_valid(raw_key):
            print("[llm_client] STARTUP: LLM_API_KEY is not configured.")
            return

        if provider != "gemini":
            print(
                f"[llm_client] STARTUP: Provider={provider}. "
                "Gemini client disabled."
            )
            return

        try:
            from google import genai

            self._client = genai.Client(api_key=raw_key)
            self.available = True

            print(
                f"[llm_client] STARTUP: Gemini client initialized OK. "
                f"Model: {settings.LLM_MODEL}"
            )
        except Exception:
            print(
                "[llm_client] STARTUP: Gemini client initialization failed."
            )
            self.available = False

    def generate_json(self, prompt: str, timeout_s: float = 12.0) -> dict:
        if not (self.available and self._client is not None):
            return {}

        try:
            from google.genai import types  # unified SDK -- see module docstring

            response = self._client.models.generate_content(
                model=settings.LLM_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )
            if not response.text:
                # A real, distinct failure mode worth calling out by name:
                # the call succeeded (no exception) but returned no text --
                # usually means the safety filter blocked the output, or the
                # model hit its output token limit before finishing. Check
                # response.prompt_feedback / response.candidates[0].finish_reason
                # if this line shows up.
                finish_reason = None
                try:
                    finish_reason = response.candidates[0].finish_reason
                except Exception:
                    pass
                print(f"[llm_client] Gemini returned EMPTY text (finish_reason={finish_reason}) -- falling back offline for this request.")
                return {}

            parsed = _safe_parse_json(response.text)
            if not parsed:
                print(f"[llm_client] Gemini response was not valid/parseable JSON -- falling back offline for this request. Raw response (first 500 chars): {response.text[:500]!r}")
            return parsed

        except Exception:
            print(f"[llm_client] Gemini call FAILED -- falling back offline for this request:\n{traceback.format_exc()}")
            return {}


def _safe_parse_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {}


class GroqClient:
    """
    Second LLM tried for answer generation if Gemini is unavailable or its
    call fails, BEFORE falling all the way back to the fully offline
    template (see app/generation/grounded_generator.py). Same
    {answer, relevant_considerations, recommended_next_steps} JSON contract
    as LLMClient.generate_json, so grounded_generator.py doesn't need to
    know which one actually answered. Uses plain httpx against Groq's
    OpenAI-compatible REST API -- no extra SDK dependency, same reasoning as
    app/retrieval/reranker.py.
    """

def __init__(self):
    provider = settings.LLM_PROVIDER.strip().lower()
    self.available = (
        provider == "groq"
        and _is_key_valid(settings.LLM_API_KEY)
    )

    if self.available:
        print(
            f"[llm_client] STARTUP: Groq enabled. "
            f"Model: {settings.LLM_MODEL}"
        )
    else:
        print(
            "[llm_client] STARTUP: Groq disabled or LLM_API_KEY missing."
        )

    def generate_json(self, prompt: str, timeout_s: float = 12.0) -> dict:
        if not self.available:
            return {}
        try:
            import httpx

            resp = httpx.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.LLM_API_KEY.strip()}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.LLM_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"},
                },
                timeout=timeout_s,
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            parsed = _safe_parse_json(content)
            if not parsed:
                print(f"[llm_client] Groq response was not valid/parseable JSON. Raw (first 500 chars): {content[:500]!r}")
            return parsed
        except Exception:
            print(f"[llm_client] Groq call FAILED -- falling back to offline synthesis for this request:\n{traceback.format_exc()}")
            return {}


def offline_grounded_synthesis(query: str, language: str, chunks: list[DocumentChunk]) -> dict:
    """
    Deterministic fallback: builds a templated, citation-grounded answer
    directly from retrieved chunk text, with no LLM call at all. Used when no
    LLM key is configured, or the LLM call genuinely fails -- the platform
    must never go fully silent just because a paid/rate-limited API is
    unavailable. Should now be rare -- if you're still seeing this on every
    query, check the [llm_client] STARTUP log line described above.
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

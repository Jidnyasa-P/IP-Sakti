"""
Semantic reranking of BM25+Qdrant candidates via Groq.

Why Groq instead of a second Gemini call: Gemini's free-tier daily quota is
already spent by answer generation (one call per chat message); adding a
second Gemini call per query for reranking would compete with generation
for that same quota and roughly double Gemini latency per request. Groq's
free tier is a separate quota entirely and is fast (LPU inference), so
reranking barely adds latency. Called via plain httpx against Groq's
OpenAI-compatible REST API -- no extra SDK dependency (avoids repeating the
"unreviewed heavy dependency" mistake that caused the earlier Render OOM
build failure; see requirements-server.txt's comments).

This is a genuine second opinion, not just rank fusion: given the query and
each candidate chunk's text, Groq scores relevance 0-100 per chunk directly
-- a continuous, semantically-grounded score, unlike Reciprocal Rank
Fusion's quantized "which retriever(s) ranked this #1" score (see hybrid.py
for why RRF alone made confidence look "stuck" at ~50%/~5%).

Degrades gracefully: if LLM_API_KEY isn't set, or the call fails/times
out/returns unparseable output, rerank() returns None and hybrid.py falls
back to its own weighted-normalized BM25+semantic score -- reranking is an
accuracy improvement on top of that, never a hard dependency.
"""
from __future__ import annotations

import json
import re

import httpx

from app.config import settings
from app.schemas import DocumentChunk

_TIMEOUT_S = 8.0
_MAX_CANDIDATES = 20  # keep the prompt small -- fast + cheap + within context comfortably
_SNIPPET_CHARS = 500


def _is_key_valid(key: str | None) -> bool:
    if not key:
        return False
    key = key.strip().strip('"').strip("'")
    return bool(key) and not key.upper().startswith("YOUR_")


def rerank(query: str, candidates: list[DocumentChunk]) -> dict[str, float] | None:
    """
    Returns {chunk_id: relevance_score_0_to_1} for as many of `candidates`
    as Groq scored, or None if reranking wasn't possible this call (no key,
    network/parse failure, empty candidate list). Never raises.
    """
    if (
    not candidates
    or settings.LLM_PROVIDER.strip().lower() != "groq"
    or not _is_key_valid(settings.LLM_API_KEY)
    ):
        return None

    subset = candidates[:_MAX_CANDIDATES]
    numbered = []
    for i, c in enumerate(subset, start=1):
        snippet = c.chunk_text.strip().replace("\n", " ")[:_SNIPPET_CHARS]
        numbered.append(f"{i}. [{c.chunk_id}] ({c.authority} — {c.section}) {snippet}")

    prompt = (
        "You are a legal-research relevance judge. Score how relevant each numbered "
        "passage below is to the user's query, on a 0-100 scale (100 = directly and "
        "specifically answers the query; 0 = completely unrelated).\n\n"
        f"Query: {query}\n\n"
        "Passages:\n" + "\n".join(numbered) + "\n\n"
        'Respond with ONLY a JSON object: {"scores": [{"id": "<chunk_id>", "score": <0-100>}, ...]} '
        "covering every passage listed above, and nothing else."
    )

    try:
        resp = httpx.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.LLM_API_KEY.strip()}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.LLM_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0,
                "response_format": {"type": "json_object"},
            },
            timeout=_TIMEOUT_S,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        parsed = _safe_parse_json(content)
        scores = parsed.get("scores") if isinstance(parsed, dict) else None
        if not isinstance(scores, list):
            print(f"[reranker] Groq response missing 'scores' array, skipping rerank this call. Raw: {content[:300]!r}")
            return None

        valid_ids = {c.chunk_id for c in subset}
        result: dict[str, float] = {}
        for item in scores:
            cid = item.get("id")
            raw_score = item.get("score")
            if cid in valid_ids and isinstance(raw_score, (int, float)):
                result[cid] = max(0.0, min(100.0, float(raw_score))) / 100.0

        if not result:
            print("[reranker] Groq returned no usable (id, score) pairs, skipping rerank this call.")
            return None
        return result

    except Exception as exc:
        print(f"[reranker] Groq rerank call failed, falling back to non-reranked scoring: {exc}")
        return None


def _safe_parse_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {}

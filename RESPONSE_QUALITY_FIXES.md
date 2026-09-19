# Response Quality Fixes: Generation, Confidence, Citations

Embeddings/fastembed/requirements are **untouched** — your working setup
stays exactly as-is, per your instruction. Only these 3 files changed.

## 1. Why every answer was an unstructured chunk dump ("no live LLM reasoning was applied")

Found it, and it's a real, concrete bug: `ip_sakti_rag/app/generation/llm_client.py`
was calling:
```python
genai.configure(api_key=settings.LLM_API_KEY)
self._client = genai.GenerativeModel(settings.LLM_MODEL)
```
That's the **old, deprecated** `google-generativeai` SDK's API shape. But
`from google import genai` actually imports the **new, unified** `google-genai`
package — the one already pinned in your `requirements-server.txt`, and the
same one `app/embeddings.py` already uses correctly elsewhere in this repo.
The new package's `genai` module has neither `.configure()` nor
`.GenerativeModel` — so every single call to the real Gemini API was
throwing an `AttributeError`, silently caught by a broad `except Exception`,
which set `self.available = False` and routed **every** request to
`offline_grounded_synthesis()` — a deterministic, no-LLM template that just
concatenates retrieved chunk text with `"no live LLM reasoning was applied"`
tacked on. That message you saw in the screenshot is that function's own
literal fallback text — it was running on every query, not just when a key
was missing.

**Fixed**: rewrote `LLMClient` to use the new SDK correctly —
`genai.Client(api_key=...)` and `client.models.generate_content(model=...,
contents=..., config=types.GenerateContentConfig(response_mime_type="application/json"))`
— matching the exact pattern `app/embeddings.py` already uses. This should
make the chatbot's "opinion" a real, coherent, LLM-synthesized answer
instead of raw evidence text, and confirms your responses are genuinely
dynamic (an actual model call per query) rather than templated — you should
be able to ask the same question two different ways and see different
phrasing now, which the old templated fallback could never produce.

**One thing to verify on your end**: this fix only works if `LLM_API_KEY`
is actually set correctly on Render for `ip-sakti-rag`. If it's missing or
invalid, you'll now see a *different*, more informative log line —
`[llm_client] Gemini client init failed...` or `[llm_client] Gemini call
failed...` with the real error — instead of the previous silent failure.
Check Render's logs for `ip-sakti-rag` after this deploys; if you see
either of those lines, that's your next thing to fix (usually just the env
var), and it'll now be visible instead of hidden.

## 2. Why the confidence score showed 5% on a genuinely good retrieval

Also a real, traceable bug, in `ip_sakti_rag/app/retrieval/hybrid.py`.
Reciprocal Rank Fusion (RRF) scores are inherently tiny — the maximum
possible score (a chunk ranked #1 by *both* the semantic and keyword
retrievers) is `2/(RRF_K+1) ≈ 0.033`. That raw, unnormalized score was being
passed straight through as `top_fused_score` into
`app/safety/confidence.py`'s `compute_confidence()`, which compares it
against `confidence_high_threshold = 0.45`, `moderate = 0.28`, `low = 0.15`
— thresholds written for a 0-to-1 scale. Since 0.033 can never clear even
the *low* threshold, **every single query landed in "Insufficient
evidence"** regardless of retrieval quality, and got floored at the
minimum displayed score of 5% (`max(0.05, adjusted_score)` in
confidence.py). That's exactly the 5% you saw on a query that pulled 5
clearly on-topic citations (Article 45, Section 52, Section 8, etc.) — the
retrieval was actually working fine; only the confidence *display* was
broken.

**Fixed**: normalized the RRF score to a real 0-1 scale (divided by the
theoretical maximum) right where it's computed, so it's now directly
comparable to the existing thresholds. I deliberately fixed it at the
source (`hybrid.py`) rather than changing the thresholds in
`confidence.py` or `config.py` — this way the existing threshold values
keep their original, sensible 0-1 semantics, and nothing else that reads a
chunk's `.score` needs to change.

## 3. Citation popup now shows the complete section, not a 400-character snippet

`CitationModal.tsx` was always rendering `citation.excerpt`, which is
deliberately truncated to 400 characters server-side — correct for the
small inline citation card in a chat response, but not for a modal whose
whole purpose is to let someone actually read the cited passage.

**Fixed**: the modal already fetches `/api/documents/{document_id}` for
the metadata section (unchanged), and that response already includes
**every chunk for that document with its full, untruncated `chunk_text`** —
so no new backend endpoint was needed. The modal now finds the specific
chunk matching `citation.chunk_id` in that already-fetched list and shows
its complete text, falling back to the short excerpt only while that
request is still loading (or in the rare case the chunk isn't found). Also
added a scrollable max-height on the passage box so a genuinely long
section doesn't blow out the modal's layout, and a small "Loading full
section text..." indicator so it's clear when you're seeing the excerpt
vs. the real thing.

The two verification links (View Source PDF + Official Government Source)
were already built in an earlier round and are untouched here — they
should already be working exactly as you described wanting, once
generation/confidence are fixed and you can actually see a full response.

## What I deliberately did NOT touch

- `app/embeddings.py`, `requirements.txt`, `requirements-server.txt` — your
  remote FastEmbed embedding-service architecture stays exactly as-is, as
  requested. Nothing here changes RAM usage, deployment config, or touches
  the already-completed ingestion.
- `app/config.py`'s confidence thresholds — kept the existing 0.45/0.28/0.15
  values; the fix was normalizing the score to match them, not changing
  the bar.
- Any Render environment variables or build/start commands.

## Checklist

- [ ] Confirm `LLM_API_KEY` is set and valid on `ip-sakti-rag`'s Render environment
- [ ] Deploy, ask a real question, confirm the answer reads as a coherent paragraph (not `[1] Under X (Y), Section Z: raw text... [2] Under...`)
- [ ] Confirm the same question phrased two different ways gives two differently-worded (not templated) answers
- [ ] Confirm confidence score is now a realistic percentage, not stuck at 5%
- [ ] Click a citation, confirm the modal shows the full section text (not cut off with "...")
- [ ] Confirm both "View Source PDF" and "Official Government Source" buttons work
- [ ] Watch Render logs once after deploy for any `[llm_client]` error lines

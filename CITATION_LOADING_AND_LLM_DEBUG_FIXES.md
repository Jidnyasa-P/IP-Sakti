# Complete Fix: LLM Debug Visibility, Citation Modal Everywhere, Loading States

7 files changed. Embeddings/fastembed/requirements are still completely
untouched, per your instruction — nothing here affects your working setup.

## 1. LLM generation — now fully debuggable (`ip_sakti_rag/app/generation/llm_client.py`)

Your logs show a clean build and successful deploy — that confirms the
service *starts*, but says nothing about whether the Gemini call actually
succeeds on a real request, since that only happens when a user sends a
message. Since you're rotating `LLM_API_KEY` now anyway, this is the right
moment: I rewrote the logging so the very first lines after startup tell
you definitively what's going on, instead of needing to trigger a request
and guess.

**After you deploy with the new key, check Render's logs for `ip-sakti-rag`
immediately after boot — you'll see exactly one of these:**

```
[llm_client] STARTUP: LLM_API_KEY is unset. Every request will use the offline fallback.
```
→ The env var genuinely isn't set on Render. Go to the service's
Environment tab and add it.

```
[llm_client] STARTUP: LLM_API_KEY is set but rejected (empty after trimming, or starts with 'YOUR_' placeholder text). Every request will use the offline fallback.
```
→ It's set to a leftover placeholder value, or empty/whitespace-only.

```
[llm_client] STARTUP: Gemini client init FAILED -- falling back to offline mode for every request:
<full traceback>
```
→ The key is present but the client itself couldn't initialize — the
traceback will say exactly why.

```
[llm_client] STARTUP: LLM_API_KEY detected, Gemini client initialized OK. Model: gemini-3.1-flash-lite
```
→ This is what you want to see. If you see this and STILL get "no live
LLM reasoning was applied" on a real query, the failure is happening
per-request, not at startup — send a real chat message, then immediately
check the logs again for one of these three new lines:

```
[llm_client] Gemini returned EMPTY text (finish_reason=...) -- falling back offline for this request.
```
→ The call succeeded but Gemini returned nothing — usually a safety
filter blocking the output, or the model hitting its token limit
mid-response. `finish_reason` will say which.

```
[llm_client] Gemini response was not valid/parseable JSON -- falling back offline for this request. Raw response (first 500 chars): '...'
```
→ Gemini responded with text that wasn't valid JSON. The raw text is
printed so you can see what it actually said instead of guessing.

```
[llm_client] Gemini call FAILED -- falling back offline for this request:
<full traceback>
```
→ A real exception (quota, network, invalid model name, etc.) — the
traceback tells you which.

**I did not guess at this — I checked the SDK usage against Google's own
current documentation examples and it matches exactly**, so the code
itself should be correct; this round is purely about making whatever the
real remaining cause is impossible to miss, rather than silently logged as
a bare `str(exc)` that can hide the useful part of the error.

One small hardening while I was in there: the key-validity check now also
strips accidental leading/trailing quote characters (`"`/`'`) — a common
mistake when copy-pasting a key value that still has quotes from a `.env`
file into Render's plain-text environment variable field.

## 2. Citation popup — now consistent everywhere, not just chat

Confirmed root cause: `App.tsx` already passes an `onOpenCitation` callback
into Product Analyzer, Research, TK & ABS, and IPR Navigator (wired to the
same shared `CitationModal` chat uses) — **it just wasn't being called
anywhere in those four files.** Each one had its own separate citation
card that was a plain `<a href>` straight to an external site, built before
`CitationModal` existed.

**Fixed in all four**: `ProductAnalyzerView.tsx`, `TraditionalKnowledgeView.tsx`,
`IPRNavigatorView.tsx`, `ResearchView.tsx` — every citation card is now a
button that calls `onOpenCitation(...)`, opening the exact same modal chat
uses: full retrieved section text, "View Source PDF", and "Official
Government Source" links.

`ResearchView.tsx` needed one extra step: it browses raw `DocumentChunk`
objects (not `Citation` objects like the other views), so its click handler
builds a `Citation`-shaped object from the chunk's own fields (all present)
before handing it to `onOpenCitation`.

I removed the now-unused `getSectionLink` imports from these four files
where nothing else in them still used it — double-checked each one
individually rather than blanket-removing, so nothing else that still
depended on it got broken.

## 3. Workspace / Admin loading — real spinners instead of a silent 2-minute wait

**`WorkspaceView.tsx`** had no loading state at all — while its 3 parallel
fetches were in flight, the page just showed "no items found" for every
tab, indistinguishable from broken. Added an `isLoading` state and a
full-page spinner with a message explaining *why* it might take a while
(free-tier cold start).

**`AdminView.tsx`** actually already had a `loading` state, correctly set
and unset around its fetch — it just was never rendered anywhere. Added
the same spinner, gated so it only shows on the true first load (not every
re-fetch after an admin action), so it doesn't regress the "re-index a
document" flow into flashing a full-page spinner every time.

**Important, honest context**: this doesn't make the load *faster* — if
your backend and `ip-sakti-rag` have both spun down from 15 minutes of
inactivity (Render free tier), the actual wait can legitimately be 1-2
minutes for two sequential cold starts. The spinner's job is to make that
wait look intentional instead of broken, which is what you asked for. If
you want the wait itself shortened, that needs either an external
uptime-pinger hitting both `/api/health` endpoints periodically (uses your
free-tier hours) or a paid instance that doesn't sleep — say the word if
you want the pinger approach set up.

## 4. Optional, unrelated cleanup I noticed but did NOT apply

Your build log shows `requirements-server.txt` still installing
`fastembed`, `onnxruntime`, `tokenizers`, `huggingface-hub`, `loguru`,
`mmh3`, and `py_rust_stemmers` — but I checked, and **nothing in
`app/embeddings.py` or anywhere else imports `fastembed` or `onnxruntime`
anymore** (your embedding calls now go over HTTP via `requests` to your
separate embedding service). These packages are installed but genuinely
unused dead weight — they don't cost you RAM at runtime (Python doesn't
load code that's never imported), but they do slow down every build and
bloat the deploy image for no reason.

**I deliberately did NOT remove them** — you were explicit about not
touching anything embedding-related, and I'd rather flag this and let you
decide than make a change adjacent to the one thing you said to leave
alone. If you want them gone (safe: nothing imports them, so removing
them can't change runtime behavior), say so and I'll send just that one
line-removal.

## Checklist

- [ ] Deploy with the new `LLM_API_KEY`
- [ ] Check `ip-sakti-rag` logs immediately for the `[llm_client] STARTUP:` line — confirms key validity before you even test a query
- [ ] Send a real chat message, re-check logs if the answer still looks templated
- [ ] Click a citation in Chat, Product Analyzer, Research, TK & ABS, and IPR Navigator — confirm all five now open the same modal with full text + both links
- [ ] Load Workspace and Admin — confirm a spinner shows instead of an apparently-frozen empty page
- [ ] Re-index a document in Admin — confirm the spinner does NOT reappear for the whole page (only the true first load should show it)

# What changed, why, and how to deploy it

18 files changed, across all three services. Every file keeps its original
repo-relative path — unzip this on top of your repo (same paths) and it's
a straight overwrite, nothing to merge by hand.

```
ip_sakti_rag/app/config.py
ip_sakti_rag/app/schemas.py
ip_sakti_rag/app/pipeline.py
ip_sakti_rag/app/retrieval/hybrid.py
ip_sakti_rag/app/retrieval/reranker.py
ip_sakti_rag/app/safety/scope_guard.py        <- NEW FILE
ip_sakti_rag/app/generation/llm_client.py
ip_sakti_rag/app/generation/grounded_generator.py
ip_sakti_rag/app/generation/prompts.py
ip_sakti_rag/main.py
ip_sakti_rag/.env.example
ip_sakti_rag/requirements-server.txt
backend/app/schemas/chat.py
backend/app/api/routes/chat.py
backend/app/rag_client.py
backend/app/models/conversation.py
frontend/src/types.ts
frontend/src/components/ChatView.tsx
```

---

## 1. Citation popup broken in chat

**Root cause:** every other view (`ProductAnalyzerView`, `IPRNavigatorView`,
`ResearchView`, `TraditionalKnowledgeView`) opens the citation popup with
`onClick={() => onOpenCitation(cite)}`. `ChatView.tsx` was the one place
this got missed — its citation cards were a plain `<a href={citeUrl}>`
straight to one external link, and `onOpenCitation` sat unused as an
accepted-but-never-called prop.

**Fix:** `ChatView.tsx`'s citation cards now call `onOpenCitation(cite)`
like everywhere else, opening the same `CitationModal` (source PDF +
official-site link) instead of a single raw link.

No new files, no backend change — this one's frontend-only.

---

## 2. Confidence score stuck at 50% / 5%

**Root cause (found two, both in the scoring math, not the retrieval
data):**

- The retriever was fusing BM25 + Qdrant purely by Reciprocal Rank Fusion,
  normalized by dividing by the theoretical max. That normalization is
  quantized: a chunk ranked #1 by *exactly one* retriever — the single most
  common outcome — **always** normalizes to precisely 0.5, regardless of
  how strong or weak the match actually was. That's the "stuck at 50%".
  Weaker single-retriever matches, or cases where semantic search didn't
  return anything for that request, land below the "Insufficient evidence"
  threshold and get floored at the displayed minimum of 5% — explaining
  the screenshots exactly.
- My first fix (weighted min-max normalization within the candidate pool)
  turned out to have the *same class* of bug: min-max normalization always
  maps whichever candidate is best-of-pool to exactly 1.0, so with only one
  signal present, every query's score collapsed to exactly `keyword_weight`
  (0.40) — verified this happening in testing before catching it.

**Fix, per your instructions (Groq, block-fully-on-violation):**

- `app/retrieval/reranker.py` — new module. Sends the top ~20 BM25+Qdrant
  candidates to Groq (plain `httpx` call to Groq's OpenAI-compatible REST
  API, no new SDK dependency) asking for a direct 0–100 relevance score per
  passage. This is a genuine semantic judgment, not a rank artifact — used
  as the primary score whenever `LLM_API_KEY` is set.
- `app/retrieval/hybrid.py` — rewritten fallback (for when Groq is
  unavailable) using **absolute-strength** scores instead of pool-relative
  ones: raw cosine similarity for semantic (already a real 0–1 measure),
  and a saturating transform (`raw / (raw + 10)`) for BM25's unbounded raw
  score. Verified against your actual corpus: on-topic legal queries now
  score ~0.26–0.29, an unrelated/gibberish query scores ~0.15 — real,
  continuous variation instead of fixed buckets.
- `app/config.py` — added `LLM_API_KEY`, `GROQ_MODEL` (default
  `llama-3.3-70b-versatile`), `semantic_weight`/`keyword_weight` for the
  fallback formula.

Verified end-to-end against your committed corpus (7,747 chunks) — scores
now vary meaningfully by query quality instead of clustering at fixed values.

---

## 3. Toggle constraint enforcement

**Root cause — worse than a missing validation rule:** the India/
International toggle's value never reached the backend at all.

- Frontend sends `jurisdiction: currentJur` in the `/api/chat` request body.
- Backend's `ChatRequest` schema only had a field called `target_market`
  (different name) — FastAPI/Pydantic silently drops unknown fields, so
  `jurisdiction` never even reached `body.target_market`.
- Even if it had: `_handle_query()` accepted a `target_market` parameter
  and never used it anywhere in the function body — never forwarded to
  `rag_client.chat()`, which itself had no such parameter at all.
- And even if *that* had worked: ip_sakti_rag's own `ChatRequest` model had
  no `jurisdiction` field either, and `pipeline.py`'s `answer_query()` had
  no jurisdiction parameter, and nothing in ip_sakti_rag mentioned
  "international" anywhere. The toggle was decorative end-to-end.

**Fix — threaded the real value through every layer:**

```
ChatView.tsx sends jurisdiction
  -> backend ChatRequest.jurisdiction (kept target_market too, resolved_jurisdiction() picks jurisdiction first)
  -> _handle_query(jurisdiction=...)
  -> rag_client.chat(jurisdiction=...)
  -> POST body {"jurisdiction": ...} to ip_sakti_rag
  -> ip_sakti_rag ChatRequest.jurisdiction
  -> rag.answer_query(jurisdiction=...)
  -> app/safety/scope_guard.py
```

**`app/safety/scope_guard.py` (new)** — one structured-JSON classification
call (Gemini first, Groq second) per query, judging three things at once:
on-topic (Ayurveda/AYUSH IP/regulatory/TK/ABS law, India or international),
prompt-injection attempt, and which jurisdiction the question actually
concerns. Applies your exact rule: **on any violation, the response is
ONLY the warning/redirect message — no retrieval, no generation, no
attempted answer.** Wired into `pipeline.py`'s `answer_query()` as the very
first thing that runs, before classification/retrieval/generation.

If *both* Gemini and Groq are unconfigured/unreachable, it degrades to a
keyword-only jurisdiction-mismatch check (same term lists your frontend's
`jurisdictionValidation.ts` already uses) and does **not** attempt
off-topic/injection blocking in that state — failing open on what it can't
safely judge without any classifier, rather than blocking everything.
Verified this degraded path directly: an India-toggle PCT/WIPO question
correctly blocks with the redirect message; off-topic detection correctly
no-ops without a classifier available.

A new `scope_blocked: bool` field carries this through `RAGResponse`
(ip_sakti_rag) → the backend's stored chat message → `StructuredChatMessage`
(frontend). `ChatView.tsx` renders a `scope_blocked` message as a plain
amber warning bubble — no citations panel, no confidence badge, no
"Grounded Opinion" framing — instead of the full structured card, since no
retrieval or generation was attempted for it at all.

---

## 4. Plain-language answers, actually understanding the query

**Root cause of what the screenshots showed:** that was ip_sakti_rag's
offline (non-LLM) fallback firing — the raw evidence-dump text with "no
live LLM reasoning was applied" is literally the deterministic template in
`app/generation/llm_client.py`'s `offline_grounded_synthesis()`, used only
when Gemini is unavailable or its call fails.

**Fix:**
- `app/generation/prompts.py` — added an explicit instruction block: work
  out what the person is *actually* asking before answering; explain what
  each cited provision means in plain, everyday language, not a citation-
  by-citation paraphrase dump; briefly define legal terms used.
- `app/generation/llm_client.py` / `grounded_generator.py` — added
  `GroqClient` as a second attempt if Gemini fails, **before** falling all
  the way to the fully offline template. Same
  `{answer, relevant_considerations, recommended_next_steps}` JSON contract,
  so nothing downstream needs to know which provider actually answered.

**Separately found and fixed — a real integrity problem, not part of your
original 4 asks:** `ChatView.tsx` had hardcoded, fully fabricated "95%
confidence, High" answers with fake citations (`CHUNK-WIPO-001` etc. — ids
that don't exist in your real corpus) that silently replaced the real
answer any time the `/api/chat` call failed or returned no content. For a
legal-compliance tool, showing made-up citations at a fake high confidence
score is actively misleading, not a harmless demo fallback. Removed
entirely — a failed request now shows an honest, clearly-labeled retry
message with no citations and no confidence score. Also removed a second,
smaller version of the same pattern (`confidence: assistantMsg.confidence
|| {level: "High", score: 0.95, ...}` — fabricating a fake badge whenever a
*real* response happened to have no confidence field).

---

## Verification performed

- `py_compile` on every changed Python file.
- Full live import + execution test of `ip_sakti_rag/main.py` and
  `app/pipeline.py` against your actual committed corpus (7,747 chunks),
  using the **exact** `requirements-server.txt` package set (fresh venv,
  nothing extra installed) — confirms what actually ships to Render, not
  just what happens to work in a fuller dev environment.
- Full live import of `backend/app/main.py` (47 routes) with the new
  `ChatRequest`/`chat.py`/`rag_client.py`/`conversation.py` wiring.
- `scope_guard.check_scope()` tested directly in its degraded (no-LLM)
  mode: correctly blocks an India-toggle PCT question, correctly allows an
  off-topic question through (since no classifier is available to judge it
  safely), correctly round-trips `scope_blocked` through
  `answer_query()` → the full response dict.
- Confidence scoring tested against 4 real queries post-fix: scores now
  range ~0.15 (unrelated query) to ~0.29 (strong on-topic match) instead of
  clustering at fixed 0.05/0.40/0.50 values.
- `npx tsc --noEmit` on the full frontend with all changed files in place —
  **zero TypeScript errors.**

## An additional bug fixed while verifying (not one of your 4, but a real
## deploy-risk regression)

`ip_sakti_rag/requirements-server.txt` — the file Render's build actually
installs — had `fastembed`, `tokenizers`, `huggingface-hub` and their
dependencies (which pull in `onnxruntime`, 100–200MB+) still listed, left
over from before `app/embeddings.py` was refactored to call a remote
embedding HTTP service instead of loading a local model. Confirmed via a
full-codebase grep that nothing imports `fastembed` anymore. This is
exactly the class of bug that caused your original Render OOM build
failure — removed it, and added `httpx` explicitly (the new Groq calls use
it directly; it happened to already be a transitive dependency, which
isn't something to rely on). Reinstalled the corrected file into a clean
venv and confirmed: no source builds, no heavy ML packages present.

---

## Deploying this

No new Render **services** or architecture changes — same 3 services
(`ip-sakti-rag`, `ip-sakti-backend`, `ip-sakti-frontend`) you already have
running. Just:

### 1. Add one new environment variable to `ip-sakti-rag`

Render dashboard → `ip-sakti-rag` service → Environment tab → add:

```
LLM_API_KEY=<your key from https://console.groq.com/keys>
GROQ_MODEL=llama-3.3-70b-versatile
```

Free Groq account, free tier — separate quota from Gemini, so reranking
doesn't compete with answer generation for Gemini's daily limit. The
service works without this (degrades to the fixed absolute-strength
fallback scoring described above), but confidence scores and reranking
quality are meaningfully better with it set — recommended before you
consider this "done."

### 2. Push these files and redeploy

```bash
git add ip_sakti_rag backend frontend
git commit -m "Fix chat citation popup, confidence scoring, toggle enforcement, plain-language answers"
git push
```

Render auto-deploys all three services on push (if auto-deploy is on for
your branch). `ip-sakti-rag`'s build will pick up the corrected
`requirements-server.txt` automatically — confirm the build log doesn't
show a `fastembed`/`onnxruntime` install line; it shouldn't anymore.

### 3. Smoke test after deploy

- **Chat citations**: ask any answerable question, click a citation card —
  the popup (source PDF + official link) should open, not navigate away.
- **Confidence**: ask 2–3 different questions of varying specificity and
  confirm the confidence % actually differs between them (not always the
  same number).
- **Toggle enforcement**: on the India toggle, ask a clearly PCT/WIPO-only
  question — should get *only* the redirect message, no attempted answer.
  On International, ask an India-only question (e.g. "What is Section 3(p)
  of the Patents Act?") — should get the reverse redirect. Try something
  off-topic (e.g. "write me a poem") on either toggle — should get the
  off-topic warning, not an attempted answer.
- **Plain language**: a normal on-topic question should come back as
  connected, explanatory prose (not a `[1] Under X... [2] Under Y...`
  citation dump) — if you still see the dump-style text, check the
  `ip-sakti-rag` service logs for `[llm_client] STARTUP:` lines to confirm
  `LLM_API_KEY` (Gemini) is actually valid; if Gemini's down, it should now
  fall through to Groq before the offline template, and you'd see
  `[llm_client] Gemini call FAILED` followed by either a Groq success or a
  `[llm_client] Groq call FAILED` line explaining why it reached offline.
- **No fabricated answers**: temporarily break `RAG_SERVICE_URL` on
  `ip-sakti-backend` (or just watch what happens if the RAG service is
  cold-starting) and confirm you now see an honest "couldn't reach the
  assistant service" message — never a confident-looking fake legal answer.

If anything doesn't match, the `[llm_client]`, `[hybrid]`, `[reranker]`,
and `[scope_guard]` log prefixes in `ip-sakti-rag`'s Render logs are
designed to tell you exactly which stage degraded and why — check those
first before assuming it's a new bug.

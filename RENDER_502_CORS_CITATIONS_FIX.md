# Render 502 / CORS / Citation Fixes — Detailed Instructions

Three separate bugs, three separate fixes. Apply all three.

## Bug 1: CORS error on `/api/conversations`

**Cause**: `backend/app/core/config.py`'s `frontend_origin` defaults to
`http://localhost:3000`. If the `FRONTEND_ORIGIN` environment variable isn't
set on the `ip-sakti-backend` Render service, your real deployed frontend
(`https://ip-sakti-frontend.onrender.com`) is never in the allowed-origins
list, so the browser blocks every response.

**Fix**:
1. Render dashboard -> `ip-sakti-backend` service -> Environment tab.
2. Add or correct: `FRONTEND_ORIGIN=https://ip-sakti-frontend.onrender.com`
   -- exact match, `https://`, no trailing slash. Copy-paste it from your
   browser's address bar rather than retyping, to rule out a typo.
3. Save -> this triggers a redeploy. Wait for it to finish.

**Also included, as a safety net, not a substitute for the step above**: I
patched `backend/app/main.py`'s error handler to attach CORS headers
manually even on a 500 response. This exists because of a separate, real
FastAPI/Starlette quirk: an exception caught by a custom
`@app.exception_handler` can sometimes produce a response that skips
`CORSMiddleware` entirely, which makes the browser report "blocked by CORS
policy" for what's actually an unrelated server error underneath -- i.e.
you can get a CORS-looking symptom even after steps 1-3 are done correctly,
if something else throws a 500. This patch makes sure that case still
surfaces as a clean, CORS-safe JSON error the frontend can actually display,
instead of a browser-level CORS error that hides the real cause.

## Bug 2: 502 on `/api/chat` and `/api/products/analyze`

**What the error actually means**: `backend/app/rag_client.py`'s message
`"RAG service error (502) on /api/products/analyze"` is constructed
directly from `exc.response.status_code` -- meaning your **`ip-sakti-rag`
service itself returned a genuine 502**, not the backend. A 502 from
Render means the app process behind that service isn't responding at
all -- crashed, or killed.

**Most likely cause, given what changed recently**: the local `fastembed`
embedding model is only loaded on the *first* real embedding call
(`embed_query()`/`embed_texts()`), not at startup -- so the service passes
its health check and looks fine, then falls over the moment a real
`/api/chat` or `/api/products/analyze` request comes in and tries to load
the ~220MB model into an already-tight 512MB budget. This matches your
symptoms exactly: simple requests are fine, RAG-backed ones 502.

**How to confirm this before changing anything else** (please don't skip
this -- a wrong diagnosis wastes your time):
1. Render dashboard -> `ip-sakti-rag` service -> **Logs** tab.
2. Send one `/api/chat` request from the live site, then immediately watch
   the logs.
3. Look for one of these patterns:
   - **`[embed] Loading sentence-transformers/paraphrase-multilingual...`**
     followed by the process just stopping/restarting, or a line
     mentioning `Out of memory`, `OOM`, `Killed`, or exit code `137` --
     this confirms the RAM diagnosis.
   - **A Python traceback** (e.g. `RuntimeError: Qdrant collection ... has
     vector size 768, but the configured ... size is 384`) -- this is a
     *different* bug: your Qdrant Cloud cluster currently has **two
     collections** (per your screenshot: `ip_sakti_chunks` at 384-dim,
     7747 points -- the current one -- and a leftover `legal_corpus_chunks`
     at 768-dim, 4658 points, from an earlier Gemini-embedding attempt).
     If `QDRANT_COLLECTION` on Render is set to the wrong one, or unset in
     a way that resolves differently than you expect, the service crashes
     at *startup* every time, which also looks like a permanent 502.

**Fix if it's the dimension mismatch (check this first -- it's a one-line env var fix):**
1. Render dashboard -> `ip-sakti-rag` service -> Environment tab.
2. Confirm `QDRANT_COLLECTION=ip_sakti_chunks` exactly (this is the 384-dim
   one with your real, complete 7747-point ingest).
3. Once confirmed working, delete the orphaned collection so it can't
   cause confusion again:
   ```python
   from qdrant_client import QdrantClient
   client = QdrantClient(url="<your QDRANT_URL>", api_key="<your QDRANT_API_KEY>")
   client.delete_collection("legal_corpus_chunks")
   ```

**Fix if it's genuinely OOM:**
I've applied one concrete mitigation already (`app/embeddings.py`, included
in the zip): capped onnxruntime to a single thread
(`TextEmbedding(..., threads=1)`), which trims some memory overhead --
real, but modest; it will not turn a hard OOM into a working deploy on its
own. If the logs confirm OOM even after this:

- **Check Render's actual memory graph** for the service (Metrics tab) --
  confirm it's actually hitting ~512MB, not failing for an unrelated reason
  that happens to coincide.
- **Qdrant Cloud Inference is worth investigating as a real fix**: Qdrant
  Cloud (which you're already on) can generate embeddings *server-side*,
  inside their cluster, for several models that are free even on the free
  tier -- this would remove the embedding model from your Render service
  entirely, solving the RAM problem at the root instead of trimming around
  its edges. I have **not** implemented this, because I could not confirm
  from documentation whether a genuinely multilingual model (Hindi/Marathi,
  not just English) is among the free options -- this varies by cluster and
  is shown in **your** Qdrant Cloud Console -> your cluster -> **Inference**
  tab. Check that tab; if a multilingual model is listed there with a
  "Cost: Free" label, tell me which one and I'll wire it in -- it's a
  moderate rewrite of `app/embeddings.py` and `app/retrieval/vector_index.py`
  (using Qdrant's `models.Document` inference-aware upsert/query instead of
  computing vectors locally) but removes the RAM problem entirely rather
  than managing it.
- **As a last resort that stays free**: move `ip-sakti-rag` specifically to
  a host with more free RAM -- Oracle Cloud's Always-Free compute tier
  genuinely offers 1GB+ RAM free, permanently, unlike Render's 512MB. A
  bigger change (different deploy target for just one service), so only
  worth it if the above doesn't pan out.

## Bug 3: Citations linking to a random, unrelated court case

**Root cause, confirmed from your screenshot**: `frontend/src/utils/
sectionLinks.tsx` had a hardcoded lookup table mapping section numbers to
specific `indiankanoon.org/doc/<id>/` URLs. These IDs were wrong -- Section
3(p), 3(e), 3(d), and 3(b) all pointed to the *same* ID (already a red
flag: four different subsections can't share one exact citation), and that
ID resolves to "Tirupati vs Laxmanbhai," an unrelated 2010 Gujarat High
Court judgment with nothing to do with the Patents Act. IndianKanoon mostly
indexes case law, not clean per-section statute text, so this whole
approach -- guessing a specific document ID for a bare section reference --
was never reliable.

**Fix applied** (`frontend/src/utils/sectionLinks.tsx`, included): removed
every `indiankanoon.org` link. Replaced with:
- Two links I verified against a real, current search of
  **india code.nic.in** (the actual Government of India statute
  repository): the Patents Act, 1970 full-text PDF, and the Biological
  Diversity Act, 2002 handle page.
- Everywhere else (Trade Marks Act, AYUSH rules, etc.), a link to the
  correct regulating authority's **homepage** (ipindia.gov.in,
  ayush.gov.in, cdsco.gov.in, wipo.int) instead of a guessed deep link.
  Less convenient than a working direct link, but never confidently wrong.

**The better long-term fix, not done here**: your app already has a
`CitationModal` component (referenced in `App.tsx`) intended to show the
*actual* excerpt your RAG pipeline retrieved -- the real, verified text from
your own ingested corpus, with page/section/document metadata you already
trust. `sectionLinks.tsx`'s static registry is a plain-text regex matcher
with no access to that data; it only recognizes ~20 hardcoded sections and
can't say anything correct about a section it doesn't have an entry for.
Wiring citation clicks to open `CitationModal` with the real chunk instead
of linking off-site would be strictly more reliable and requires passing
the actual `Citation` objects down to wherever `renderTextWithSectionLinks`
is called -- a real but scoped follow-up if you want it.

## Checklist

- [ ] `FRONTEND_ORIGIN` set correctly on `ip-sakti-backend`, redeployed
- [ ] `backend/app/main.py` patch applied (defensive CORS on error responses)
- [ ] Render logs for `ip-sakti-rag` checked to confirm OOM vs. dimension mismatch
- [ ] `QDRANT_COLLECTION=ip_sakti_chunks` confirmed on `ip-sakti-rag`, orphaned `legal_corpus_chunks` collection deleted
- [ ] `app/embeddings.py` patch applied (`threads=1`)
- [ ] If still OOMing: checked your Qdrant Cloud Console's Inference tab for a free multilingual model, reported back what's listed
- [ ] `frontend/src/utils/sectionLinks.tsx` patch applied, frontend redeployed
- [ ] Re-tested Product Analyzer / TK & ABS end to end, citations click through to a real, correct source

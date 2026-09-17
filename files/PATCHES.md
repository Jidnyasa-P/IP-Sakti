# Frontend Fixes — Exact Patches

## Root cause (confirmed, not guessed)

Every protected backend route (`backend/app/api/deps.py::get_current_user`)
requires an `Authorization: Bearer <token>` header, with **no cookie
fallback**. The app already has a helper that attaches it —
`authFetch()` in `frontend/src/components/auth/authStorage.ts` — but most
views call plain `fetch()` instead. Result: every request to a protected
endpoint gets a `401 {"detail": "Not authenticated."}` JSON body.

None of the affected views check `res.ok` before using the response, so
that `401` body gets treated as if it were real data
(`setResult({ detail: "Not authenticated." })`), the view advances to its
results step, and rendering `result.product_information.product_name` (etc.)
on a shape that doesn't have that path throws `TypeError: Cannot read
properties of undefined`. With no error boundary anywhere in the app
(confirmed — grepped the whole `frontend/src` tree), React unmounts the
**entire page** on that uncaught error. That's the blank screen.

Fix has two parts, both included:
1. **Stop the error from happening**: use `authFetch` + check `res.ok` in
   every view that calls a protected endpoint (patches below).
2. **Contain any error that still happens**: `ErrorBoundary.tsx` (new file,
   provided separately) wraps the main view in `App.tsx` so a future bug
   shows a recoverable message instead of blanking the screen again.

Apply every patch below by hand — I don't have write access to your repo.

---

## 1. `frontend/src/App.tsx`

**Add the import** (with the other component imports):
```diff
 import { CitationModal } from './components/CitationModal';
+import { ErrorBoundary } from './components/ErrorBoundary';
 import { GuidedTour } from './components/GuidedTour';
```

**Wrap the main view** (in the `return (...)` of `AppContent`):
```diff
       {/* Main Viewport Container */}
       <div className="flex-1 w-full pb-20 lg:pb-0">
-        {renderCurrentView()}
+        <ErrorBoundary key={activeTab} onReset={() => setActiveTab('landing')}>
+          {renderCurrentView()}
+        </ErrorBoundary>
       </div>
```
(`key={activeTab}` remounts the boundary — and clears its error state —
whenever the user switches tabs, so a crash on one tab doesn't stay stuck
after they navigate away.)

---

## 2. `frontend/src/components/ProductAnalyzerView.tsx`

**Add the import:**
```diff
 import { getSectionLink } from '../utils/sectionLinks';
+import { authFetch } from './auth/authStorage';
```

**Add error state** (next to the existing `result` state):
```diff
   const [result, setResult] = useState<ProductAnalysisResult | null>(null);
+  const [error, setError] = useState<string | null>(null);
```

**Replace `handleAnalyze`:**
```diff
   const handleAnalyze = async () => {
     setLoading(true);
+    setError(null);
     try {
-      const res = await fetch('/api/products/analyze', {
+      const res = await authFetch('/api/products/analyze', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(formData)
       });
+      if (!res.ok) {
+        const errBody = await res.json().catch(() => ({}));
+        throw new Error(errBody.detail || `Analysis failed (HTTP ${res.status})`);
+      }
       const data: ProductAnalysisResult = await res.json();
       setResult(data);
       setStep(5);
-    } catch (e) {
+    } catch (e: any) {
       console.error('Analysis failed:', e);
+      setError(e?.message || 'Analysis failed. Please try again.');
     } finally {
       setLoading(false);
     }
   };
```

**Also fix `handleSaveToWorkspace`** (same file — needs auth too, currently
silently no-ops for a logged-in user):
```diff
-      await fetch('/api/workspace/save-research', {
+      await authFetch('/api/workspace/save-research', {
```

**Add an error banner to the JSX** — insert right after the title block
(after the `<p>...subtitle...</p></div>` that ends the "Title &
Description" section) and before the "Preset Quick Loader Buttons" comment:
```tsx
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
```
(`AlertTriangle` is already imported at the top of this file.)

---

## 3. `frontend/src/components/TraditionalKnowledgeView.tsx`

Same pattern. **Add the import:**
```diff
 import { getSectionLink } from '../utils/sectionLinks';
+import { authFetch } from './auth/authStorage';
```

**Add error state** next to `result`'s `useState`, then **replace
`handleAnalyze`:**
```diff
   const handleAnalyze = async () => {
     setLoading(true);
+    setError(null);
     try {
-      const res = await fetch('/api/abs/analyze', {
+      const res = await authFetch('/api/abs/analyze', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(formData),
       });
+      if (!res.ok) {
+        const errBody = await res.json().catch(() => ({}));
+        throw new Error(errBody.detail || `Analysis failed (HTTP ${res.status})`);
+      }
       const data: TKABSResult = await res.json();
       setResult(data);
-    } catch (e) {
+    } catch (e: any) {
       console.error('ABS research error:', e);
+      setError(e?.message || 'Analysis failed. Please try again.');
     } finally {
       setLoading(false);
     }
   };
```
Add the same error banner JSX as above, using `AlertCircle` (already
imported in this file) instead of `AlertTriangle`, placed right after the
"Title & Introduction" block.

---

## 4. `frontend/src/components/IPRNavigatorView.tsx`

**Add the import**, add `error` state, then **patch `handleEvaluate`:**
```diff
+import { authFetch } from './auth/authStorage';
...
-      const res = await fetch('/api/ipr/analyze', {
+      const res = await authFetch('/api/ipr/analyze', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(payload),
       });
 
+      if (!res.ok) {
+        const errBody = await res.json().catch(() => ({}));
+        throw new Error(errBody.detail || `Evaluation failed (HTTP ${res.status})`);
+      }
       const serverData: IPRNavigatorResult = await res.json();
       ...
-    } catch (e) {
+    } catch (e: any) {
       console.error('IPR analysis failed:', e);
+      setError(e?.message || 'Evaluation failed. Please try again.');
     } finally {
       setLoading(false);
     }
   };
```
Add an `error` state declaration and a banner using `AlertCircle` (already
imported here too), same placement pattern as above.

---

## 5. `frontend/src/components/WorkspaceView.tsx`

These already check `res.ok` defensively, so they don't crash the page —
but without auth, every call 401s silently and the workspace just always
looks empty (real bug, just a quieter one: "not actually using MongoDB"
from the user's perspective, even though it is).

**Add the import**, then swap every `fetch(` for `authFetch(`:
```diff
+import { authFetch } from './auth/authStorage';
...
-        fetch('/api/conversations').catch(() => null),
-        fetch('/api/products').catch(() => null),
-        fetch('/api/workspace/saved-research').catch(() => null),
+        authFetch('/api/conversations').catch(() => null),
+        authFetch('/api/products').catch(() => null),
+        authFetch('/api/workspace/saved-research').catch(() => null),
...
-      await fetch(`/api/workspace/saved-research/${id}`, { method: 'DELETE' });
+      await authFetch(`/api/workspace/saved-research/${id}`, { method: 'DELETE' });
```

---

## 6. `frontend/src/components/AdminView.tsx`

Same swap for the two GET calls:
```diff
+import { authFetch } from './auth/authStorage';
...
-        fetch('/api/admin/documents').catch(() => null),
-        fetch('/api/admin/telemetry').catch(() => null),
+        authFetch('/api/admin/documents').catch(() => null),
+        authFetch('/api/admin/telemetry').catch(() => null),
```

**Known gap, not fixed here**: `AdminView.tsx` also does `POST
/api/admin/documents` (add a document at runtime) and `POST
/api/admin/documents/{id}/index` (re-index one document). Both were
intentionally removed from the backend when it became a thin proxy to
`ip_sakti_rag` — `ip_sakti_rag` only ingests documents offline via
`python scripts/ingest.py` (see `ip_sakti_rag/README.md`). These two admin
actions will 404/405 until either (a) you disable them in the UI, or (b)
`ip_sakti_rag/main.py` grows a real `/api/ingest` endpoint that triggers
`run_ingestion()` server-side — say the word if you want that built.

---

## 7. `frontend/src/components/ChatView.tsx` — optional cleanup, not a bug

This one already works correctly: it tries `POST /api/chat/stream` first,
and — since that endpoint no longer exists on the backend (removed when
`ip_sakti_rag` was integrated, which only supports a single synchronous
response) — the `!response.ok` check throws, is caught, and it falls back
to `authFetch('/api/chat', ...)`, which works. So chat isn't broken, just
slightly slower than necessary (one guaranteed-failing network round trip
per message). If you want it cleaned up: delete the `/api/chat/stream`
attempt block entirely and call `/api/chat` directly, or add real SSE
streaming to `ip_sakti_rag/main.py` if you want the fallback to become the
happy path instead.

---

## 8. `frontend/src/components/VoiceInputButton.tsx` — missing backend endpoint

`POST /api/transcribe` does not exist anywhere in `backend/`. This isn't an
auth bug — the feature was never wired up server-side. Voice input will
currently always fail. Two options:
- **Quick**: catch the failure and show "Voice input isn't available yet"
  instead of a silent/confusing failure.
- **Real fix**: add a `/api/transcribe` route in `backend/` that forwards
  audio to Bhashini's ASR pipeline (same two-step config+inference pattern
  as `ip_sakti_rag/app/translation/bhashini_client.py`, just with
  `taskType: "asr"` instead of `"translation"`). Say the word and I'll
  write it — it's a similar amount of work to the NMT client already built.

---

## Verify the fix

1. Apply patches 1-6 above.
2. Log out (or clear localStorage) and try Product Analyzer / TK & ABS
   without logging in — you should now see a red error banner ("Analysis
   failed (HTTP 401)"), not a blank page.
3. Log in, retry — should return a real, cited result.
4. To confirm the ErrorBoundary itself works: temporarily throw an error
   inside any view's render and confirm you get the "Something went wrong"
   screen instead of a blank one, then remove the test throw.

# New backend features: OTP, notifications, security emails, certificates, chatbot uploads

Stack is unchanged: FastAPI + MongoDB (mongomock in demo mode). All new endpoints use the existing
`Authorization: Bearer <jwt>` auth. Errors keep the usual `{"detail": "..."}` shape and now also carry a stable
`"code"` (plus e.g. `retry_after`, `attempts_remaining`). Existing endpoints and response shapes are unchanged except
for the **additive** fields listed under "Changed existing endpoints".

## Changed existing endpoints (additive only)
| Endpoint | Change |
|---|---|
| `POST /api/auth/register` | Still returns `{token, user}`; adds `email_verification:{required, otp_sent, expires_in_seconds, resend_cooldown_seconds}`. Sends welcome + OTP emails, records the device. Rate-limited 10/hour/IP (429). |
| `POST /api/auth/login` | Same response. Records device, may send a security alert. Rate-limited 30/15 min per IP+email. If `REQUIRE_EMAIL_VERIFICATION=true` and unverified: 403 `email_not_verified`. |
| `GET /api/auth/me`, user objects | Extra field `email_verified` (bool). |
| `POST /api/chat`, `/api/query` | If the conversation has attachments, relevant excerpts are appended (delimited, labelled untrusted) to the query sent to the RAG service. `/api/chat` also returns `attachments_used`. No attachments => identical behaviour. |
| `DELETE /api/conversations/{id}` | Also deletes that conversation's attachments and stored files. |
| `PATCH /api/expert-escalations/{id}` | Notifies (bell + email) the user who asked. Optional gate `REQUIRE_VERIFIED_EXPERT_CERTIFICATE`. |

## 1. Email OTP verification
Email is only marked verified by a correct OTP. Codes: 6 digits (`OTP_LENGTH`), 10 min expiry, 5 attempts, single use,
stored as keyed HMAC (never plaintext), new code supersedes old, resend cooldown 60 s, max 5 sends/hour.

| Endpoint | Auth | Body | Success | Errors (`code`) |
|---|---|---|---|---|
| `POST /api/auth/verify-email` | none | `{email, otp}` | `{success, user}` | 400 `otp_invalid` (+`attempts_remaining`), `otp_expired`, `otp_used`, `otp_superseded`, `otp_not_found`; 429 `otp_locked`, `rate_limited`; 409 `already_verified`; 422 |
| `POST /api/auth/resend-otp` | none | `{email}` | `{message, expires_in_seconds, resend_cooldown_seconds}` (same for unknown/verified emails) | 429 `otp_resend_cooldown` (+`retry_after`), `otp_hourly_limit`, `rate_limited` |

## 2. Notifications (navbar bell)
| Endpoint | Auth | Notes |
|---|---|---|
| `GET /api/notifications?unread_only=&limit=20&skip=0` | user | `{items[], total, unread_count, limit, skip}`; item = `{id,type,title,message,data,severity,is_read,read_at,created_at}` |
| `GET /api/notifications/unread-count` | user | `{unread_count}` |
| `PATCH /api/notifications/{id}/read` | user | updated item; 404 if not yours/nonexistent |
| `POST /api/notifications/read-all` | user | `{success, marked_read}` |

Generated for: registration, email verified, new device / other-device sign-in, certificate submitted / status change
(and "awaiting review" for Admins), escalation status change. Internal API: `notification_service.notify(db, user_id, type, title, message, data=None, severity, send_email=True)`.

## 3. Security emails
Templates: registration, OTP, email-verified, new-device alert, other-device sign-in alert, generic notification
(`services/email_templates.py`). Policy per successful sign-in (max **one** email):
first-ever device = baseline, silent; unrecognised device => `new_device_alert`; recognised device while a *different*
device signed in within `CONCURRENT_SESSION_WINDOW_MINUTES` => `new_signin_alert` (at most once per
`SECURITY_ALERT_COOLDOWN_MINUTES` per device). Device key = HMAC of optional `X-Device-Id` header (recommended: frontend
stores a random id in localStorage and sends it), else of browser+OS+device class from User-Agent. Raw IPs are never
stored/logged: keyed hash + masked form (`203.0.113.x`) only.

| Endpoint | Auth | Notes |
|---|---|---|
| `GET /api/auth/devices` | user | `{devices:[{id,label,last_ip(masked),first_seen_at,last_seen_at,login_count,revoked}]}` |
| `DELETE /api/auth/devices/{id}` | user | forget a device (next sign-in alerts again). JWTs are stateless, so this does not end a live session. |

## 4. Expert certificates
Only Expert accounts with a **verified email** may submit. Nothing is auto-verified by local checks.
Statuses: `pending | verified | rejected | invalid | expired`. `verified` comes only from (a) a non-owner Admin review, or
(b) an external provider that confirms it (none is connected: `CERT_VERIFICATION_PROVIDER=none`; add one with
`register_verifier` in `services/certificate_verifiers.py`). Local checks recorded in `checks[]`: stated-expiry, holder name vs
account name, duplicate registration number / identical file across accounts, PDF text contains number+name, registry.

| Endpoint | Auth | Notes |
|---|---|---|
| `POST /api/expert-certificates` | Expert + verified email | multipart: `certificate_type, certificate_number, issuing_authority, [holder_name], [issue_date YYYY-MM-DD], [expiry_date], file` (pdf/png/jpg, <=5 MB). 201 |
| `GET /api/expert-certificates` / `/status` | user | own list / `{has_verified_certificate, statuses}` |
| `GET /api/expert-certificates/{id}` and `/file` | owner or Admin | others get 404 |
| `POST /api/expert-certificates/{id}/verify` | owner or Admin | re-run automated checks/registry (409 `decision_final` once verified/rejected) |
| `DELETE /api/expert-certificates/{id}` | owner | not for verified (409) |
| `GET /api/admin/expert-certificates?status=&user_id=` | Admin | includes owner id, history, sha256 |
| `POST /api/admin/expert-certificates/{id}/review` | Admin (not the owner) | `{decision:"verify"|"reject", reason}`; reject needs reason; 409 if expired or another account already holds a verified cert with that number |

## 5. Chatbot uploads (documents / images / links)
Scoped to (user, conversation); owner only, no Admin bypass. Omit `conversation_id` to create a new conversation (its id is returned).
Documents `.pdf .txt .md .docx` (<=10 MB), images `.png .jpg .jpeg .webp` (<=8 MB); type decided from file content and must match
extension; stored as `storage/<category>/<user_id>/<uuid>.<ext>` (client filename is display-only metadata).

| Endpoint | Notes |
|---|---|
| `POST /api/chat-attachments/documents`, `/images` | multipart `file`, optional `conversation_id`; 201 `{conversation_id, attachment}` |
| `POST /api/chat-attachments/links` | `{url, conversation_id?}`; SSRF-hardened fetch (public IPs only, pinned connection, redirect re-validation, size/time caps, html/text/pdf only) |
| `GET /api/chat-attachments?conversation_id=` , `/{id}` , `/{id}/content` , `/{id}/file` , `DELETE /{id}` | owner only (404 otherwise) |
| `GET /api/conversations/{cid}/attachment-context?query=&max_chars=` | the excerpts the chatbot would receive |
| `GET /api/internal/conversations/{cid}/attachment-context?user_id=&query=` | header `X-Internal-Secret` = `RAG_SERVICE_SHARED_SECRET`; 404 when no secret is configured |

Errors: 400 `url_blocked|url_rejected|empty_file`, 413 `file_too_large|url_too_large`, 415 `unsupported_file_type|file_content_mismatch|invalid_image|url_unsupported_content`, 409 `attachment_limit`, 429 `upload_rate_limited`.

## Database (MongoDB; no SQL)
New collections (created by `init_db()`, so fresh DBs work): `email_otps`, `notifications`, `user_devices` (unique `user_id+device_key`),
`login_events`, `email_logs`, `expert_certificates`, `chat_attachments`, `schema_migrations`.
Changed: `users` gains `email_verified, email_verified_at, updated_at, last_login_at` (nothing removed/renamed).
Migrations (`app/database/migrations.py`) run automatically on startup and are idempotent; alternatives:
`python -m app.database.migrations [--status] [--grandfather-verified]` or `mongosh ... --file scripts/mongo_migration_001.js`.
Existing accounts are **not** auto-verified; `--grandfather-verified` is an explicit opt-in.

## Run
```
cd backend && pip install -r requirements.txt && cp .env.example .env
uvicorn app.main:app --reload --port 8000
python -m pytest tests -v
```
Set `SMTP_*`, a strong `JWT_SECRET` and `SECURITY_HASH_KEY`. Without `SMTP_HOST` emails are not sent (only logged as "would send").
Optional OCR: `pip install pytesseract` + tesseract binary.

## Limitations / assumptions
* No real certificate registry exists in the project; only the plug-in point is provided. Admin review is the actual authority.
* Chat attachments reach the RAG service by appending excerpts to the query (the RAG service has no runtime-ingestion API and its
  corpus is offline-built). This can dilute retrieval for very long excerpts; cleaner long-term: add an optional `context` field to
  ip_sakti_rag's `/api/chat`. Prompt injection from uploaded content is mitigated (delimiters/labels), not eliminated.
* Scanned PDFs are not OCR'd in the backend; image OCR needs pytesseract + tesseract, otherwise images are stored but unread (reported in `extraction_note`).
* UA-only device recognition is coarse; send `X-Device-Id` for accuracy. Rate limiters are in-process (per instance); OTP/upload limits are also DB-enforced.
* Files are unencrypted at rest; set a body-size limit at the reverse proxy; uploaded files live on local disk (use a shared volume if multi-instance).
* Pre-existing gaps NOT changed: anyone can self-register as Admin (set `PUBLIC_ADMIN_SIGNUP_ENABLED=false` in production - required for
  certificate review to mean anything); `/api/chat` does not check that a supplied `conversation_id` belongs to the caller (attachments are still isolated).

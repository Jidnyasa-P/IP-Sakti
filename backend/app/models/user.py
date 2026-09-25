"""User documents (users collection).

Role vocabulary intentionally matches the frontend's `UserRole` type exactly
(frontend/src/types.ts: 'Practitioner' | 'Researcher' | 'Expert' | 'Admin' |
'Organization' | 'Startup') rather than the generic USER/EXPERT/ADMIN used
before real auth existed — the frontend is the source of truth for role
labels, and API responses are consumed directly by ProfileView/Header
without any relabeling. A user has one *active* `role` (used for direct
backward-compatible reads) plus a `roles` array of every role they hold
(mirrors the frontend's multi-role "+Add Role" feature in ProfileView).

`password_hash` is a bcrypt hash (see app/core/security.py) and is the only
password-related field ever persisted — the plaintext password is never
stored, logged, or returned by `to_dict()`.
"""
from datetime import datetime, timezone

COLLECTION = "users"

# Allowed role vocabulary (Section 5/7). Must match the frontend's UserRole
# union exactly (frontend/src/types.ts: ALL_ROLE_OPTIONS) — the frontend is
# the source of truth for role labels. Enforced server-side in
# app/services/auth_service.py so a client cannot self-grant an arbitrary or
# privileged-sounding role string; Organization and Startup are already
# first-class members of this vocabulary (not a separate concept to bolt on
# later).
ALLOWED_ROLES = {"Practitioner", "Researcher", "Expert", "Admin", "Organization", "Startup"}


def new_user(
    id: str,
    name: str,
    email: str,
    password_hash: str,
    role: str,
    roles: list[str] | None = None,
    preferred_language: str = "en",
    expert_type: str | None = None,
) -> dict:
    return {
        "_id": id,
        "name": name,
        "email": email,
        "password_hash": password_hash,
        "role": role,
        "roles": roles or [role],
        "preferred_language": preferred_language,
        "expert_type": expert_type,
        "email_verified": False,
        "email_verified_at": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "last_login_at": None,
    }


def to_dict(doc: dict) -> dict:
    """Public-safe representation — never includes password_hash."""
    return {
        "id": doc["_id"],
        "name": doc.get("name"),
        "email": doc.get("email"),
        "role": doc.get("role"),
        "roles": doc.get("roles") or [doc.get("role")],
        "preferred_language": doc.get("preferred_language", "en"),
        "expert_type": doc.get("expert_type"),
        "email_verified": doc.get("email_verified", True),
        "email_verified_at": doc.get("email_verified_at").isoformat() if doc.get("email_verified_at") else None,
        "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
    }

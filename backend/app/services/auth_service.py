"""
Authentication business logic (Section 3/7).

Mirrors the exact operations the frontend's dummy auth store already
performs (frontend/src/components/auth/authStorage.ts: dummyRegister,
dummyLogin, dummyAddRole, dummySetActiveRole) so swapping the frontend's
transport from localStorage to real HTTP calls is a same-shape operation.
"""
import uuid

from fastapi import HTTPException

from app.core.security import hash_password, verify_password
from app.models.user import COLLECTION, new_user, to_dict


def register_user(db, name: str, email: str, password: str, roles: list[str], preferred_language: str = "en") -> dict:
    email_normalized = email.strip().lower()

    if db[COLLECTION].find_one({"email": email_normalized}):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    if not roles:
        roles = ["Practitioner"]

    user_doc = new_user(
        id=f"user-{uuid.uuid4().hex[:12]}",
        name=name.strip(),
        email=email_normalized,
        password_hash=hash_password(password),
        role=roles[0],
        roles=roles,
        preferred_language=preferred_language,
    )
    db[COLLECTION].insert_one(user_doc)
    return to_dict(user_doc)


def authenticate_user(db, email: str, password: str) -> dict:
    email_normalized = email.strip().lower()
    user_doc = db[COLLECTION].find_one({"email": email_normalized})

    if not user_doc or not verify_password(password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return to_dict(user_doc)


def get_user_by_id(db, user_id: str) -> dict | None:
    user_doc = db[COLLECTION].find_one({"_id": user_id})
    return to_dict(user_doc) if user_doc else None


def add_role(db, user_id: str, role: str) -> dict:
    user_doc = db[COLLECTION].find_one({"_id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found.")

    roles = user_doc.get("roles") or [user_doc.get("role")]
    if role not in roles:
        roles = [*roles, role]
        db[COLLECTION].update_one({"_id": user_id}, {"$set": {"roles": roles}})
        user_doc["roles"] = roles
    return to_dict(user_doc)


def set_active_role(db, user_id: str, role: str) -> dict:
    user_doc = db[COLLECTION].find_one({"_id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found.")

    roles = user_doc.get("roles") or [user_doc.get("role")]
    if role not in roles:
        raise HTTPException(status_code=400, detail="This role is not available for this account.")

    db[COLLECTION].update_one({"_id": user_id}, {"$set": {"role": role}})
    user_doc["role"] = role
    return to_dict(user_doc)

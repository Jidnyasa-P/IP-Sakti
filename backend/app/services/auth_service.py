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
from app.models.user import ALLOWED_ROLES, COLLECTION, new_user, to_dict
from app.services.email_service import send_otp, verify_otp, send_welcome_email, send_login_email, send_security_email


def _validate_roles(roles: list[str]) -> None:
    """Section 5/7: never blindly accept arbitrary role strings from a
    client — only the project's known role vocabulary is allowed. Prevents
    a client from self-granting e.g. "SuperAdmin" or a typo'd role that
    would silently fail every `require_role(...)` check downstream."""
    unknown = [r for r in roles if r not in ALLOWED_ROLES]
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown role(s): {', '.join(unknown)}. Allowed roles: {', '.join(sorted(ALLOWED_ROLES))}.",
        )


def register_user(db, name: str, email: str, password: str, roles: list[str], preferred_language: str = "en", expert_type: str | None = None) -> dict:
    email_normalized = email.strip().lower()

    if db[COLLECTION].find_one({"email": email_normalized}):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    if not roles:
        roles = ["Practitioner"]
    _validate_roles(roles)
    if "Expert" in roles and expert_type not in {"ayurveda", "legal", "regulatory"}:
        raise HTTPException(status_code=400, detail="Please select an expert type for an Expert account.")
    if "Expert" not in roles:
        expert_type = None

    user_doc = new_user(
        id=f"user-{uuid.uuid4().hex[:12]}",
        name=name.strip(),
        email=email_normalized,
        password_hash=hash_password(password),
        role=roles[0],
        roles=roles,
        preferred_language=preferred_language,
        expert_type=expert_type,
    )
    db[COLLECTION].insert_one(user_doc)
    return to_dict(user_doc)


def authenticate_user(db, email: str, password: str) -> dict:
    email_normalized = email.strip().lower()
    user_doc = db[COLLECTION].find_one({"email": email_normalized})

    if not user_doc or not verify_password(password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if user_doc.get("email_verified") is False:
        raise HTTPException(status_code=403, detail="Please verify your email address with the OTP sent during registration.")

    return to_dict(user_doc)


def get_user_by_id(db, user_id: str) -> dict | None:
    user_doc = db[COLLECTION].find_one({"_id": user_id})
    return to_dict(user_doc) if user_doc else None


def add_role(db, user_id: str, role: str) -> dict:
    _validate_roles([role])
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


def verify_registration_email(db, email: str, otp: str) -> dict:
    email_normalized = email.strip().lower()
    user_doc = db[COLLECTION].find_one({"email": email_normalized})
    if not user_doc:
        raise HTTPException(status_code=404, detail="No account was found for this email address.")
    verify_otp(db, email_normalized, "registration", otp)
    now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    db[COLLECTION].update_one({"_id": user_doc["_id"]}, {"$set": {"email_verified": True, "email_verified_at": now}})
    user_doc["email_verified"] = True
    send_welcome_email(email_normalized, user_doc.get("name", "there"))
    return to_dict(user_doc)


def send_registration_otp(db, email: str) -> dict:
    if not db[COLLECTION].find_one({"email": email.strip().lower()}):
        raise HTTPException(status_code=404, detail="No account was found for this email address.")
    return send_otp(db, email, "registration")


def reset_password_with_otp(db, email: str, otp: str, new_password: str) -> dict:
    email_normalized = email.strip().lower()
    user_doc = db[COLLECTION].find_one({"email": email_normalized})
    if not user_doc:
        raise HTTPException(status_code=404, detail="No account was found for this email address.")
    verify_otp(db, email_normalized, "forgot_password", otp)
    db[COLLECTION].update_one({"_id": user_doc["_id"]}, {"$set": {"password_hash": hash_password(new_password)}})
    send_security_email(email_normalized, user_doc.get("name", "there"), "Your IP-SAKTI password was reset", "Your password was reset successfully.")
    return to_dict(user_doc)


def change_password(db, user_id: str, current_password: str, otp: str, new_password: str) -> dict:
    user_doc = db[COLLECTION].find_one({"_id": user_id})
    if not user_doc or not verify_password(current_password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Current password is incorrect.")
    verify_otp(db, user_doc["email"], "change_password", otp)
    db[COLLECTION].update_one({"_id": user_id}, {"$set": {"password_hash": hash_password(new_password)}})
    send_security_email(user_doc["email"], user_doc.get("name", "there"), "Your IP-SAKTI password was changed", "Your password was changed successfully.")
    return to_dict(user_doc)

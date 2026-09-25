"""Authentication and account-security business logic."""
from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from app.core.config import get_settings
from app.core.security import hash_password, verify_password
from app.models.user import ALLOWED_ROLES, COLLECTION, new_user, to_dict
from app.services import email_service

EXPERT_TYPES = {
    "ayurveda": "Ayurveda Expert",
    "legal": "Legal / IP Expert",
    "regulatory": "Regulatory Affairs Expert",
}


def _default_organization_role() -> dict:
    return {
        "id": "org-role-admin",
        "name": "Admin",
        "description": "Organization-level administrator who manages organizational roles and oversight.",
        "is_default": True,
        "created_at": datetime.now(timezone.utc),
    }


def _ensure_organization_roles(db, user_doc: dict) -> dict:
    roles = user_doc.get("roles") or [user_doc.get("role")]
    organization_roles = list(user_doc.get("organization_roles") or [])
    if "Organization" in roles and not any(item.get("id") == "org-role-admin" for item in organization_roles):
        organization_roles.insert(0, _default_organization_role())
        db[COLLECTION].update_one(
            {"_id": user_doc["_id"]},
            {"$set": {"organization_roles": organization_roles, "updated_at": datetime.now(timezone.utc)}},
        )
        user_doc["organization_roles"] = organization_roles
    else:
        user_doc["organization_roles"] = organization_roles
    return user_doc


def _require_organization(db, user_id: str) -> dict:
    user_doc = db[COLLECTION].find_one({"_id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found.")
    roles = user_doc.get("roles") or [user_doc.get("role")]
    if "Organization" not in roles:
        raise HTTPException(status_code=403, detail="Organization role is required for organization role management.")
    return _ensure_organization_roles(db, user_doc)


def _validate_roles(roles: list[str]) -> None:
    unknown = [r for r in roles if r not in ALLOWED_ROLES]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown role(s): {', '.join(unknown)}. Allowed roles: {', '.join(sorted(ALLOWED_ROLES))}.")


def validate_expert_type(expert_type: str | None, roles: list[str]) -> str | None:
    if "Expert" not in roles:
        return None
    if expert_type not in EXPERT_TYPES:
        raise HTTPException(status_code=400, detail="Please select a valid expert type.")
    return expert_type


def _otp_hash(email: str, purpose: str, otp: str) -> str:
    settings = get_settings()
    secret = settings.otp_pepper or settings.jwt_secret
    raw = f"{email.lower()}|{purpose}|{otp}".encode()
    return hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()


def _new_otp(db, email: str, user_id: str, purpose: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    existing = db["email_otps"].find_one({"email": email, "purpose": purpose}, sort=[("created_at", -1)])
    if existing:
        created_at = existing.get("created_at")
        if created_at and created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if created_at and (now - created_at).total_seconds() < settings.otp_resend_cooldown_seconds:
            raise HTTPException(status_code=429, detail="Please wait before requesting another verification code.")

    hour_ago = now - timedelta(hours=1)
    sends = db["email_otps"].count_documents({"email": email, "purpose": purpose, "created_at": {"$gte": hour_ago}})
    if sends >= settings.otp_max_sends_per_hour:
        raise HTTPException(status_code=429, detail="Too many verification codes requested. Please try again later.")

    otp = "".join(secrets.choice("0123456789") for _ in range(settings.otp_length))
    db["email_otps"].update_many({"email": email, "purpose": purpose, "consumed_at": None}, {"$set": {"superseded": True}})
    db["email_otps"].insert_one({
        "_id": f"otp-{uuid.uuid4().hex}",
        "email": email,
        "user_id": user_id,
        "purpose": purpose,
        "otp_hash": _otp_hash(email, purpose, otp),
        "created_at": now,
        "expires_at": now + timedelta(minutes=settings.otp_ttl_minutes),
        "attempts": 0,
        "consumed_at": None,
        "superseded": False,
    })
    return otp


def _send_otp(db, user_doc: dict, purpose: str) -> bool:
    otp = _new_otp(db, user_doc["email"], user_doc["_id"], purpose)
    if purpose == "registration":
        ok = email_service.send_registration_otp(user_doc["email"], user_doc["name"], otp)
    else:
        ok = email_service.send_otp_for_security(user_doc["email"], user_doc["name"], otp, purpose)
    if not ok:
        # The OTP remains stored but the caller receives a clear delivery error.
        raise HTTPException(status_code=503, detail="The verification email could not be sent. Please try again later.")
    return True


def register_user(db, name: str, email: str, password: str, roles: list[str], preferred_language: str = "en", expert_type: str | None = None) -> dict:
    email_normalized = email.strip().lower()
    existing = db[COLLECTION].find_one({"email": email_normalized})
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    roles = roles or ["Practitioner"]
    _validate_roles(roles)
    expert_type = validate_expert_type(expert_type, roles)

    # Do not create the users document until the registration OTP is verified.
    pending = db["pending_registrations"].find_one({"email": email_normalized})
    if pending:
        raise HTTPException(status_code=409, detail="Registration is already pending verification. Please use the code sent to your email or request a new code.")

    pending_id = f"pending-{uuid.uuid4().hex}"
    pending_doc = {
        "_id": pending_id,
        "name": name.strip(),
        "email": email_normalized,
        "password_hash": hash_password(password),
        "roles": roles,
        "role": roles[0],
        "organization_roles": [_default_organization_role()] if "Organization" in roles else [],
        "preferred_language": preferred_language,
        "expert_type": expert_type,
        "created_at": datetime.now(timezone.utc),
    }
    db["pending_registrations"].insert_one(pending_doc)

    try:
        _send_otp(db, pending_doc, "registration")
    except HTTPException:
        db["pending_registrations"].delete_one({"_id": pending_id})
        db["email_otps"].delete_many({"user_id": pending_id})
        raise

    return {
        "email": email_normalized,
        "email_verification": {"required": True, "otp_sent": True},
    }

def authenticate_user(db, email: str, password: str) -> dict:
    email_normalized = email.strip().lower()
    user_doc = db[COLLECTION].find_one({"email": email_normalized})
    if not user_doc or not verify_password(password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    user_doc = _ensure_organization_roles(db, user_doc)

    if get_settings().require_email_verification and not user_doc.get("email_verified", True):
        raise HTTPException(status_code=403, detail="Please verify your email before signing in.", headers={"X-Auth-Code": "email_not_verified"})

    now = datetime.now(timezone.utc)
    db[COLLECTION].update_one({"_id": user_doc["_id"]}, {"$set": {"last_login_at": now, "updated_at": now}})
    user_doc["last_login_at"] = now
    email_service.send_login_alert(user_doc["email"], user_doc["name"])
    return to_dict(user_doc)


def verify_email(db, email: str, otp: str) -> dict:
    email_normalized = email.strip().lower()
    row = db["email_otps"].find_one({
        "email": email_normalized,
        "purpose": "registration",
        "consumed_at": None,
        "superseded": {"$ne": True},
    }, sort=[("created_at", -1)])
    if not row:
        raise HTTPException(status_code=400, detail="Invalid verification code.", headers={"X-Auth-Code": "otp_invalid"})

    now = datetime.now(timezone.utc)
    expires_at = row.get("expires_at")
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < now:
        raise HTTPException(status_code=400, detail="Verification code has expired.", headers={"X-Auth-Code": "otp_expired"})
    if row.get("attempts", 0) >= get_settings().otp_max_attempts:
        raise HTTPException(status_code=429, detail="Too many incorrect attempts. Request a new code.", headers={"X-Auth-Code": "otp_locked"})
    if not hmac.compare_digest(row["otp_hash"], _otp_hash(email_normalized, "registration", otp)):
        db["email_otps"].update_one({"_id": row["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid verification code.", headers={"X-Auth-Code": "otp_invalid"})

    pending_id = row.get("user_id")
    pending = db["pending_registrations"].find_one({"_id": pending_id, "email": email_normalized})
    if not pending:
        raise HTTPException(status_code=400, detail="Registration request is no longer available. Please register again.", headers={"X-Auth-Code": "registration_missing"})

    # Final duplicate check before creating the real account.
    if db[COLLECTION].find_one({"email": email_normalized}):
        db["pending_registrations"].delete_one({"_id": pending_id})
        db["email_otps"].update_one({"_id": row["_id"]}, {"$set": {"consumed_at": now}})
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    user_doc = new_user(
        id=f"user-{uuid.uuid4().hex[:12]}",
        name=pending["name"],
        email=pending["email"],
        password_hash=pending["password_hash"],
        role=pending["role"],
        roles=pending.get("roles") or [pending["role"]],
        preferred_language=pending.get("preferred_language", "en"),
        expert_type=pending.get("expert_type"),
        organization_roles=pending.get("organization_roles"),
    )
    user_doc["email_verified"] = True
    user_doc["email_verified_at"] = now
    db[COLLECTION].insert_one(user_doc)
    db["email_otps"].update_one({"_id": row["_id"]}, {"$set": {"consumed_at": now}})
    db["pending_registrations"].delete_one({"_id": pending_id})

    email_service.send_welcome(user_doc["email"], user_doc["name"])
    email_service.send_email_verified(user_doc["email"], user_doc["name"])
    return to_dict(user_doc)


def resend_otp(db, email: str) -> None:
    email_normalized = email.strip().lower()
    if db[COLLECTION].find_one({"email": email_normalized}):
        return
    pending = db["pending_registrations"].find_one({"email": email_normalized})
    if not pending:
        return
    _send_otp(db, pending, "registration")

def get_user_by_id(db, user_id: str) -> dict | None:
    user_doc = db[COLLECTION].find_one({"_id": user_id})
    if not user_doc:
        return None
    return to_dict(_ensure_organization_roles(db, user_doc))


def get_user_doc(db, user_id: str) -> dict | None:
    return db[COLLECTION].find_one({"_id": user_id})


def get_user_doc_by_email(db, email: str) -> dict | None:
    return db[COLLECTION].find_one({"email": email.strip().lower()})


def add_role(db, user_id: str, role: str, expert_type: str | None = None) -> dict:
    _validate_roles([role])
    user_doc = db[COLLECTION].find_one({"_id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found.")
    if role == "Expert" and expert_type:
        expert_type = validate_expert_type(expert_type, ["Expert"])
    roles = user_doc.get("roles") or [user_doc.get("role")]
    if role not in roles:
        roles = [*roles, role]
        updates = {"roles": roles, "updated_at": datetime.now(timezone.utc)}
        if role == "Expert":
            updates["expert_type"] = expert_type
        db[COLLECTION].update_one({"_id": user_id}, {"$set": updates})
        user_doc.update(updates)
    return to_dict(_ensure_organization_roles(db, user_doc))


def set_active_role(db, user_id: str, role: str) -> dict:
    user_doc = db[COLLECTION].find_one({"_id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found.")
    roles = user_doc.get("roles") or [user_doc.get("role")]
    if role not in roles:
        raise HTTPException(status_code=400, detail="This role is not available for this account.")
    db[COLLECTION].update_one({"_id": user_id}, {"$set": {"role": role, "updated_at": datetime.now(timezone.utc)}})
    user_doc["role"] = role
    return to_dict(_ensure_organization_roles(db, user_doc))


def list_organization_roles(db, user_id: str) -> list[dict]:
    user_doc = _require_organization(db, user_id)
    roles = user_doc.get("organization_roles") or []
    return [
        {
            **item,
            "created_at": item.get("created_at").isoformat()
            if item.get("created_at") else None,
        }
        for item in roles
    ]


def add_organization_role(db, user_id: str, name: str, description: str = "") -> dict:
    user_doc = _require_organization(db, user_id)
    clean_name = " ".join(name.split())
    clean_description = description.strip()
    if len(clean_name) < 2 or len(clean_name) > 60:
        raise HTTPException(status_code=400, detail="Organization role name must be between 2 and 60 characters.")
    existing = [item.get("name", "").strip().casefold() for item in user_doc.get("organization_roles") or []]
    if clean_name.casefold() in existing:
        raise HTTPException(status_code=409, detail="That organization role already exists.")

    role = {
        "id": f"org-role-{secrets.token_hex(6)}",
        "name": clean_name,
        "description": clean_description[:240],
        "is_default": False,
        "created_at": datetime.now(timezone.utc),
    }
    roles = [*(user_doc.get("organization_roles") or []), role]
    db[COLLECTION].update_one(
        {"_id": user_id},
        {"$set": {"organization_roles": roles, "updated_at": datetime.now(timezone.utc)}},
    )
    return {
        **role,
        "created_at": role["created_at"].isoformat(),
    }


def delete_organization_role(db, user_id: str, role_id: str) -> None:
    user_doc = _require_organization(db, user_id)
    roles = user_doc.get("organization_roles") or []
    target = next((item for item in roles if item.get("id") == role_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Organization role not found.")
    if target.get("is_default") or target.get("id") == "org-role-admin":
        raise HTTPException(status_code=400, detail="The default organization Admin role cannot be removed.")
    db[COLLECTION].update_one(
        {"_id": user_id},
        {
            "$set": {
                "organization_roles": [item for item in roles if item.get("id") != role_id],
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )


def request_security_otp(db, user_doc: dict, purpose: str, current_password: str | None = None) -> None:
    if current_password is not None and not verify_password(current_password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Current password is incorrect.")
    if purpose not in {"forgot_password", "change_password", "delete_account"}:
        raise HTTPException(status_code=400, detail="Invalid security action.")
    _send_otp(db, user_doc, purpose)


def _consume_security_otp(db, user_doc: dict, otp: str, purpose: str) -> None:
    row = db["email_otps"].find_one({"email": user_doc["email"], "purpose": purpose, "consumed_at": None, "superseded": {"$ne": True}}, sort=[("created_at", -1)])
    if not row:
        raise HTTPException(status_code=400, detail="Invalid verification code.")
    now = datetime.now(timezone.utc)
    expires_at = row.get("expires_at")
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < now:
        raise HTTPException(status_code=400, detail="Verification code has expired.")
    if row.get("attempts", 0) >= get_settings().otp_max_attempts:
        raise HTTPException(status_code=429, detail="Too many incorrect attempts. Request a new code.")
    if not hmac.compare_digest(row["otp_hash"], _otp_hash(user_doc["email"], purpose, otp)):
        db["email_otps"].update_one({"_id": row["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid verification code.")
    db["email_otps"].update_one({"_id": row["_id"]}, {"$set": {"consumed_at": now}})


def reset_password_with_otp(db, email: str, otp: str, new_password: str) -> None:
    user_doc = db[COLLECTION].find_one({"email": email.strip().lower()})
    if not user_doc:
        raise HTTPException(status_code=400, detail="Invalid password reset request.")
    _consume_security_otp(db, user_doc, otp, "forgot_password")
    db[COLLECTION].update_one({"_id": user_doc["_id"]}, {"$set": {"password_hash": hash_password(new_password), "updated_at": datetime.now(timezone.utc)}})
    email_service.send_password_changed(user_doc["email"], user_doc["name"])


def change_password_with_otp(db, user_id: str, otp: str, new_password: str) -> None:
    user_doc = db[COLLECTION].find_one({"_id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found.")
    _consume_security_otp(db, user_doc, otp, "change_password")
    db[COLLECTION].update_one({"_id": user_id}, {"$set": {"password_hash": hash_password(new_password), "updated_at": datetime.now(timezone.utc)}})
    email_service.send_password_changed(user_doc["email"], user_doc["name"])


def delete_account_with_otp(db, user_id: str, otp: str) -> str:
    user_doc = db[COLLECTION].find_one({"_id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found.")
    _consume_security_otp(db, user_doc, otp, "delete_account")
    # Remove account-owned application data as part of permanent deletion.
    conversation_ids = [row.get("_id") for row in db["conversations"].find({"user_id": user_id}, {"_id": 1})]
    for collection in ("conversations", "product_analyses", "tk_abs_analyses", "saved_research", "grievances", "audit_logs"):
        db[collection].delete_many({"user_id": user_id})
    if conversation_ids:
        db["chat_messages"].delete_many({"conversation_id": {"$in": conversation_ids}})
        db["feedback"].delete_many({"conversation_id": {"$in": conversation_ids}})
        db["classification_records"].delete_many({"conversation_id": {"$in": conversation_ids}})
        db["validation_results"].delete_many({"conversation_id": {"$in": conversation_ids}})
        db["expert_escalations"].delete_many({"conversation_id": {"$in": conversation_ids}})
    db["expert_escalations"].delete_many({"user_id": user_id})
    db["email_otps"].delete_many({"user_id": user_id})
    db[COLLECTION].delete_one({"_id": user_id})
    email_service.send_account_deleted(user_doc["email"], user_doc["name"])
    return user_doc["email"]

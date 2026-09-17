"""
Password hashing and JWT helpers (Section 3: real backend authentication).

Passwords are hashed with bcrypt (via passlib) — never stored or compared
in plaintext. Sessions are stateless JSON Web Tokens signed with
JWT_SECRET (see app/core/config.py); the token's `sub` claim is the
MongoDB user `_id`.

Logout is intentionally stateless (the client simply discards the token).
There is no server-side token blacklist in this MVP — documented here
rather than silently pretended away. A production deployment wanting
immediate server-side revocation would add a short-lived token store
(e.g. a `revoked_tokens` Mongo collection keyed by jti) and check it in
`get_current_user` (see app/api/deps.py).
"""
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from app.core.config import get_settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return _pwd_context.verify(plain_password, password_hash)
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str | None:
    """Returns the user_id (sub claim) if the token is valid, else None."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None

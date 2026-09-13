"""
FastAPI dependencies for authentication and role-based authorization
(Section 5/7). Every protected route depends on `get_current_user`; routes
restricted to specific roles additionally depend on `require_role(...)`.
"""
from fastapi import Depends, HTTPException, Header

from app.core.security import decode_access_token
from app.database.session import get_db
from app.services.auth_service import get_user_by_id


def get_current_user(authorization: str | None = Header(default=None), db=Depends(get_db)) -> dict:
    """Decodes the `Authorization: Bearer <token>` header and returns the
    corresponding user document (public shape, no password_hash). Raises
    401 if the header is missing, malformed, the token is invalid/expired,
    or the user no longer exists."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated.")

    token = authorization.split(" ", 1)[1].strip()
    user_id = decode_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")

    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists.")

    return user


def require_role(*allowed_roles: str):
    """Dependency factory: raises 403 unless the current user holds at
    least one of `allowed_roles` (checked against their full `roles` list,
    not just the currently-active `role` — e.g. an Admin who switched their
    active role to Researcher can still reach Admin-only endpoints)."""

    def _dependency(current_user: dict = Depends(get_current_user)) -> dict:
        if not any(r in current_user.get("roles", []) for r in allowed_roles):
            raise HTTPException(status_code=403, detail="You do not have permission to access this resource.")
        return current_user

    return _dependency

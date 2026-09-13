"""
Authentication endpoints (Section 3).

POST /api/auth/register, /api/auth/login return {token, user} — the
frontend's authStorage.ts stores the token and caches `user` for
synchronous session bootstrap (see AuthContext.tsx's
useState(() => getSessionUser())).

GET /api/auth/me lets the frontend verify/refresh a cached session in the
background. POST /api/auth/logout is intentionally stateless (see
app/core/security.py's module docstring for why).
"""
from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.database.session import get_db
from app.schemas.auth import RegisterRequest, LoginRequest, AddRoleRequest, SetActiveRoleRequest
from app.services import auth_service
from app.core.security import create_access_token

router = APIRouter(prefix="/api/auth")


@router.post("/register")
def register(body: RegisterRequest, db=Depends(get_db)):
    user = auth_service.register_user(
        db, name=body.name, email=body.email, password=body.password,
        roles=body.roles, preferred_language=body.preferred_language,
    )
    token = create_access_token(user["id"])
    return {"token": token, "user": user}


@router.post("/login")
def login(body: LoginRequest, db=Depends(get_db)):
    user = auth_service.authenticate_user(db, email=body.email, password=body.password)
    token = create_access_token(user["id"])
    return {"token": token, "user": user}


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout():
    # Stateless JWT: nothing to invalidate server-side. The frontend simply
    # discards its stored token (see authStorage.ts's dummyLogout).
    return {"success": True}


@router.post("/roles")
def add_role(body: AddRoleRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    return auth_service.add_role(db, current_user["id"], body.role)


@router.post("/active-role")
def set_active_role(body: SetActiveRoleRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    return auth_service.set_active_role(db, current_user["id"], body.role)

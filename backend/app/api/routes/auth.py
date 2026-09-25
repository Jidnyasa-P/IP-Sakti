"""Authentication, email verification and account-security endpoints."""
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user
from app.database.session import get_db
from app.schemas.auth import (
    RegisterRequest, LoginRequest, AddRoleRequest, SetActiveRoleRequest,
    EmailOTPRequest, ResendOTPRequest, ForgotPasswordRequest,
    ForgotPasswordConfirmRequest, ChangePasswordRequest,
    ChangePasswordConfirmRequest, DeleteAccountRequest, DeleteAccountConfirmRequest,
)
from app.services import auth_service
from app.core.security import create_access_token

router = APIRouter(prefix="/api/auth")


@router.post("/register")
def register(body: RegisterRequest, db=Depends(get_db)):
    user = auth_service.register_user(
        db, name=body.name, email=body.email, password=body.password,
        roles=body.roles, preferred_language=body.preferred_language,
        expert_type=body.expert_type,
    )
    # Registration creates only a pending verification request. No login token
    # or users document exists until the OTP is verified.
    return {"success": True, "email": body.email.strip().lower(), "email_verification": user["email_verification"]}


@router.post("/verify-email")
def verify_email(body: EmailOTPRequest, db=Depends(get_db)):
    user = auth_service.verify_email(db, body.email, body.otp)
    return {"success": True, "user": user}


@router.post("/resend-otp")
def resend_otp(body: ResendOTPRequest, db=Depends(get_db)):
    auth_service.resend_otp(db, body.email)
    return {"success": True}


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
    return {"success": True}


@router.post("/roles")
def add_role(body: AddRoleRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    return auth_service.add_role(db, current_user["id"], body.role, body.expert_type)


@router.post("/active-role")
def set_active_role(body: SetActiveRoleRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    return auth_service.set_active_role(db, current_user["id"], body.role)


@router.post("/forgot-password/request")
def forgot_password_request(body: ForgotPasswordRequest, db=Depends(get_db)):
    user_doc = auth_service.get_user_doc_by_email(db, body.email)
    if user_doc:
        auth_service.request_security_otp(db, user_doc, "forgot_password")
    # Do not reveal whether an account exists.
    return {"success": True, "message": "If the account exists, a verification code has been sent."}


@router.post("/forgot-password/confirm")
def forgot_password_confirm(body: ForgotPasswordConfirmRequest, db=Depends(get_db)):
    auth_service.reset_password_with_otp(db, body.email, body.otp, body.new_password)
    return {"success": True}


@router.post("/change-password/request")
def change_password_request(body: ChangePasswordRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    user_doc = auth_service.get_user_doc(db, current_user["id"])
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found.")
    auth_service.request_security_otp(db, user_doc, "change_password", body.current_password)
    return {"success": True, "message": "A verification code has been sent to your email."}


@router.post("/change-password/confirm")
def change_password_confirm(body: ChangePasswordConfirmRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    auth_service.change_password_with_otp(db, current_user["id"], body.otp, body.new_password)
    return {"success": True}


@router.post("/delete-account/request")
def delete_account_request(body: DeleteAccountRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    user_doc = auth_service.get_user_doc(db, current_user["id"])
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found.")
    auth_service.request_security_otp(db, user_doc, "delete_account", body.current_password)
    return {"success": True, "message": "A verification code has been sent to your email."}


@router.post("/delete-account/confirm")
def delete_account_confirm(body: DeleteAccountConfirmRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    auth_service.delete_account_with_otp(db, current_user["id"], body.otp)
    return {"success": True}

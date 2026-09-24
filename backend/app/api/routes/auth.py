"""Authentication endpoints."""
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user
from app.database.session import get_db
from app.schemas.auth import (
    RegisterRequest, LoginRequest, AddRoleRequest, SetActiveRoleRequest,
    VerifyEmailRequest, ForgotPasswordRequest, ResetPasswordRequest,
    ChangePasswordRequest, DeleteAccountRequest, PasswordVerificationRequest,
)
from app.services import auth_service
from app.services.email_service import send_otp, send_login_email
from app.core.security import create_access_token, verify_password
from app.models.user import COLLECTION

router = APIRouter(prefix="/api/auth")


@router.post("/register")
def register(body: RegisterRequest, db=Depends(get_db)):
    user = auth_service.register_user(
        db, name=body.name, email=body.email, password=body.password,
        roles=body.roles, preferred_language=body.preferred_language,
        expert_type=body.expert_type,
    )
    try:
        send_otp(db, body.email, "registration")
    except Exception:
        db[COLLECTION].delete_one({"_id": user["id"]})
        raise
    return {"requires_verification": True, "user": user}


@router.post("/verify-email")
def verify_email(body: VerifyEmailRequest, db=Depends(get_db)):
    user = auth_service.verify_registration_email(db, body.email, body.otp)
    return {"success": True, "user": user}


@router.post("/resend-registration-otp")
def resend_registration_otp(body: ForgotPasswordRequest, db=Depends(get_db)):
    return auth_service.send_registration_otp(db, body.email)


@router.post("/login")
def login(body: LoginRequest, db=Depends(get_db)):
    user = auth_service.authenticate_user(db, email=body.email, password=body.password)
    token = create_access_token(user["id"])
    send_login_email(user["email"], user.get("name", "there"))
    return {"token": token, "user": user}


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db=Depends(get_db)):
    user = db[COLLECTION].find_one({"email": body.email.strip().lower()})
    if not user:
        # Do not reveal whether an email exists.
        return {"success": True, "message": "If the account exists, a password reset OTP has been sent."}
    send_otp(db, user["email"], "forgot_password")
    return {"success": True, "message": "If the account exists, a password reset OTP has been sent."}


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db=Depends(get_db)):
    auth_service.reset_password_with_otp(db, body.email, body.otp, body.new_password)
    return {"success": True, "message": "Password reset successfully."}


@router.post("/change-password/send-otp")
def send_change_password_otp(body: PasswordVerificationRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    user_doc = db[COLLECTION].find_one({"_id": current_user["id"]})
    if not user_doc or not verify_password(body.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Current password is incorrect.")
    return send_otp(db, current_user["email"], "change_password")


@router.post("/change-password")
def change_password(body: ChangePasswordRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    auth_service.change_password(db, current_user["id"], body.current_password, body.otp, body.new_password)
    return {"success": True, "message": "Password changed successfully."}


@router.post("/delete-account/send-otp")
def send_delete_account_otp(body: PasswordVerificationRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    user_doc = db[COLLECTION].find_one({"_id": current_user["id"]})
    if not user_doc or not verify_password(body.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Password is incorrect.")
    return send_otp(db, current_user["email"], "delete_account")


@router.delete("/account")
def delete_account(body: DeleteAccountRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    user_doc = db[COLLECTION].find_one({"_id": current_user["id"]})
    if not user_doc or not verify_password(body.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Password is incorrect.")
    from app.services.email_service import verify_otp, send_security_email
    verify_otp(db, current_user["email"], "delete_account", body.otp)

    user_id = current_user["id"]
    conversation_ids = [str(row["_id"]) for row in db["conversations"].find({"user_id": user_id}, {"_id": 1})]
    # Remove account-owned application data while retaining unrelated users' data.
    for collection in (
        "conversations", "product_analyses", "tk_abs_analyses", "saved_research",
        "classification_records", "validation_results", "grievances", "user_ingested_documents",
    ):
        db[collection].delete_many({"user_id": user_id})
    if conversation_ids:
        for collection in ("chat_messages", "feedback", "expert_escalations", "audit_logs"):
            db[collection].delete_many({"conversation_id": {"$in": conversation_ids}})
    db[COLLECTION].delete_one({"_id": user_id})
    send_security_email(current_user["email"], current_user.get("name", "there"), "Your IP-SAKTI account was deleted", "Your account and associated application data were deleted successfully.")
    return {"success": True, "message": "Account deleted successfully."}


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout():
    return {"success": True}


@router.post("/roles")
def add_role(body: AddRoleRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    return auth_service.add_role(db, current_user["id"], body.role)


@router.post("/active-role")
def set_active_role(body: SetActiveRoleRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    return auth_service.set_active_role(db, current_user["id"], body.role)

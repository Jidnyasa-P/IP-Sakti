"""Pydantic request/response models for authentication and account security."""
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    roles: list[str]
    preferred_language: str = "en"
    expert_type: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AddRoleRequest(BaseModel):
    role: str
    expert_type: Optional[str] = None


class SetActiveRoleRequest(BaseModel):
    role: str


class EmailOTPRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=8, pattern=r"^\d+$")


class ResendOTPRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordConfirmRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=8, pattern=r"^\d+$")
    new_password: str = Field(min_length=6)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)


class ChangePasswordConfirmRequest(BaseModel):
    otp: str = Field(min_length=6, max_length=8, pattern=r"^\d+$")
    new_password: str = Field(min_length=6)


class DeleteAccountRequest(BaseModel):
    current_password: str = Field(min_length=1)


class DeleteAccountConfirmRequest(BaseModel):
    otp: str = Field(min_length=6, max_length=8, pattern=r"^\d+$")


class UserPublic(BaseModel):
    id: str
    name: str
    email: str
    role: str
    roles: list[str]
    preferred_language: str
    expert_type: Optional[str] = None
    email_verified: bool = True
    email_verified_at: Optional[str] = None
    created_at: Optional[str] = None


class AuthResponse(BaseModel):
    token: str
    user: UserPublic

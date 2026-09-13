"""Pydantic request/response models for /api/auth/*.

Field names and shapes mirror exactly what the frontend already sends —
see frontend/src/context/AuthContext.tsx's RegisterParams and the
`register`/`login` calls in RegisterView.tsx / LoginView.tsx — so no
frontend request-building code needs to change, only authStorage.ts's
transport (localStorage -> fetch).
"""
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    roles: list[str]
    preferred_language: str = "en"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AddRoleRequest(BaseModel):
    role: str


class SetActiveRoleRequest(BaseModel):
    role: str


class UserPublic(BaseModel):
    id: str
    name: str
    email: str
    role: str
    roles: list[str]
    preferred_language: str
    created_at: Optional[str] = None


class AuthResponse(BaseModel):
    token: str
    user: UserPublic

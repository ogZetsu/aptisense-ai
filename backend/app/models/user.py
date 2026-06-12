"""User document models."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    provider: Literal["email", "google"] = "email"
    profile_image: Optional[str] = None
    google_sub: Optional[str] = None
    role: Literal["user", "admin"] = "user"


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    username: Optional[str] = None
    profile_image: Optional[str] = None


class UserDocument(BaseModel):
    id: str
    fullName: str
    email: str
    password: Optional[str] = None
    role: Literal["user", "admin"] = "user"
    profileImage: Optional[str] = None
    provider: Literal["email", "google"] = "email"
    googleSub: Optional[str] = None
    username: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)
    lastLoginAt: Optional[datetime] = None

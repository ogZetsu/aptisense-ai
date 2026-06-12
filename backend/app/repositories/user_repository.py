"""User repository — MongoDB CRUD."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from pymongo import ReturnDocument

from app.db.connection import get_database


def _serialize_user(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Map MongoDB user document to API-friendly snake_case."""
    if not doc:
        return None
    created = doc.get("createdAt")
    updated = doc.get("updatedAt")
    last_login = doc.get("lastLoginAt")
    return {
        "user_id": doc.get("id"),
        "id": doc.get("id"),
        "username": doc.get("username") or doc.get("fullName"),
        "full_name": doc.get("fullName"),
        "email": doc.get("email"),
        "role": doc.get("role", "user"),
        "auth_provider": doc.get("provider", "email"),
        "provider": doc.get("provider", "email"),
        "profile_image": doc.get("profileImage"),
        "google_sub": doc.get("googleSub"),
        "password_hash": doc.get("password"),
        "created_at": created.isoformat() if hasattr(created, "isoformat") else created,
        "updated_at": updated.isoformat() if hasattr(updated, "isoformat") else updated,
        "last_login_at": last_login.isoformat() if hasattr(last_login, "isoformat") else last_login,
        # New profile fields
        "gender": doc.get("gender"),
        "dob": doc.get("dob"),
        "contact_number": doc.get("contactNumber"),
        "degree": doc.get("degree"),
        "branch": doc.get("branch"),
        "graduation_year": doc.get("graduationYear"),
        "cgpa": doc.get("cgpa"),
        "skills": doc.get("skills"),
        "github_url": doc.get("githubUrl"),
        "linkedin_url": doc.get("linkedinUrl"),
        "reset_code": doc.get("resetCode"),
        "reset_code_expires": doc.get("resetCodeExpires"),
    }


class UserRepository:
    COLLECTION = "users"

    @classmethod
    def _col(cls):
        return get_database()[cls.COLLECTION]

    @classmethod
    def create(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        now = datetime.utcnow()
        user_id = data.get("id") or str(uuid4())
        doc = {
            "id": user_id,
            "fullName": data["fullName"],
            "email": data["email"].strip().lower(),
            "password": data.get("password"),
            "role": data.get("role", "user"),
            "profileImage": data.get("profileImage"),
            "provider": data.get("provider", "email"),
            "googleSub": data.get("googleSub"),
            "username": data.get("username") or data["fullName"],
            "createdAt": now,
            "updatedAt": now,
            "lastLoginAt": now,
        }
        cls._col().insert_one(doc)
        return _serialize_user(doc)

    @classmethod
    def find_by_id(cls, user_id: str) -> Optional[Dict[str, Any]]:
        doc = cls._col().find_one({"id": user_id})
        return _serialize_user(doc)

    @classmethod
    def find_by_email(cls, email: str) -> Optional[Dict[str, Any]]:
        doc = cls._col().find_one({"email": email.strip().lower()})
        return _serialize_user(doc)

    @classmethod
    def find_by_google_sub(cls, google_sub: str) -> Optional[Dict[str, Any]]:
        doc = cls._col().find_one({"googleSub": google_sub})
        return _serialize_user(doc)

    @classmethod
    def find_by_username(cls, username: str) -> Optional[Dict[str, Any]]:
        doc = cls._col().find_one({"username": username})
        if doc:
            return _serialize_user(doc)
        doc = cls._col().find_one({"fullName": username})
        return _serialize_user(doc)

    @classmethod
    def update(cls, user_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        mongo_updates: Dict[str, Any] = {"updatedAt": datetime.utcnow()}
        field_map = {
            "fullName": "fullName",
            "full_name": "fullName",
            "username": "username",
            "email": "email",
            "password": "password",
            "role": "role",
            "profileImage": "profileImage",
            "profile_image": "profileImage",
            "provider": "provider",
            "googleSub": "googleSub",
            "google_sub": "googleSub",
            "lastLoginAt": "lastLoginAt",
            "last_login_at": "lastLoginAt",
            # New fields mapping
            "gender": "gender",
            "dob": "dob",
            "contact_number": "contactNumber",
            "degree": "degree",
            "branch": "branch",
            "graduation_year": "graduationYear",
            "cgpa": "cgpa",
            "skills": "skills",
            "github_url": "githubUrl",
            "linkedin_url": "linkedinUrl",
            "reset_code": "resetCode",
            "reset_code_expires": "resetCodeExpires",
        }
        for key, value in updates.items():
            if key in field_map and value is not None:
                mapped = field_map[key]
                if mapped == "email" and isinstance(value, str):
                    mongo_updates[mapped] = value.strip().lower()
                else:
                    mongo_updates[mapped] = value

        result = cls._col().find_one_and_update(
            {"id": user_id},
            {"$set": mongo_updates},
            return_document=ReturnDocument.AFTER,
        )
        return _serialize_user(result)

    @classmethod
    def delete(cls, user_id: str) -> bool:
        result = cls._col().delete_one({"id": user_id})
        return result.deleted_count > 0

    @classmethod
    def list_all(cls) -> List[Dict[str, Any]]:
        docs = cls._col().find().sort("createdAt", -1)
        return [_serialize_user(d) for d in docs if d]

    @classmethod
    def count(cls) -> int:
        return cls._col().count_documents({})

    @classmethod
    def count_by_provider(cls, provider: str) -> int:
        return cls._col().count_documents({"provider": provider})

    @classmethod
    def count_by_role(cls, role: str) -> int:
        return cls._col().count_documents({"role": role})

    @classmethod
    def get_raw_by_id(cls, user_id: str) -> Optional[Dict[str, Any]]:
        return cls._col().find_one({"id": user_id})

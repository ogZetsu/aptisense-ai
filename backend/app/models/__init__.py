"""Pydantic models for MongoDB documents."""
from app.models.user import UserCreate, UserUpdate, UserDocument
from app.models.question import QuestionDocument
from app.models.user_progress import UserProgressDocument, UserProgressUpdate
from app.models.attempt import AttemptDocument, AttemptCreate

__all__ = [
    "UserCreate",
    "UserUpdate",
    "UserDocument",
    "QuestionDocument",
    "UserProgressDocument",
    "UserProgressUpdate",
    "AttemptDocument",
    "AttemptCreate",
]

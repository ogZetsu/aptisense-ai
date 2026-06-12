"""User progress document models."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class UserProgressUpdate(BaseModel):
    current_set: Optional[int] = None
    current_question: Optional[int] = None
    completed_sets: Optional[List[int]] = None


class UserProgressDocument(BaseModel):
    userId: str
    category: str
    level: int = 1
    currentSet: int = 1
    currentQuestion: int = 0
    completedSets: List[int] = Field(default_factory=list)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

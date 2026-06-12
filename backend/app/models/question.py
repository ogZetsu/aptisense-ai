"""Question document models."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class QuestionDocument(BaseModel):
    question: str
    options: List[str]
    correctAnswer: str
    explanation: Optional[str] = None
    category: str
    level: int = 1
    topic: Optional[str] = None
    difficulty: str = "Easy"
    createdAt: datetime = Field(default_factory=datetime.utcnow)

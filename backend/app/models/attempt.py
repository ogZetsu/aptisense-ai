"""Attempt document models."""

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class AttemptCreate(BaseModel):
    user_id: str
    category: str
    level: int = 1
    score: int
    total_questions: int
    accuracy: float
    time_taken: int = 0
    attention_score: float = 0.0
    suspicious_count: int = 0
    tab_switches: int = 0
    analysis: Optional[Dict[str, Any]] = None


class AttemptDocument(BaseModel):
    userId: str
    category: str
    level: int = 1
    score: int
    totalQuestions: int
    accuracy: float
    timeTaken: int = 0
    completedAt: datetime = Field(default_factory=datetime.utcnow)
    attentionScore: float = 0.0
    suspiciousCount: int = 0
    tabSwitches: int = 0
    analysis: Optional[Dict[str, Any]] = None

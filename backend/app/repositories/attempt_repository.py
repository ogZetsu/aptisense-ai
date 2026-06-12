"""Attempt repository — MongoDB CRUD."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from bson import ObjectId

from app.db.connection import get_database


def _serialize_attempt(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return None
    completed = doc.get("completedAt")
    attempt_id = str(doc.get("_id", doc.get("attemptId", "")))
    return {
        "attempt_id": attempt_id,
        "user_id": doc.get("userId"),
        "category": doc.get("category"),
        "level": doc.get("level", 1),
        "set_number": doc.get("setNumber", 1),
        "score": doc.get("score", 0),
        "total_questions": doc.get("totalQuestions", 0),
        "percentage": doc.get("accuracy", 0),
        "accuracy": doc.get("accuracy", 0),
        "time_taken": doc.get("timeTaken", 0),
        "attention_score": doc.get("attentionScore", 0),
        "suspicious_count": doc.get("suspiciousCount", 0),
        "tab_switches": doc.get("tabSwitches", 0),
        "analysis": doc.get("analysis"),
        "timestamp": completed.isoformat() if hasattr(completed, "isoformat") else completed,
        "completed_at": completed.isoformat() if hasattr(completed, "isoformat") else completed,
        "questions": doc.get("questions", []),
        "user_answers": doc.get("userAnswers", {}),
        "userAnswers": doc.get("userAnswers", {}),
    }


class AttemptRepository:
    COLLECTION = "attempts"

    @classmethod
    def _col(cls):
        return get_database()[cls.COLLECTION]

    @classmethod
    def create(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        now = datetime.utcnow()
        total = data.get("totalQuestions") or data.get("total_questions", 0)
        score = data.get("score", 0)
        accuracy = data.get("accuracy")
        if accuracy is None and total > 0:
            accuracy = round((score / total) * 100, 2)

        doc = {
            "userId": data["userId"] if "userId" in data else data["user_id"],
            "category": data["category"],
            "level": data.get("level", 1),
            "setNumber": data.get("setNumber") or data.get("set_number", 1),
            "score": score,
            "totalQuestions": total,
            "accuracy": accuracy or 0,
            "timeTaken": data.get("timeTaken") or data.get("time_taken", 0),
            "completedAt": now,
            "attentionScore": data.get("attentionScore") or data.get("attention_score", 0),
            "suspiciousCount": data.get("suspiciousCount") or data.get("suspicious_count", 0),
            "tabSwitches": data.get("tabSwitches") or data.get("tab_switches", 0),
            "analysis": data.get("analysis"),
            "questions": data.get("questions", []),
            "userAnswers": data.get("userAnswers") or data.get("user_answers", {}),
        }
        result = cls._col().insert_one(doc)
        doc["_id"] = result.inserted_id
        return _serialize_attempt(doc)

    @classmethod
    def find_by_id(cls, attempt_id: str) -> Optional[Dict[str, Any]]:
        try:
            doc = cls._col().find_one({"_id": ObjectId(attempt_id)})
        except Exception:
            return None
        return _serialize_attempt(doc)

    @classmethod
    def find_by_user(cls, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        docs = cls._col().find({"userId": user_id}).sort("completedAt", -1).limit(limit)
        return [_serialize_attempt(d) for d in docs if d]

    @classmethod
    def count_all(cls) -> int:
        return cls._col().count_documents({})

    @classmethod
    def count_by_user(cls, user_id: str) -> int:
        return cls._col().count_documents({"userId": user_id})

    @classmethod
    def delete_by_user(cls, user_id: str) -> int:
        result = cls._col().delete_many({"userId": user_id})
        return result.deleted_count

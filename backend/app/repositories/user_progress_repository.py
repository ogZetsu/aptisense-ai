"""User progress repository — MongoDB CRUD."""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pymongo import ReturnDocument

from app.db.connection import get_database


class UserProgressRepository:
    COLLECTION = "userProgress"

    @classmethod
    def _col(cls):
        return get_database()[cls.COLLECTION]

    @classmethod
    def get_or_create(cls, user_id: str, category: str, level: int = 1) -> Dict[str, Any]:
        doc = cls._col().find_one({"userId": user_id, "category": category, "level": level})
        if doc:
            doc.pop("_id", None)
            # Ensure default fields exist for legacy documents
            doc["currentAnswers"] = doc.get("currentAnswers", {})
            doc["completedQuestions"] = doc.get("completedQuestions", [])
            doc["progressPercentage"] = doc.get("progressPercentage", 0.0)
            doc["completedSets"] = doc.get("completedSets", [])
            return doc

        now = datetime.utcnow()
        doc = {
            "userId": user_id,
            "category": category,
            "level": level,
            "currentSet": 1,
            "currentQuestion": 0,
            "currentAnswers": {},
            "completedSets": [],
            "completedQuestions": [],
            "progressPercentage": 0.0,
            "updatedAt": now,
        }
        cls._col().insert_one(doc)
        doc.pop("_id", None)
        return doc

    @classmethod
    def update(cls, user_id: str, category: str, level: int, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        mongo_updates: Dict[str, Any] = {"updatedAt": datetime.utcnow()}
        field_map = {
            "currentSet": "currentSet",
            "current_set": "currentSet",
            "currentQuestion": "currentQuestion",
            "current_question": "currentQuestion",
            "completedSets": "completedSets",
            "completed_sets": "completedSets",
            "currentAnswers": "currentAnswers",
            "current_answers": "currentAnswers",
            "completedQuestions": "completedQuestions",
            "completed_questions": "completedQuestions",
            "progressPercentage": "progressPercentage",
            "progress_percentage": "progressPercentage",
        }
        for key, value in updates.items():
            if key in field_map and value is not None:
                mongo_updates[field_map[key]] = value

        result = cls._col().find_one_and_update(
            {"userId": user_id, "category": category, "level": level},
            {"$set": mongo_updates},
            return_document=ReturnDocument.AFTER,
        )
        if result:
            result.pop("_id", None)
            result["currentAnswers"] = result.get("currentAnswers", {})
            result["completedQuestions"] = result.get("completedQuestions", [])
            result["progressPercentage"] = result.get("progressPercentage", 0.0)
            result["completedSets"] = result.get("completedSets", [])
        return result

    @classmethod
    def find_by_user(cls, user_id: str) -> List[Dict[str, Any]]:
        docs = cls._col().find({"userId": user_id}).sort("updatedAt", -1)
        results = []
        for doc in docs:
            doc.pop("_id", None)
            results.append(doc)
        return results

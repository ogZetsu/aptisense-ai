"""Question repository — MongoDB CRUD."""

from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId

from app.db.connection import get_database


def _to_api_question(doc: Dict[str, Any], index: int = 0) -> Dict[str, Any]:
    """Convert MongoDB question to frontend-compatible format."""
    return {
        "id": str(doc.get("_id", index)),
        "question": doc.get("question", ""),
        "options": doc.get("options", []),
        "answer": doc.get("correctAnswer", ""),
        "correctAnswer": doc.get("correctAnswer", ""),
        "explanation": doc.get("explanation", ""),
        "category": doc.get("category", ""),
        "level": doc.get("level", 1),
        "topic": doc.get("topic", ""),
        "difficulty": doc.get("difficulty", "Easy"),
    }


class QuestionRepository:
    COLLECTION = "questions"

    @classmethod
    def _col(cls):
        return get_database()[cls.COLLECTION]

    @classmethod
    def insert_many(cls, questions: List[Dict[str, Any]]) -> int:
        if not questions:
            return 0
        now = datetime.utcnow()
        docs = []
        for q in questions:
            docs.append({
                "question": q["question"],
                "options": q.get("options", []),
                "correctAnswer": q.get("correctAnswer") or q.get("answer", ""),
                "explanation": q.get("explanation", ""),
                "category": q["category"],
                "level": q.get("level", 1),
                "topic": q.get("topic", q.get("company", "")),
                "difficulty": q.get("difficulty", "Easy"),
                "createdAt": now,
            })
        result = cls._col().insert_many(docs)
        return len(result.inserted_ids)

    @classmethod
    def find_by_category(cls, category: str, level: Optional[int] = None) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {"category": category}
        if level is not None:
            query["level"] = level
        docs = list(cls._col().find(query).sort("createdAt", 1))
        return [_to_api_question(d, i + 1) for i, d in enumerate(docs)]

    @classmethod
    def count_by_category(cls, category: str) -> int:
        return cls._col().count_documents({"category": category})

    @classmethod
    def count_all(cls) -> int:
        return cls._col().count_documents({})

    @classmethod
    def delete_by_category(cls, category: str) -> int:
        result = cls._col().delete_many({"category": category})
        return result.deleted_count

    @classmethod
    def find_by_id(cls, question_id: str) -> Optional[Dict[str, Any]]:
        try:
            doc = cls._col().find_one({"_id": ObjectId(question_id)})
        except Exception:
            return None
        return _to_api_question(doc) if doc else None

    @classmethod
    def find_all_paginated(
        cls,
        skip: int = 0,
        limit: int = 10,
        search: str = "",
        category: str = "",
        level: Optional[int] = None,
        sort_by: str = "createdAt",
        sort_order: int = -1,
    ) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {}
        if search:
            query["question"] = {"$regex": search, "$options": "i"}
        if category:
            query["category"] = category
        if level is not None:
            query["level"] = level

        sort_field = sort_by if sort_by in ["question", "category", "level", "difficulty", "topic", "createdAt"] else "createdAt"
        docs = list(cls._col().find(query).sort(sort_field, sort_order).skip(skip).limit(limit))
        return [_to_api_question(d) for d in docs]

    @classmethod
    def count_paginated(
        cls,
        search: str = "",
        category: str = "",
        level: Optional[int] = None,
    ) -> int:
        query: Dict[str, Any] = {}
        if search:
            query["question"] = {"$regex": search, "$options": "i"}
        if category:
            query["category"] = category
        if level is not None:
            query["level"] = level
        return cls._col().count_documents(query)

    @classmethod
    def create_question(cls, q: Dict[str, Any]) -> Dict[str, Any]:
        now = datetime.utcnow()
        doc = {
            "question": q["question"],
            "options": q.get("options", []),
            "correctAnswer": q.get("correctAnswer") or q.get("answer", ""),
            "explanation": q.get("explanation", ""),
            "category": q["category"],
            "level": q.get("level", 1),
            "topic": q.get("topic", ""),
            "difficulty": q.get("difficulty", "Easy"),
            "createdAt": now,
        }
        result = cls._col().insert_one(doc)
        doc["_id"] = result.inserted_id
        return _to_api_question(doc)

    @classmethod
    def update_question(cls, question_id: str, q: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            obj_id = ObjectId(question_id)
        except Exception:
            return None

        updates: Dict[str, Any] = {}
        fields = ["question", "options", "explanation", "category", "level", "topic", "difficulty"]
        for f in fields:
            if f in q:
                updates[f] = q[f]
        
        correct_ans = q.get("correctAnswer") or q.get("answer")
        if correct_ans is not None:
            updates["correctAnswer"] = correct_ans

        if not updates:
            return cls.find_by_id(question_id)

        from pymongo import ReturnDocument
        result = cls._col().find_one_and_update(
            {"_id": obj_id},
            {"$set": updates},
            return_document=ReturnDocument.AFTER
        )
        return _to_api_question(result) if result else None

    @classmethod
    def delete_question(cls, question_id: str) -> bool:
        try:
            obj_id = ObjectId(question_id)
        except Exception:
            return False
        result = cls._col().delete_one({"_id": obj_id})
        return result.deleted_count > 0

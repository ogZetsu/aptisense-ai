"""Seed aptitude questions into MongoDB Atlas."""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.config import settings
from app.db.connection import connect_mongodb
from app.db.indexes import ensure_indexes
from app.repositories.question_repository import QuestionRepository

CATEGORIES = ["numerical", "verbal", "reasoning", "advanced_quant", "advanced_coding"]


def main(force: bool = False):
    connect_mongodb()
    ensure_indexes()

    aptitude_dir = os.path.join(settings.DATA_DIR, "aptitude")
    total = 0

    for category in CATEGORIES:
        if force:
            deleted = QuestionRepository.delete_by_category(category)
            print(f"Cleared {deleted} existing questions for '{category}'")

        if not force and QuestionRepository.count_by_category(category) > 0:
            print(f"Skipping '{category}' — already seeded ({QuestionRepository.count_by_category(category)} questions)")
            continue

        file_path = os.path.join(aptitude_dir, f"{category}.json")
        if not os.path.isfile(file_path):
            print(f"Warning: {file_path} not found")
            continue

        with open(file_path, "r", encoding="utf-8") as f:
            questions = json.load(f)

        payload = []
        for q in questions:
            payload.append({
                "question": q.get("question", ""),
                "options": q.get("options", []),
                "correctAnswer": q.get("answer") or q.get("correctAnswer", ""),
                "explanation": q.get("explanation", ""),
                "category": category,
                "level": q.get("level", 1),
                "topic": q.get("topic") or q.get("company", category),
                "difficulty": q.get("difficulty", "Easy"),
            })

        inserted = QuestionRepository.insert_many(payload)
        total += inserted
        print(f"Seeded {inserted} questions for '{category}'")

    print(f"\nDone. Total questions in DB: {QuestionRepository.count_all()} (inserted this run: {total})")


if __name__ == "__main__":
    force_flag = "--force" in sys.argv
    main(force=force_flag)

"""Test MongoDB CRUD operations for all collections."""

import os
import sys
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.connection import connect_mongodb
from app.db.indexes import ensure_indexes
from app.repositories.attempt_repository import AttemptRepository
from app.repositories.question_repository import QuestionRepository
from app.repositories.user_progress_repository import UserProgressRepository
from app.repositories.user_repository import UserRepository
from passlib.context import CryptContext

PWD_CTX = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def run_tests():
    connect_mongodb()
    ensure_indexes()

    results = []
    test_email = f"crud-test-{uuid.uuid4().hex[:8]}@example.com"
    user_id = None

    # CREATE user
    try:
        user = UserRepository.create({
            "fullName": "CRUD Test User",
            "email": test_email,
            "password": PWD_CTX.hash("TestPass123!"),
            "provider": "email",
            "role": "user",
        })
        user_id = user["user_id"]
        results.append(("CREATE user", True, user_id))
    except Exception as exc:
        results.append(("CREATE user", False, str(exc)))
        return results

    # READ user
    try:
        found = UserRepository.find_by_email(test_email)
        ok = found and found["user_id"] == user_id
        results.append(("READ user by email", ok, found.get("email") if found else None))
    except Exception as exc:
        results.append(("READ user by email", False, str(exc)))

    # UPDATE user
    try:
        updated = UserRepository.update(user_id, {"full_name": "Updated Name"})
        ok = updated and updated.get("full_name") == "Updated Name"
        results.append(("UPDATE user profile", ok, updated.get("full_name") if updated else None))
    except Exception as exc:
        results.append(("UPDATE user profile", False, str(exc)))

    # READ questions
    try:
        questions = QuestionRepository.find_by_category("numerical")
        results.append(("READ questions", len(questions) > 0, f"{len(questions)} questions"))
    except Exception as exc:
        results.append(("READ questions", False, str(exc)))

    # CREATE userProgress
    try:
        progress = UserProgressRepository.get_or_create(user_id, "numerical", 1)
        ok = progress.get("userId") == user_id
        results.append(("CREATE userProgress", ok, progress.get("category")))
    except Exception as exc:
        results.append(("CREATE userProgress", False, str(exc)))

    # UPDATE userProgress
    try:
        updated_prog = UserProgressRepository.update(user_id, "numerical", 1, {"currentQuestion": 3})
        ok = updated_prog and updated_prog.get("currentQuestion") == 3
        results.append(("UPDATE userProgress", ok, updated_prog.get("currentQuestion") if updated_prog else None))
    except Exception as exc:
        results.append(("UPDATE userProgress", False, str(exc)))

    # CREATE attempt
    attempt_id = None
    try:
        attempt = AttemptRepository.create({
            "user_id": user_id,
            "category": "numerical",
            "level": 1,
            "score": 4,
            "total_questions": 5,
            "accuracy": 80.0,
            "time_taken": 120,
        })
        attempt_id = attempt.get("attempt_id")
        results.append(("CREATE attempt", bool(attempt_id), attempt_id))
    except Exception as exc:
        results.append(("CREATE attempt", False, str(exc)))

    # READ attempt
    if attempt_id:
        try:
            found_attempt = AttemptRepository.find_by_id(attempt_id)
            ok = found_attempt and found_attempt.get("user_id") == user_id
            results.append(("READ attempt", ok, found_attempt.get("score") if found_attempt else None))
        except Exception as exc:
            results.append(("READ attempt", False, str(exc)))

    # DELETE user (cleanup)
    try:
        deleted = UserRepository.delete(user_id)
        AttemptRepository.delete_by_user(user_id)
        results.append(("DELETE user", deleted, user_id))
    except Exception as exc:
        results.append(("DELETE user", False, str(exc)))

    return results


def main():
    print("=" * 60)
    print("MongoDB CRUD Test Suite — AptiSense AI")
    print("=" * 60)

    results = run_tests()
    passed = sum(1 for _, ok, _ in results if ok)
    failed = len(results) - passed

    for name, ok, detail in results:
        status = "PASS" if ok else "FAIL"
        print(f"  [{status}] {name}: {detail}")

    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed out of {len(results)}")
    print("=" * 60)
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()

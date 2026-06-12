"""Database startup: connect, index, migrate, seed."""

import json
import logging
import os
from datetime import datetime

from app.core.config import settings
from app.db.connection import connect_mongodb
from app.db.indexes import ensure_indexes
from app.repositories.question_repository import QuestionRepository
from app.repositories.user_repository import UserRepository

logger = logging.getLogger("app.mongodb")

APTITUDE_CATEGORIES = [
    "numerical",
    "verbal",
    "reasoning",
    "advanced_quant",
    "advanced_coding",
]


def _migrate_json_users() -> int:
    """Import legacy JSON users into MongoDB if collection is empty."""
    if UserRepository.count() > 0:
        return 0

    users_dir = os.path.join(settings.DATA_DIR, "users")
    if not os.path.isdir(users_dir):
        return 0

    migrated = 0
    seen_ids = set()

    for filename in os.listdir(users_dir):
        if filename in {"google_index.json", "email_index.json"}:
            continue
        if not filename.endswith(".json"):
            continue

        path = os.path.join(users_dir, filename)
        try:
            with open(path, "r", encoding="utf-8") as f:
                legacy = json.load(f)
        except Exception:
            continue

        user_id = legacy.get("user_id")
        if not user_id or user_id in seen_ids:
            continue
        seen_ids.add(user_id)

        email = (legacy.get("email") or "").strip().lower()
        if not email:
            continue

        if UserRepository.find_by_email(email):
            continue

        try:
            UserRepository.create({
                "id": user_id,
                "fullName": legacy.get("full_name") or legacy.get("username") or email.split("@")[0],
                "email": email,
                "password": legacy.get("password_hash"),
                "role": legacy.get("role", "user"),
                "provider": legacy.get("auth_provider", "email"),
                "googleSub": legacy.get("google_sub"),
                "username": legacy.get("username") or legacy.get("full_name"),
            })
            migrated += 1
        except Exception as exc:
            logger.warning("Skipped user migration for %s: %s", email, exc)

    if migrated:
        logger.info("Migrated %d legacy users to MongoDB", migrated)
    return migrated


def _seed_aptitude_questions() -> int:
    """Seed aptitude questions from JSON files if MongoDB collection is empty."""
    if QuestionRepository.count_all() > 0:
        return 0

    aptitude_dir = os.path.join(settings.DATA_DIR, "aptitude")
    if not os.path.isdir(aptitude_dir):
        logger.warning("Aptitude data directory not found: %s", aptitude_dir)
        return 0

    total = 0
    for category in APTITUDE_CATEGORIES:
        file_path = os.path.join(aptitude_dir, f"{category}.json")
        if not os.path.isfile(file_path):
            continue
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                questions = json.load(f)
        except Exception as exc:
            logger.warning("Failed to read %s: %s", file_path, exc)
            continue

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
        logger.info("Seeded %d questions for category '%s'", inserted, category)

    return total


def _seed_activity_logs() -> int:
    """Seed mock activity logs for analytics visualization if collection is empty."""
    from app.repositories.activity_log_repository import ActivityLogRepository
    
    # Check if already seeded
    if ActivityLogRepository._col().count_documents({}) > 0:
        return 0
        
    import random
    from datetime import datetime, timedelta
    
    logger.info("Seeding mock activity logs for admin dashboard visualization...")
    
    features = [
        ("Aptitude Practice", ["view_categories", "save_progress", "submit_attempt"]),
        ("Mock Interview", ["start_session", "submit_answer"]),
        ("Dashboard View", ["view_categories", "view_attempts"]),
        ("Authentication", ["login", "signup"]),
        ("Study Session", ["start_study", "complete_topic"]),
        ("Profile", ["view_profile", "update_profile"])
    ]
    
    # Try to load registered users dynamically, otherwise fall back to dummy users
    registered_users = UserRepository.list_all()
    if registered_users:
        users_pool = [
            {"userId": u["id"], "username": u["username"]}
            for u in registered_users
        ]
    else:
        users_pool = [
            {"userId": "user_1", "username": "palraj_dev"},
            {"userId": "user_2", "username": "saimeen_mca"},
            {"userId": "user_3", "username": "gautam_mca"},
            {"userId": "user_4", "username": "guest_user"}
        ]
    
    categories = ["numerical", "verbal", "reasoning", "advanced_quant", "advanced_coding"]
    
    now = datetime.utcnow()
    logs_to_insert = []
    
    # We will generate about 600 logs distributed over the past year
    # A higher density in the last 30 days
    for i in range(600):
        # Choose a random user
        user = random.choice(users_pool)
        
        # Determine age of the log (log distribution)
        roll = random.random()
        if roll < 0.15: # 15% in the last 24 hours
            days_ago = random.uniform(0, 1)
        elif roll < 0.45: # 30% in the last 7 days
            days_ago = random.uniform(1, 7)
        elif roll < 0.70: # 25% in the last 30 days
            days_ago = random.uniform(7, 30)
        else: # 30% in the remaining year
            days_ago = random.uniform(30, 365)
            
        timestamp = now - timedelta(days=days_ago)
        
        # Choose a random feature
        feature, actions = random.choice(features)
        action = random.choice(actions)
        
        meta = {}
        if feature == "Aptitude Practice":
            meta = {
                "category": random.choice(categories),
                "level": random.choice([1, 2, 3, 4]),
                "set": random.randint(1, 10)
            }
            if action == "submit_attempt":
                meta["score"] = random.randint(5, 10)
                meta["accuracy"] = meta["score"] * 10.0
        elif feature == "Mock Interview":
            meta = {
                "interview_type": f"mock_{random.choice(['hr', 'technical', 'behavioral', 'communication'])}",
                "position": "Software Engineer Practice"
            }
            
        logs_to_insert.append({
            "userId": user["userId"],
            "username": user["username"],
            "feature": feature,
            "action": action,
            "timestamp": timestamp,
            "meta": meta
        })
        
    ActivityLogRepository._col().insert_many(logs_to_insert)
    logger.info("Successfully seeded %d activity logs", len(logs_to_insert))
    return len(logs_to_insert)


def initialize_database() -> None:
    """Full database initialization on application startup."""
    connect_mongodb()
    ensure_indexes()
    users_migrated = _migrate_json_users()
    questions_seeded = _seed_aptitude_questions()
    logs_seeded = _seed_activity_logs()
    logger.info(
        "Database ready at %s — users migrated: %d, questions seeded: %d, logs seeded: %d",
        datetime.utcnow().isoformat(),
        users_migrated,
        questions_seeded,
        logs_seeded,
    )


"""Migrate legacy JSON users to MongoDB Atlas."""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.config import settings
from app.db.connection import connect_mongodb
from app.db.indexes import ensure_indexes
from app.repositories.user_repository import UserRepository


def main():
    connect_mongodb()
    ensure_indexes()

    users_dir = os.path.join(settings.DATA_DIR, "users")
    migrated = 0
    skipped = 0
    seen_ids = set()

    for filename in os.listdir(users_dir):
        if filename in {"google_index.json", "email_index.json"}:
            continue
        if not filename.endswith(".json"):
            continue

        path = os.path.join(users_dir, filename)
        with open(path, "r", encoding="utf-8") as f:
            legacy = json.load(f)

        user_id = legacy.get("user_id")
        email = (legacy.get("email") or "").strip().lower()

        if not user_id or user_id in seen_ids:
            skipped += 1
            continue
        seen_ids.add(user_id)

        if not email:
            print(f"Skip {filename}: no email")
            skipped += 1
            continue

        if UserRepository.find_by_email(email):
            print(f"Skip {email}: already in MongoDB")
            skipped += 1
            continue

        UserRepository.create({
            "id": user_id,
            "fullName": legacy.get("full_name") or legacy.get("username") or email.split("@")[0],
            "email": email,
            "password": legacy.get("password_hash"),
            "role": legacy.get("role", "user"),
            "provider": legacy.get("auth_provider", "email"),
            "googleSub": legacy.get("google_sub"),
            "username": legacy.get("username"),
        })
        migrated += 1
        print(f"Migrated: {email} ({legacy.get('role', 'user')})")

    print(f"\nDone. Migrated: {migrated}, Skipped: {skipped}, Total in DB: {UserRepository.count()}")


if __name__ == "__main__":
    main()

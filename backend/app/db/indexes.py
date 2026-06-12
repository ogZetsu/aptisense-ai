"""Create MongoDB indexes on startup."""

import logging

from app.db.connection import get_database

logger = logging.getLogger("app.mongodb")


def ensure_indexes() -> None:
    """Ensure all required collection indexes exist."""
    db = get_database()

    db.users.create_index("email", unique=True, sparse=True)
    
    # Use partialFilterExpression to ignore documents where googleSub is null or missing,
    # preventing DuplicateKeyErrors for email/password signup users.
    try:
        info = db.users.index_information()
        if "googleSub_1" in info:
            idx = info["googleSub_1"]
            if "partialFilterExpression" not in idx:
                db.users.drop_index("googleSub_1")
    except Exception:
        pass

    db.users.create_index(
        "googleSub",
        unique=True,
        partialFilterExpression={"googleSub": {"$type": "string"}}
    )
    db.users.create_index("role")

    db.questions.create_index([("category", 1), ("level", 1)])
    db.questions.create_index([("category", 1), ("difficulty", 1)])
    db.questions.create_index("topic")

    db.userProgress.create_index([("userId", 1), ("category", 1), ("level", 1)], unique=True)
    db.userProgress.create_index("userId")

    db.attempts.create_index([("userId", 1), ("completedAt", -1)])
    db.attempts.create_index([("userId", 1), ("category", 1)])

    db.activityLogs.create_index([("timestamp", 1)])
    db.activityLogs.create_index("feature")

    logger.info("MongoDB indexes ensured")


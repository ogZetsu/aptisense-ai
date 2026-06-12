"""MongoDB Atlas connection management."""

import logging
from typing import Optional

from pymongo import MongoClient
from pymongo.database import Database

from app.core.config import settings

logger = logging.getLogger("app.mongodb")

_client: Optional[MongoClient] = None
_database: Optional[Database] = None


def connect_mongodb() -> Database:
    """Connect to MongoDB Atlas and return the database handle."""
    global _client, _database

    if _database is not None:
        return _database

    if not settings.MONGODB_URI:
        raise RuntimeError("MONGODB_URI is not configured")

    try:
        _client = MongoClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=10000,
            connectTimeoutMS=10000,
        )
        _client.admin.command("ping")
        _database = _client[settings.MONGODB_DB_NAME]
        logger.info("MongoDB Connected Successfully")
        print("MongoDB Connected Successfully")
        return _database
    except Exception as exc:
        logger.error("MongoDB Connection Failed: %s", exc)
        print(f"MongoDB Connection Failed: {exc}")
        raise


def get_database() -> Database:
    """Return the active database, connecting if needed."""
    if _database is None:
        return connect_mongodb()
    return _database


def close_mongodb() -> None:
    """Close the MongoDB client."""
    global _client, _database
    if _client is not None:
        _client.close()
        _client = None
        _database = None
        logger.info("MongoDB connection closed")

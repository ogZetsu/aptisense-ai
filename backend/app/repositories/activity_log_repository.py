"""Activity logs repository — MongoDB CRUD."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from app.db.connection import get_database

class ActivityLogRepository:
    COLLECTION = "activityLogs"

    @classmethod
    def _col(cls):
        return get_database()[cls.COLLECTION]

    @classmethod
    def log(cls, user_id: Optional[str], username: Optional[str], feature: str, action: str, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Insert an activity log."""
        doc = {
            "userId": user_id,
            "username": username or "Anonymous",
            "feature": feature,
            "action": action,
            "timestamp": datetime.utcnow(),
            "meta": meta or {}
        }
        cls._col().insert_one(doc)
        doc["_id"] = str(doc["_id"])
        return doc

    @classmethod
    def get_analytics(cls, start_date: datetime, end_date: datetime) -> List[Dict[str, Any]]:
        """Retrieve all logs between two dates."""
        cursor = cls._col().find({
            "timestamp": {
                "$gte": start_date,
                "$lte": end_date
            }
        }).sort("timestamp", -1)
        
        results = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if isinstance(doc.get("timestamp"), datetime):
                doc["timestamp"] = doc["timestamp"].isoformat()
            results.append(doc)
        return results

    @classmethod
    def aggregate_features(cls, start_date: datetime, end_date: datetime) -> List[Dict[str, Any]]:
        """Group logs by feature and count usage."""
        pipeline = [
            {
                "$match": {
                    "timestamp": {
                        "$gte": start_date,
                        "$lte": end_date
                    }
                }
            },
            {
                "$group": {
                    "_id": "$feature",
                    "count": {"$sum": 1}
                }
            },
            {
                "$sort": {"count": -1}
            }
        ]
        res = list(cls._col().aggregate(pipeline))
        # Format for output
        return [{"feature": item["_id"], "count": item["count"]} for item in res]

    @classmethod
    def get_active_users_count(cls, start_date: datetime, end_date: datetime) -> int:
        """Count unique active users who performed actions."""
        pipeline = [
            {
                "$match": {
                    "timestamp": {
                        "$gte": start_date,
                        "$lte": end_date
                    },
                    "userId": {"$ne": None}
                }
            },
            {
                "$group": {
                    "_id": "$userId"
                }
            },
            {
                "$count": "active_users"
            }
        ]
        res = list(cls._col().aggregate(pipeline))
        return res[0]["active_users"] if res else 0

    @classmethod
    def get_daily_trends(cls, start_date: datetime, end_date: datetime) -> List[Dict[str, Any]]:
        """Aggregate daily active actions count."""
        pipeline = [
            {
                "$match": {
                    "timestamp": {
                        "$gte": start_date,
                        "$lte": end_date
                    }
                }
            },
            {
                "$project": {
                    "date": {
                        "$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}
                    }
                }
            },
            {
                "$group": {
                    "_id": "$date",
                    "count": {"$sum": 1}
                }
            },
            {
                "$sort": {"_id": 1}
            }
        ]
        res = list(cls._col().aggregate(pipeline))
        return [{"date": item["_id"], "actions": item["count"]} for item in res]

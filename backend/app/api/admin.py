"""Admin endpoints — backed by MongoDB Atlas."""

import os
import csv
import io
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse

from app.api.auth import get_current_user_from_header
from app.core.config import settings
from app.repositories.attempt_repository import AttemptRepository
from app.repositories.question_repository import QuestionRepository
from app.repositories.user_repository import UserRepository
from app.repositories.activity_log_repository import ActivityLogRepository

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _require_admin(current_user: dict | None = Depends(get_current_user_from_header)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    user = UserRepository.find_by_id(current_user.get("user_id"))
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def _public_user(user: dict) -> dict:
    return {
        "user_id": user.get("user_id"),
        "username": user.get("username"),
        "email": user.get("email"),
        "full_name": user.get("full_name"),
        "role": user.get("role", "user"),
        "auth_provider": user.get("auth_provider") or user.get("provider", "email"),
        "created_at": user.get("created_at"),
        "last_login_at": user.get("last_login_at"),
    }


def _count_sessions() -> int:
    sessions_dir = os.path.join(settings.DATA_DIR, "sessions")
    if not os.path.isdir(sessions_dir):
        return 0
    return len([f for f in os.listdir(sessions_dir) if f.endswith(".json") and not f.endswith(".memory.json")])


class QuestionPayload(BaseModel):
    question: str
    options: List[str]
    correctAnswer: str
    explanation: Optional[str] = ""
    category: str
    level: int
    topic: Optional[str] = ""
    difficulty: Optional[str] = "Easy"


@router.get("/stats")
def admin_stats(_admin=Depends(_require_admin)):
    return {
        "total_users": UserRepository.count(),
        "admin_users": UserRepository.count_by_role("admin"),
        "google_users": UserRepository.count_by_provider("google"),
        "email_users": UserRepository.count_by_provider("email"),
        "total_interviews": _count_sessions(),
        "total_aptitude_attempts": AttemptRepository.count_all(),
        "total_questions": QuestionRepository.count_all(),
        "generated_at": datetime.utcnow().isoformat(),
    }


@router.get("/users")
def list_users(_admin=Depends(_require_admin)):
    users = UserRepository.list_all()
    return {"users": [_public_user(u) for u in users]}


@router.patch("/users/{user_id}/role")
def update_user_role(user_id: str, payload: dict, admin=Depends(_require_admin)):
    target = UserRepository.find_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    new_role = payload.get("role")
    if new_role not in {"user", "admin"}:
        raise HTTPException(status_code=400, detail="Role must be 'user' or 'admin'")

    if target.get("user_id") == admin.get("user_id") and new_role != "admin":
        raise HTTPException(status_code=400, detail="You cannot remove your own admin role")

    user = UserRepository.update(user_id, {"role": new_role})
    return {"user": _public_user(user)}


@router.delete("/users/{user_id}")
def delete_user(user_id: str, admin=Depends(_require_admin)):
    if user_id == admin.get("user_id"):
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    if not UserRepository.find_by_id(user_id):
        raise HTTPException(status_code=404, detail="User not found")

    UserRepository.delete(user_id)
    AttemptRepository.delete_by_user(user_id)
    return {"deleted": True, "user_id": user_id}


# --- QUESTION BANK MANAGEMENT ENDPOINTS ---

@router.get("/questions")
def list_questions(
    skip: int = 0,
    limit: int = 20,
    search: str = "",
    category: str = "",
    level: Optional[int] = None,
    sort_by: str = "createdAt",
    sort_order: int = -1,
    _admin=Depends(_require_admin)
):
    questions = QuestionRepository.find_all_paginated(
        skip=skip, limit=limit, search=search, category=category, level=level, sort_by=sort_by, sort_order=sort_order
    )
    total = QuestionRepository.count_paginated(search=search, category=category, level=level)
    return {"questions": questions, "total": total}


@router.get("/questions/{question_id}")
def get_question(question_id: str, _admin=Depends(_require_admin)):
    q = QuestionRepository.find_by_id(question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return q


@router.post("/questions")
def create_question(payload: QuestionPayload, _admin=Depends(_require_admin)):
    try:
        q = QuestionRepository.create_question(payload.dict())
        return q
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create question: {str(e)}")


@router.put("/questions/{question_id}")
def update_question(question_id: str, payload: QuestionPayload, _admin=Depends(_require_admin)):
    q = QuestionRepository.update_question(question_id, payload.dict())
    if not q:
        raise HTTPException(status_code=404, detail="Question not found or update failed")
    return q


@router.delete("/questions/{question_id}")
def delete_question(question_id: str, _admin=Depends(_require_admin)):
    success = QuestionRepository.delete_question(question_id)
    if not success:
        raise HTTPException(status_code=404, detail="Question not found or delete failed")
    return {"deleted": True, "question_id": question_id}


@router.post("/questions/import")
async def import_questions(file: UploadFile = File(...), _admin=Depends(_require_admin)):
    """Bulk import questions from CSV file."""
    content = await file.read()
    try:
        decoded = content.decode("utf-8")
    except UnicodeDecodeError:
        try:
            decoded = content.decode("latin-1")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to decode file: {str(e)}")

    reader = csv.reader(io.StringIO(decoded))
    
    # Check headers
    try:
        headers = next(reader)
    except StopIteration:
        raise HTTPException(status_code=400, detail="Empty CSV file")
        
    headers_lower = [h.strip().lower() for h in headers]
    
    required = ["question", "optiona", "optionb", "optionc", "optiond", "correctanswer"]
    for req in required:
        if req not in headers_lower:
            raise HTTPException(status_code=400, detail=f"Missing required header: '{req}'")

    def get_index(name):
        return headers_lower.index(name) if name in headers_lower else -1

    q_idx = get_index("question")
    a_idx = get_index("optiona")
    b_idx = get_index("optionb")
    c_idx = get_index("optionc")
    d_idx = get_index("optiond")
    ans_idx = get_index("correctanswer")
    exp_idx = get_index("explanation")
    cat_idx = get_index("category")
    lvl_idx = get_index("level")
    top_idx = get_index("topic")
    diff_idx = get_index("difficulty")

    category_map = {
        "numerical ability": "numerical",
        "numerical": "numerical",
        "verbal ability": "verbal",
        "verbal": "verbal",
        "reasoning ability": "reasoning",
        "reasoning": "reasoning",
        "advanced quantitative": "advanced_quant",
        "advanced_quant": "advanced_quant",
        "advanced coding": "advanced_coding",
        "advanced_coding": "advanced_coding"
    }

    level_map = {
        "basic": 1,
        "1": 1,
        "intermediate": 2,
        "2": 2,
        "advanced": 3,
        "3": 3,
        "expert": 4,
        "4": 4
    }

    imported_count = 0
    failed_count = 0
    errors = []

    questions_to_insert = []
    
    for row_num, row in enumerate(reader, start=2):
        if not row or all(not cell.strip() for cell in row):
            continue
            
        try:
            if len(row) <= max(q_idx, a_idx, b_idx, c_idx, d_idx, ans_idx):
                failed_count += 1
                errors.append(f"Row {row_num}: Incomplete options/fields")
                continue
                
            question_text = row[q_idx].strip()
            opt_a = row[a_idx].strip()
            opt_b = row[b_idx].strip()
            opt_c = row[c_idx].strip()
            opt_d = row[d_idx].strip()
            correct_ans = row[ans_idx].strip()
            
            if not question_text or not opt_a or not opt_b or not opt_c or not opt_d or not correct_ans:
                failed_count += 1
                errors.append(f"Row {row_num}: Missing required question text, options, or correct answer")
                continue
                
            explanation = row[exp_idx].strip() if exp_idx != -1 and exp_idx < len(row) else ""
            
            raw_cat = row[cat_idx].strip().lower() if cat_idx != -1 and cat_idx < len(row) else "numerical"
            category = category_map.get(raw_cat, "numerical")
            
            raw_lvl = row[lvl_idx].strip().lower() if lvl_idx != -1 and lvl_idx < len(row) else "basic"
            level = level_map.get(raw_lvl, 1)
            
            topic = row[top_idx].strip() if top_idx != -1 and top_idx < len(row) else category.replace("_", " ").capitalize()
            difficulty = row[diff_idx].strip() if diff_idx != -1 and diff_idx < len(row) else "Easy"
            
            questions_to_insert.append({
                "question": question_text,
                "options": [opt_a, opt_b, opt_c, opt_d],
                "correctAnswer": correct_ans,
                "explanation": explanation,
                "category": category,
                "level": level,
                "topic": topic,
                "difficulty": difficulty
            })
            imported_count += 1
        except Exception as ex:
            failed_count += 1
            errors.append(f"Row {row_num}: Unexpected error: {str(ex)}")

    if questions_to_insert:
        QuestionRepository.insert_many(questions_to_insert)

    return {
        "success": True,
        "imported": imported_count,
        "failed": failed_count,
        "errors": errors
    }


@router.get("/questions/export")
def export_questions(_admin=Depends(_require_admin)):
    """Export all questions as a CSV file."""
    questions = QuestionRepository.find_all_paginated(skip=0, limit=10000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "question", "optionA", "optionB", "optionC", "optionD", 
        "correctAnswer", "explanation", "category", "level", "topic", "difficulty"
    ])
    
    for q in questions:
        options = q.get("options", [])
        opt_a = options[0] if len(options) > 0 else ""
        opt_b = options[1] if len(options) > 1 else ""
        opt_c = options[2] if len(options) > 2 else ""
        opt_d = options[3] if len(options) > 3 else ""
        
        level_map = {1: "Basic", 2: "Intermediate", 3: "Advanced", 4: "Expert"}
        level_name = level_map.get(q.get("level"), "Basic")

        category_map = {
            "numerical": "Numerical Ability",
            "verbal": "Verbal Ability",
            "reasoning": "Reasoning Ability",
            "advanced_quant": "Advanced Quantitative",
            "advanced_coding": "Advanced Coding"
        }
        category_name = category_map.get(q.get("category"), q.get("category"))
        
        writer.writerow([
            q.get("question"),
            opt_a,
            opt_b,
            opt_c,
            opt_d,
            q.get("correctAnswer"),
            q.get("explanation"),
            category_name,
            level_name,
            q.get("topic"),
            q.get("difficulty")
        ])
        
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=aptisense_questions.csv"}
    )


def _aggregate_interviews_by_degree() -> list:
    import json
    sessions_dir = os.path.join(settings.DATA_DIR, "sessions")
    if not os.path.isdir(sessions_dir):
        return []
        
    # Build user_id -> degree mapping
    users = UserRepository.list_all()
    user_degree_map = {u["id"]: u.get("degree") or "Not Specified" for u in users}
    
    degree_scores = {}
    for filename in os.listdir(sessions_dir):
        if not filename.endswith(".json") or filename.endswith(".memory.json"):
            continue
        path = os.path.join(sessions_dir, filename)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            user_id = data.get("user_id")
            if not user_id:
                continue
            degree = user_degree_map.get(user_id, "Not Specified")
            
            # Check if evaluated and has overall_score
            evaluation = data.get("evaluation") or {}
            score = evaluation.get("overall_score")
            if score is not None:
                if degree not in degree_scores:
                    degree_scores[degree] = []
                degree_scores[degree].append(score)
        except Exception:
            continue
            
    result = []
    for degree, scores in degree_scores.items():
        avg_score = round(sum(scores) / len(scores), 2) if scores else 0
        result.append({
            "degree": degree,
            "avg_score": avg_score,
            "count": len(scores)
        })
    # Sort by avg_score desc
    result.sort(key=lambda x: x["avg_score"], reverse=True)
    return result


@router.get("/analytics")
def get_admin_analytics(
    timeframe: str = "7d",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    _admin=Depends(_require_admin)
):
    """Get aggregated usage analytics and feature statistics."""
    now = datetime.utcnow()
    
    # 1. Parse timeframe dates
    if timeframe == "1d":
        start = now - timedelta(days=1)
        end = now
    elif timeframe == "7d":
        start = now - timedelta(days=7)
        end = now
    elif timeframe == "15d":
        start = now - timedelta(days=15)
        end = now
    elif timeframe == "30d":
        start = now - timedelta(days=30)
        end = now
    elif timeframe == "1y":
        start = now - timedelta(days=365)
        end = now
    elif timeframe == "custom" and start_date and end_date:
        try:
            start = datetime.fromisoformat(start_date.split("T")[0])
            # Make end date include the whole day
            end = datetime.fromisoformat(end_date.split("T")[0]).replace(hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    else:
        # Default to 7 days
        start = now - timedelta(days=7)
        end = now

    # 2. Query logs
    logs = ActivityLogRepository.get_analytics(start, end)
    
    # 3. Calculate statistics
    total_actions = len(logs)
    
    # Unique active users
    active_users = len(set(log.get("userId") for log in logs if log.get("userId")))
    
    # Most used features
    feature_counts = {}
    action_counts = {}
    user_counts = {}
    
    for log in logs:
        feat = log.get("feature", "Other")
        act = log.get("action", "other")
        username = log.get("username") or log.get("userId") or "Anonymous"
        
        feature_counts[feat] = feature_counts.get(feat, 0) + 1
        action_counts[act] = action_counts.get(act, 0) + 1
        user_counts[username] = user_counts.get(username, 0) + 1
        
    most_used_features = [{"feature": f, "count": c} for f, c in sorted(feature_counts.items(), key=lambda x: x[1], reverse=True)]
    actions_breakdown = [{"action": a, "count": c} for a, c in sorted(action_counts.items(), key=lambda x: x[1], reverse=True)]
    top_users = [{"username": u, "count": c} for u, c in sorted(user_counts.items(), key=lambda x: x[1], reverse=True)[:10]]
    
    # Daily trends
    daily_trends = ActivityLogRepository.get_daily_trends(start, end)
    
    # 4. Demographic aggregates
    users_col = UserRepository._col()
    
    # Gender distribution
    gender_pipeline = [
        {"$group": {"_id": {"$ifNull": ["$gender", "Not Specified"]}, "count": {"$sum": 1}}}
    ]
    gender_dist = [{"gender": g["_id"], "count": g["count"]} for g in users_col.aggregate(gender_pipeline)]
    
    # Degree distribution
    degree_pipeline = [
        {"$group": {"_id": {"$ifNull": ["$degree", "Not Specified"]}, "count": {"$sum": 1}}}
    ]
    degree_dist = [{"degree": d["_id"], "count": d["count"]} for d in users_col.aggregate(degree_pipeline)]
    
    # Skills distribution (unwinding array of skills)
    skills_pipeline = [
        {"$project": {"skills": {"$cond": [{"$isArray": "$skills"}, "$skills", {"$cond": [{"$gt": ["$skills", None]}, ["$skills"], []]}]}}},
        {"$unwind": "$skills"},
        {"$group": {"_id": "$skills", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    skills_dist = [{"skill": s["_id"], "count": s["count"]} for s in users_col.aggregate(skills_pipeline)]
    
    # Average Aptitude Score by Degree
    from app.db.connection import get_database
    attempts_col = get_database()["attempts"]
    aptitude_by_degree_pipeline = [
        {
            "$lookup": {
                "from": "users",
                "localField": "userId",
                "foreignField": "id",
                "as": "user"
            }
        },
        {"$unwind": "$user"},
        {
            "$group": {
                "_id": {"$ifNull": ["$user.degree", "Not Specified"]},
                "avg_accuracy": {"$avg": "$accuracy"},
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"avg_accuracy": -1}}
    ]
    aptitude_by_degree = [
        {"degree": r["_id"], "avg_accuracy": round(r["avg_accuracy"], 2), "count": r["count"]}
        for r in attempts_col.aggregate(aptitude_by_degree_pipeline)
    ]
    
    # Average Interview Score by Degree
    interview_by_degree = _aggregate_interviews_by_degree()
    
    return {
        "timeframe": timeframe,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "total_actions": total_actions,
        "active_users": active_users,
        "most_used_features": most_used_features,
        "actions_breakdown": actions_breakdown,
        "top_users": top_users,
        "daily_trends": daily_trends,
        # Demographic additions
        "gender_distribution": gender_dist,
        "degree_distribution": degree_dist,
        "skills_distribution": skills_dist,
        "aptitude_by_degree": aptitude_by_degree,
        "interview_by_degree": interview_by_degree,
    }


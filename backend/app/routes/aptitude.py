"""Aptitude routes — questions, sets, progress, and attempts backed by MongoDB Atlas."""

import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.api.auth import get_current_user_from_header
from app.repositories.attempt_repository import AttemptRepository
from app.repositories.question_repository import QuestionRepository
from app.repositories.user_progress_repository import UserProgressRepository
from app.repositories.activity_log_repository import ActivityLogRepository
from app.services.ai_orchestration import AIOrchestrationService

router = APIRouter()
logger = logging.getLogger("app.aptitude")

VALID_CATEGORIES = [
    "numerical",
    "verbal",
    "reasoning",
    "advanced_quant",
    "advanced_coding",
]


class SaveProgressPayload(BaseModel):
    category: str
    level: int
    currentSet: int
    currentQuestion: int
    currentAnswers: dict = {}


class SubmitAttemptPayload(BaseModel):
    category: str
    level: int
    setNumber: int
    score: int
    totalQuestions: int
    timeTaken: int = 0
    attentionScore: float = 100.0
    suspiciousCount: int = 0
    tabSwitches: int = 0
    answers: dict = {}  # index -> chosen_option


# --- STUDENT APTITUDE CATEGORIES & SETS ENDPOINTS ---

@router.get("/aptitude/categories")
def get_categories(current_user: dict | None = Depends(get_current_user_from_header)):
    """Fetch categories list and map user-specific metrics and lock status."""
    if not current_user or not current_user.get("user_id"):
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
        
    user_id = current_user["user_id"]
    
    # Log activity
    ActivityLogRepository.log(
        user_id=user_id,
        username=current_user.get("username") or current_user.get("email"),
        feature="Aptitude Practice",
        action="view_categories"
    )
    results = []
    
    category_map = {
        "numerical": "Numerical Ability",
        "verbal": "Verbal Ability",
        "reasoning": "Reasoning Ability",
        "advanced_quant": "Advanced Quantitative",
        "advanced_coding": "Advanced Coding"
    }
    
    levels = [
        {"id": 1, "name": "Basic"},
        {"id": 2, "name": "Intermediate"},
        {"id": 3, "name": "Advanced"},
        {"id": 4, "name": "Expert"}
    ]
    
    for cat_id, cat_name in category_map.items():
        cat_levels = []
        prev_level_completed = True
        
        for lvl in levels:
            lvl_id = lvl["id"]
            lvl_name = lvl["name"]
            
            # Count questions
            q_count = QuestionRepository._col().count_documents({"category": cat_id, "level": lvl_id})
            total_sets = (q_count + 9) // 10
            
            progress = UserProgressRepository.get_or_create(user_id, cat_id, lvl_id)
            completed_sets = progress.get("completedSets", [])
            completed_count = len(completed_sets)
            
            pct = 0.0
            if total_sets > 0:
                pct = round((completed_count / total_sets) * 100, 2)
            
            unlocked = True if lvl_id == 1 else prev_level_completed
            
            cat_levels.append({
                "level_id": lvl_id,
                "level_name": lvl_name,
                "unlocked": unlocked,
                "total_questions": q_count,
                "total_sets": total_sets,
                "completed_sets_count": completed_count,
                "completed_sets": completed_sets,
                "progress_percentage": pct,
                "current_set": progress.get("currentSet", 1),
                "current_question": progress.get("currentQuestion", 0),
                "current_answers": progress.get("currentAnswers", {})
            })
            
            # Unlocked condition for next level: previous level must have at least one set completed
            prev_level_completed = len(completed_sets) > 0
            
        results.append({
            "category_id": cat_id,
            "category_name": cat_name,
            "levels": cat_levels
        })
        
    return results


@router.get("/aptitude/{category}/sets")
def get_category_sets(
    category: str, 
    level: int = 1,
    current_user: dict | None = Depends(get_current_user_from_header)
):
    """Fetch structured set listing for a specific category and level."""
    if not current_user or not current_user.get("user_id"):
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=404, detail="Invalid category")
        
    user_id = current_user["user_id"]
    
    q_count = QuestionRepository._col().count_documents({"category": category, "level": level})
    total_sets = (q_count + 9) // 10
    
    progress = UserProgressRepository.get_or_create(user_id, category, level)
    completed_sets = progress.get("completedSets", [])
    
    sets_list = []
    for s in range(1, total_sets + 1):
        is_completed = s in completed_sets
        is_unlocked = s == 1 or is_completed or (s - 1 in completed_sets) or s == progress.get("currentSet", 1)
        
        sets_list.append({
            "set_number": s,
            "total_questions": 10 if s < total_sets or q_count % 10 == 0 else q_count % 10,
            "unlocked": is_unlocked,
            "completed": is_completed,
            "is_current": s == progress.get("currentSet", 1)
        })
        
    return {
        "category": category,
        "level": level,
        "total_questions": q_count,
        "total_sets": total_sets,
        "completed_sets": completed_sets,
        "current_set": progress.get("currentSet", 1),
        "current_question": progress.get("currentQuestion", 0),
        "current_answers": progress.get("currentAnswers", {}),
        "progress_percentage": progress.get("progressPercentage", 0.0),
        "sets": sets_list
    }


@router.get("/aptitude/{category}/set/{set_number}")
def get_set_questions(
    category: str, 
    set_number: int, 
    level: int = 1,
    current_user: dict | None = Depends(get_current_user_from_header)
):
    """Fetch questions belonging to a specific dynamic slice (set)."""
    if not current_user or not current_user.get("user_id"):
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=404, detail="Invalid category")
        
    docs = list(QuestionRepository._col().find({"category": category, "level": level}).sort([("createdAt", 1), ("_id", 1)]))
    
    total_q = len(docs)
    start_idx = (set_number - 1) * 10
    end_idx = start_idx + 10
    
    if start_idx >= total_q:
        raise HTTPException(status_code=404, detail=f"Set {set_number} does not exist for category '{category}' at level {level}")
        
    sliced_docs = docs[start_idx:end_idx]
    from app.repositories.question_repository import _to_api_question
    questions = [_to_api_question(d, i + start_idx + 1) for i, d in enumerate(sliced_docs)]
    
    return {
        "category": category,
        "level": level,
        "set_number": set_number,
        "total_questions_in_set": len(questions),
        "questions": questions
    }


# --- RESUME PROGRESS SYSTEM ENDPOINTS ---

@router.post("/aptitude/progress/save")
def save_progress(
    payload: SaveProgressPayload,
    current_user: dict | None = Depends(get_current_user_from_header)
):
    """Save user practice progress after every answered question."""
    if not current_user or not current_user.get("user_id"):
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    
    user_id = current_user["user_id"]
    
    # Log activity
    ActivityLogRepository.log(
        user_id=user_id,
        username=current_user.get("username") or current_user.get("email"),
        feature="Aptitude Practice",
        action="save_progress",
        meta={"category": payload.category, "level": payload.level, "set": payload.currentSet}
    )
    
    q_count = QuestionRepository._col().count_documents({"category": payload.category, "level": payload.level})
    progress = UserProgressRepository.get_or_create(user_id, payload.category, payload.level)
    completed_qs = set(progress.get("completedQuestions", []))
    
    # Map index to question IDs for completed questions list
    docs = list(QuestionRepository._col().find({"category": payload.category, "level": payload.level}).sort([("createdAt", 1), ("_id", 1)]))
    start_idx = (payload.currentSet - 1) * 10
    
    for idx_str, ans in payload.currentAnswers.items():
        try:
            idx = int(idx_str)
            q_idx = start_idx + idx
            if q_idx < len(docs):
                q_id = str(docs[q_idx]["_id"])
                completed_qs.add(q_id)
        except ValueError:
            pass
            
    completed_qs_list = list(completed_qs)
    pct = 0.0
    if q_count > 0:
        pct = round((len(completed_qs_list) / q_count) * 100, 2)
        
    updates = {
        "currentSet": payload.currentSet,
        "currentQuestion": payload.currentQuestion,
        "currentAnswers": payload.currentAnswers,
        "completedQuestions": completed_qs_list,
        "progressPercentage": pct
    }
    
    updated = UserProgressRepository.update(user_id, payload.category, payload.level, updates)
    return {"status": "success", "progress": updated}


# --- ATTEMPT SUBMISSION & REVIEW ENDPOINTS ---

@router.post("/aptitude/submit")
async def submit_aptitude_attempt(
    submission: SubmitAttemptPayload,
    current_user: dict | None = Depends(get_current_user_from_header),
):
    """Submit completed set, verify score, log attempt snapshot, and unlock next set."""
    if not current_user or not current_user.get("user_id"):
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
        
    user_id = current_user["user_id"]
    
    docs = list(QuestionRepository._col().find({"category": submission.category, "level": submission.level}).sort([("createdAt", 1), ("_id", 1)]))
    start_idx = (submission.setNumber - 1) * 10
    end_idx = start_idx + 10
    sliced_docs = docs[start_idx:end_idx]
    
    from app.repositories.question_repository import _to_api_question
    questions_snapshot = [_to_api_question(d, i + start_idx + 1) for i, d in enumerate(sliced_docs)]
    
    # Recalculate score
    score = 0
    user_answers_snapshot = {}
    for idx, q_item in enumerate(questions_snapshot):
        chosen = submission.answers.get(str(idx)) or submission.answers.get(idx) or ""
        user_answers_snapshot[str(idx)] = chosen
        if chosen == q_item["correctAnswer"]:
            score += 1
            
    percentage = 0.0
    if submission.totalQuestions > 0:
        percentage = round((score / submission.totalQuestions) * 100, 2)
        
    analysis = None
    try:
        service = AIOrchestrationService()
        analysis = service.analyze_aptitude_attempt(
            category=submission.category,
            score=score,
            total_questions=submission.totalQuestions,
            attention_score=submission.attentionScore,
            suspicious_count=submission.suspiciousCount,
            tab_switches=submission.tabSwitches,
        )
    except Exception as exc:
        logger.warning("Gemini aptitude analysis unavailable: %s", exc)
        analysis = {
            "overall_impression": "Completed aptitude assessment with fallback analysis.",
            "strengths": ["Completed the set"],
            "areas_for_improvement": ["Strengthen speed and accuracy"],
            "time_management": f"Completed {submission.totalQuestions} questions in {submission.timeTaken} seconds.",
            "accuracy_trends": f"Scored {percentage}% overall.",
            "suspicious_activity": f"Detected {submission.suspiciousCount} suspicious events.",
            "recommendation_text": "Practice more questions in this category to improve scores.",
            "risk_level": "high" if submission.suspiciousCount > 3 else "medium" if submission.suspiciousCount > 0 else "low",
            "next_steps": ["Review missed questions", "Focus on weaker sections"],
        }
        
    attempt = AttemptRepository.create({
        "userId": user_id,
        "category": submission.category,
        "level": submission.level,
        "setNumber": submission.setNumber,
        "score": score,
        "totalQuestions": submission.totalQuestions,
        "accuracy": percentage,
        "timeTaken": submission.timeTaken,
        "attentionScore": submission.attentionScore,
        "suspiciousCount": submission.suspiciousCount,
        "tabSwitches": submission.tabSwitches,
        "analysis": analysis,
        "questions": questions_snapshot,
        "userAnswers": user_answers_snapshot
    })

    # Log activity
    ActivityLogRepository.log(
        user_id=user_id,
        username=current_user.get("username") or current_user.get("email"),
        feature="Aptitude Practice",
        action="submit_attempt",
        meta={
            "category": submission.category,
            "level": submission.level,
            "set": submission.setNumber,
            "score": score,
            "accuracy": percentage
        }
    )
    
    # Update progress
    progress = UserProgressRepository.get_or_create(user_id, submission.category, submission.level)
    completed_sets = list(progress.get("completedSets", []))
    if submission.setNumber not in completed_sets:
        completed_sets.append(submission.setNumber)
        
    next_set = submission.setNumber + 1
    
    completed_qs = set(progress.get("completedQuestions", []))
    for q_item in questions_snapshot:
        completed_qs.add(q_item["id"])
        
    q_count = QuestionRepository._col().count_documents({"category": submission.category, "level": submission.level})
    pct = 0.0
    if q_count > 0:
        pct = round((len(completed_qs) / q_count) * 100, 2)
        
    UserProgressRepository.update(
        user_id,
        submission.category,
        submission.level,
        {
            "completedSets": completed_sets,
            "currentSet": next_set,
            "currentQuestion": 0,
            "currentAnswers": {},
            "completedQuestions": list(completed_qs),
            "progressPercentage": pct
        }
    )
    
    return {"status": "success", "attempt_id": attempt["attempt_id"], "attempt": attempt}


@router.get("/aptitude/attempts")
def get_user_attempts(current_user: dict | None = Depends(get_current_user_from_header)):
    """Fetch past aptitude attempts for user."""
    if not current_user or not current_user.get("user_id"):
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    user_id = current_user["user_id"]
    attempts = AttemptRepository.find_by_user(user_id, limit=200)
    return {"attempts": attempts}


@router.get("/aptitude/attempt/{attempt_id}")
def get_aptitude_attempt(attempt_id: str, current_user: dict | None = Depends(get_current_user_from_header)):
    """Get single attempt report and question details for review."""
    if not current_user or not current_user.get("user_id"):
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
        
    attempt = AttemptRepository.find_by_id(attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
        
    if attempt.get("user_id") != current_user.get("user_id"):
        raise HTTPException(status_code=403, detail="You do not have access to this attempt")
        
    return attempt


# --- RESUME PRACTICE HELPER ---

@router.get("/aptitude/progress/{category}")
def get_user_progress(
    category: str,
    level: int = 1,
    current_user: dict | None = Depends(get_current_user_from_header),
):
    """Fetch active progress of user in a category."""
    if not current_user or not current_user.get("user_id"):
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=404, detail="Invalid category")
        
    progress = UserProgressRepository.get_or_create(current_user["user_id"], category, level)
    return progress


# --- USER ANALYTICS DASHBOARD ---

@router.get("/aptitude/analytics")
def get_aptitude_analytics(current_user: dict | None = Depends(get_current_user_from_header)):
    """Calculate aggregate and category-wise metrics for Recharts plotting."""
    if not current_user or not current_user.get("user_id"):
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
        
    user_id = current_user["user_id"]
    attempts = AttemptRepository.find_by_user(user_id, limit=500)
    
    total_attempts = len(attempts)
    
    category_map = {
        "numerical": "Numerical Ability",
        "verbal": "Verbal Ability",
        "reasoning": "Reasoning Ability",
        "advanced_quant": "Advanced Quantitative",
        "advanced_coding": "Advanced Coding"
    }
    
    questions_solved = 0
    completed_sets_total = 0
    
    by_category = {}
    for cat_id, cat_name in category_map.items():
        by_category[cat_id] = {
            "category_id": cat_id,
            "category_name": cat_name,
            "attempts_count": 0,
            "accuracy_sum": 0.0,
            "time_sum": 0,
            "questions_solved": 0,
            "completed_sets_count": 0,
            "current_level": 1
        }
        
    # Get current levels from userProgress
    progress_docs = UserProgressRepository.find_by_user(user_id)
    for p in progress_docs:
        cat = p.get("category")
        if cat in by_category:
            by_category[cat]["current_level"] = p.get("level", 1)
            by_category[cat]["completed_sets_count"] = len(p.get("completedSets", []))
            by_category[cat]["questions_solved"] = len(p.get("completedQuestions", []))
            completed_sets_total += len(p.get("completedSets", []))
            questions_solved += len(p.get("completedQuestions", []))

    accuracy_list = []
    time_list = []
    progress_trend = []
    
    for a in reversed(attempts):
        cat = a.get("category")
        acc = a.get("percentage") or a.get("accuracy", 0.0)
        time_taken = a.get("time_taken", 0)
        
        accuracy_list.append(acc)
        time_list.append(time_taken)
        
        if cat in by_category:
            by_category[cat]["attempts_count"] += 1
            by_category[cat]["accuracy_sum"] += acc
            by_category[cat]["time_sum"] += time_taken
            
        progress_trend.append({
            "date": (a.get("timestamp") or a.get("completed_at", ""))[:10],
            "score": acc,
            "category": category_map.get(cat, cat).replace(" Ability", "").replace(" Quantitative", " Quant").replace(" Coding", " Coding"),
            "level": a.get("level", 1)
        })
        
    avg_accuracy = round(sum(accuracy_list) / len(accuracy_list), 2) if accuracy_list else 0.0
    avg_time = round(sum(time_list) / len(time_list), 2) if time_list else 0.0
    
    category_analytics = []
    for cat_id, data in by_category.items():
        attempts_c = data["attempts_count"]
        data["average_accuracy"] = round(data["accuracy_sum"] / attempts_c, 2) if attempts_c > 0 else 0.0
        data["average_time"] = round(data["time_sum"] / attempts_c, 2) if attempts_c > 0 else 0.0
        category_analytics.append(data)
        
    category_performance = []
    for cat_id, cat_name in category_map.items():
        short_name = cat_name.replace(" Ability", "").replace(" Quantitative", " Quant").replace(" Coding", " Coding")
        category_performance.append({
            "subject": short_name,
            "score": by_category[cat_id]["average_accuracy"],
            "fullMark": 100
        })
        
    return {
        "questions_solved": questions_solved,
        "average_accuracy": avg_accuracy,
        "completed_sets": completed_sets_total,
        "total_attempts": total_attempts,
        "average_time": avg_time,
        "category_analytics": category_analytics,
        "category_performance": category_performance,
        "progress_trend": progress_trend[-15:],  # last 15 attempts
    }

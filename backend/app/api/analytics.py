"""Analytics endpoints to summarize stored sessions.

This module exposes two endpoints used by the frontend:
- GET /api/v1/analytics/summary  -> aggregated metrics for the authenticated user
- GET /api/v1/analytics/sessions -> list of completed sessions/attempts for the authenticated user

Legacy data stored sessions sometimes used alternate user identifiers (legacy test usernames or
`verify-user-*` ids). To ensure users can see their past history after signing in with Google,
we match ownership by `user_id` OR `email` OR `google_sub` when an authenticated user context is
available.
"""

from fastapi import APIRouter, HTTPException, Depends
from app.core.config import settings
from app.api.auth import get_current_user_from_header
from app.repositories.attempt_repository import AttemptRepository
import os
import json
from statistics import mean

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


def _ownership_matches(data: dict, current_user: dict | None, effective_user_id: str | None) -> bool:
    """Return True if the session/attempt data should be considered owned by current_user.

    Matching precedence:
    1. Exact `user_id` match
    2. Case-insensitive `email` match (if both sides have an email)
    3. Exact `google_sub` match
    """
    if not effective_user_id or not current_user:
        return False

    try:
        if data.get('user_id') and data.get('user_id') == effective_user_id:
            return True
    except Exception:
        pass

    try:
        if data.get('email') and current_user.get('email'):
            if str(data.get('email')).strip().lower() == str(current_user.get('email')).strip().lower():
                return True
    except Exception:
        pass

    try:
        if data.get('google_sub') and current_user.get('google_sub'):
            if str(data.get('google_sub')) == str(current_user.get('google_sub')):
                return True
    except Exception:
        pass

    return False


@router.get("/summary")
async def get_summary(
    user_id: str | None = None,
    current_user: dict | None = Depends(get_current_user_from_header),
):
    """Return aggregated interview and aptitude metrics for the authenticated user."""
    if not current_user or not current_user.get('user_id'):
        raise HTTPException(status_code=401, detail="Authentication required")

    effective_user_id = current_user.get('user_id')

    if user_id and user_id != effective_user_id:
        raise HTTPException(status_code=403, detail="You can only access your own analytics")

    sessions_dir = os.path.join(settings.DATA_DIR, "sessions")
    files = []
    if os.path.isdir(sessions_dir):
        files = [f for f in os.listdir(sessions_dir) if f.endswith('.json')]

    interviews_conducted = 0
    aptitude_attempts = 0

    by_type = {}
    roles = set()

    technical_scores = []
    communication_scores = []
    confidence_scores = []
    clarity_scores = []
    vocabulary_scores = []
    hesitation_scores = []
    integrities = []
    suspicious_events = 0

    strengths_pool = []
    improvements_pool = []

    # Aggregate completed sessions
    for fname in files:
        path = os.path.join(sessions_dir, fname)
        try:
            with open(path, 'r') as f:
                data = json.load(f)
        except Exception:
            continue

        if data.get('interview_state') != 'completed':
            continue

        if effective_user_id:
            if not _ownership_matches(data, current_user, effective_user_id):
                continue

        interviews_conducted += 1
        itype = data.get('interview_type', 'unknown')
        by_type[itype] = by_type.get(itype, 0) + 1

        if data.get('position'):
            roles.add(data.get('position'))

        proctor = data.get('proctoring') or {}
        if 'integrity_score' in proctor and proctor['integrity_score'] is not None:
            try:
                integrities.append(float(proctor['integrity_score']))
            except Exception:
                pass
        if 'suspicious_events_count' in proctor:
            suspicious_events += proctor.get('suspicious_events_count', 0)
        elif 'suspicious_events' in proctor:
            val = proctor['suspicious_events']
            if isinstance(val, int):
                suspicious_events += val
            elif isinstance(val, list):
                suspicious_events += len(val)

        # Parse answer history for detailed AI evaluation
        for ans in data.get('answer_history', []):
            ai = ans.get('ai_analysis') or ans.get('evaluation') or {}

            t = ai.get('technical_score') or (ai.get('ai_scores') or {}).get('technical')
            c = ai.get('communication_score') or (ai.get('ai_scores') or {}).get('communication')
            conf = ai.get('confidence_score') or (ai.get('ai_scores') or {}).get('confidence')
            clar = ai.get('clarity_score') or (ai.get('ai_scores') or {}).get('clarity')
            voc = ai.get('vocabulary_score') or (ai.get('ai_scores') or {}).get('vocabulary')

            hes = ai.get('hesitation_indicators')
            if hes is None:
                hes = (ai.get('typing_analysis') or {}).get('hesitation_score')

            try:
                if t is not None: technical_scores.append(float(t))
                if c is not None: communication_scores.append(float(c))
                if conf is not None: confidence_scores.append(float(conf))
                if clar is not None: clarity_scores.append(float(clar))
                if voc is not None: vocabulary_scores.append(float(voc))
                if hes is not None: hesitation_scores.append(float(hes))
            except Exception:
                pass

            strengths_pool.extend(ai.get('strengths', []))
            improvements_pool.extend(ai.get('areas_for_improvement', []))

    # Aptitude metrics
    aptitude_scores = []
    aptitude_attentions = []
    aptitude_suspicious = 0
    aptitude_tab_switches = 0
    aptitude_by_category = {}

    mongo_attempts = []
    if effective_user_id:
        mongo_attempts = AttemptRepository.find_by_user(effective_user_id, limit=500)

    for data in mongo_attempts:
        aptitude_attempts += 1
        cat = data.get('category', 'unknown')
        aptitude_by_category[cat] = aptitude_by_category.get(cat, 0) + 1

        score_pct = data.get('percentage') or data.get('accuracy')
        if score_pct is not None:
            aptitude_scores.append(score_pct)

        att = data.get('attention_score')
        if att is not None:
            aptitude_attentions.append(att)

        aptitude_suspicious += data.get('suspicious_count', 0)
        aptitude_tab_switches += data.get('tab_switches', 0)

    # Compute Averages
    avg_integrity = mean(integrities) if integrities else None
    avg_technical = mean(technical_scores) if technical_scores else None
    avg_communication = mean(communication_scores) if communication_scores else None
    avg_confidence = mean(confidence_scores) if confidence_scores else None
    avg_clarity = mean(clarity_scores) if clarity_scores else None
    avg_vocabulary = mean(vocabulary_scores) if vocabulary_scores else None
    avg_hesitation = mean(hesitation_scores) if hesitation_scores else None

    overall_scores = []
    if avg_technical is not None: overall_scores.append(avg_technical)
    if avg_communication is not None: overall_scores.append(avg_communication)
    if avg_confidence is not None: overall_scores.append(avg_confidence)
    avg_overall_interview_score = mean(overall_scores) if overall_scores else None

    avg_aptitude_score = mean(aptitude_scores) if aptitude_scores else None
    avg_aptitude_attention = mean(aptitude_attentions) if aptitude_attentions else None

    unique_strengths = []
    for s in strengths_pool:
        if s not in unique_strengths:
            unique_strengths.append(s)
    unique_improvements = []
    for s in improvements_pool:
        if s not in unique_improvements:
            unique_improvements.append(s)

    recruiter_status = "NO_DATA"
    recommendation_text = "No interview sessions have been conducted yet. Complete an AI interview to receive placement recommendations."
    if avg_overall_interview_score is not None:
        if avg_overall_interview_score >= 80:
            recruiter_status = "RECOMMENDED"
            recommendation_text = "Highly recommended for fast-track placement. Displays strong technical and outstanding verbal articulation."
        elif avg_overall_interview_score >= 60:
            recruiter_status = "CONDITIONAL"
            recommendation_text = "Recommended for next rounds. Shows solid fundamental knowledge with minor improvements needed in advanced problem-solving."
        else:
            recruiter_status = "REQUIRES_REVIEW"
            recommendation_text = "Requires further training. Fundamental coding skills and technical depth need reinforcement before client-facing interviews."

    return {
        "interviews_conducted": interviews_conducted,
        "aptitude_attempts": aptitude_attempts,
        "by_type": by_type,
        "active_roles": sorted(list(roles)),
        "interview_performance": {
            "overall_score": avg_overall_interview_score,
            "technical_score": avg_technical,
            "communication_score": avg_communication,
            "confidence_score": avg_confidence,
            "clarity_score": avg_clarity,
            "vocabulary_score": avg_vocabulary,
            "hesitation_score": avg_hesitation,
        },
        "aptitude_performance": {
            "total_attempts": aptitude_attempts,
            "by_category": aptitude_by_category,
            "average_score": avg_aptitude_score,
            "average_attention": avg_aptitude_attention,
            "total_tab_switches": aptitude_tab_switches,
            "total_suspicious": aptitude_suspicious
        },
        "proctoring_integrity": {
            "average_integrity": avg_integrity,
            "total_suspicious_events": suspicious_events,
        },
        "top_strengths": unique_strengths[:5],
        "improvement_areas": unique_improvements[:5],
        "recruiter_recommendation": {
            "status": recruiter_status,
            "recommendation": recommendation_text
        }
    }


@router.get("/sessions")
async def get_sessions(
    user_id: str | None = None,
    current_user: dict | None = Depends(get_current_user_from_header),
):
    """Return a list of completed interview and mock interview sessions."""
    if not current_user or not current_user.get("user_id"):
        raise HTTPException(status_code=401, detail="Authentication required")

    effective_user_id = current_user.get("user_id")
    if user_id and user_id != effective_user_id:
        raise HTTPException(status_code=403, detail="You can only access your own history")

    sessions_dir = os.path.join(settings.DATA_DIR, "sessions")
    sessions = []
    if os.path.isdir(sessions_dir):
        for fname in os.listdir(sessions_dir):
            if not fname.endswith('.json'):
                continue
            path = os.path.join(sessions_dir, fname)
            try:
                with open(path, 'r') as f:
                    data = json.load(f)
            except Exception:
                continue

            if data.get('interview_state') != 'completed':
                continue

            if not _ownership_matches(data, current_user, effective_user_id):
                continue

            metrics = data.get("metrics") or {}
            overall_score = metrics.get("overall_score")
            if overall_score is None:
                overall_score = data.get("proctoring", {}).get("integrity_score")

            sessions.append({
                "session_id": data.get("session_id"),
                "interview_type": data.get("interview_type", "mock"),
                "position": data.get("position", "Interview Session"),
                "start_time": data.get("start_time"),
                "overall_score": overall_score,
                "type": "interview",
                "user_id": data.get("user_id")
            })

    for data in AttemptRepository.find_by_user(effective_user_id, limit=200):
        sessions.append({
            "session_id": data.get("attempt_id"),
            "interview_type": data.get("category", "aptitude"),
            "position": f"Aptitude: {data.get('category', 'Test').replace('_', ' ').capitalize()}",
            "start_time": data.get("timestamp") or data.get("completed_at"),
            "overall_score": data.get("percentage") or data.get("accuracy"),
            "type": "aptitude",
            "user_id": data.get("user_id"),
        })

    # Sort sessions by start_time descending
    sessions.sort(key=lambda s: s.get("start_time") or "", reverse=True)
    return sessions
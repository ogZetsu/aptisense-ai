"""Interview API endpoints."""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
import logging
from typing import Optional
from app.schemas import (
    InterviewSessionRequest,
    InterviewSessionResponse,
    InterviewAnswerRequest,
    InterviewAnswerResponse,
    InterviewReport,
    ErrorResponse,
)
from app.services.interview_manager import session_manager  
from app.api.auth import get_current_user_from_header
from app.services.ai_orchestration import AIOrchestrationService
from app.services.question_bank import question_bank
from app.core.config import settings
from app.schemas.analysis import AnalysisModel
from app.repositories.activity_log_repository import ActivityLogRepository
from pydantic import ValidationError

logger = logging.getLogger("app.interview")

router = APIRouter(prefix="/api/v1/interview", tags=["interview"])


def _require_authenticated_user(current_user: dict | None):
    if not current_user or not current_user.get("user_id"):
        raise HTTPException(status_code=401, detail="Please sign in with Google to continue.")
    return current_user


def _enforce_session_owner(session, current_user: dict | None):
    user = _require_authenticated_user(current_user)
    if not session.user_id:
        raise HTTPException(status_code=403, detail="This session is not linked to an authenticated user account")
    if session.user_id != user.get("user_id"):
        raise HTTPException(status_code=403, detail="You do not have access to this session")


@router.get("/health/{session_id}")
async def check_session_health(session_id: str, current_user: dict | None = Depends(get_current_user_from_header)):
    """Check if a session exists and is valid."""
    try:
        session = session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        _enforce_session_owner(session, current_user)
        
        return {
            "session_id": session_id,
            "valid": True,
            "interview_type": session.interview_type,
            "interview_state": session.interview_state,
            "current_question_index": session.current_question_index,
            "total_answers": len(session.answer_history),
        }
    except HTTPException:
        raise
    except HTTPException:
        raise
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{session_id}")
async def get_session_status(session_id: str, current_user: dict | None = Depends(get_current_user_from_header)):
    """Check if a session exists and is in a valid state."""
    try:
        session = session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        _enforce_session_owner(session, current_user)

        return {
            "session_id": session_id,
            "valid": True,
            "interview_type": session.interview_type,
            "interview_state": session.interview_state,
            "current_question_index": session.current_question_index,
            "total_answers": len(session.answer_history),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# AI service will be created on-demand per request
def _get_ai_analysis(question: str, answer: str, category: str, difficulty: str, context: dict = None):
    """Get AI analysis for an answer."""
    try:
        print("[_get_ai_analysis] Instantiating AIOrchestrationService...")
        logger.debug("Instantiating AIOrchestrationService for analysis")
        service = AIOrchestrationService()
        print("[_get_ai_analysis] Calling analyze_answer...")
        result = service.analyze_answer(
            question=question,
            answer=answer,
            category=category,
            difficulty=difficulty,
            context=context,
        )
        print("[_get_ai_analysis] analyze_answer returned:", result)
        logger.debug("AI analysis result: %s", result)
        return result
    except Exception as e:
        # Make sure exceptions are visible in console and logs
        logger.exception("AI analysis failed: %s", e)
        try:
            print("[_get_ai_analysis] Exception during AI analysis:", e)
        except Exception:
            pass
        return None


def _get_follow_up(last_question: str, last_answer: str, category: str, context: dict, follow_up_count: int):
    """Get follow-up question from AI."""
    try:
        service = AIOrchestrationService()
        return service.generate_follow_up_question(
            last_question=last_question,
            last_answer=last_answer,
            category=category,
            context=context,
            follow_up_count=follow_up_count,
        )
    except Exception as e:
        logger.error(f"Follow-up generation failed: {e}", exc_info=True)
        return None


def _get_interviewer_turn(question: str, answer: str, category: str, difficulty: str, context: dict = None):
    """Get a complete recruiter-style answer turn from Gemini."""
    try:
        service = AIOrchestrationService()
        ai_turn = service.generate_interviewer_turn(
            question=question,
            answer=answer,
            category=category,
            difficulty=difficulty,
            context=context,
        )
        logger.debug("[ORCHESTRATION] _get_interviewer_turn returned ai_turn: %s", ai_turn)
        print("[ORCHESTRATION] _get_interviewer_turn returned ai_turn:", ai_turn)
        if not ai_turn:
            raise RuntimeError("Gemini returned no interviewer turn")
        return ai_turn
    except Exception as e:
        logger.exception("Interviewer turn generation failed: %s", e)
        print("[ORCHESTRATION] _get_interviewer_turn exception:", type(e).__name__, e)
        raise


def _generate_final_gemini_report(session):
    """Generate a final Gemini-based recruiter summary for the complete interview."""
    try:
        logger.info("[FINAL REPORT] Generating final Gemini report for session %s", session.session_id)
        print("[FINAL REPORT] Generating final Gemini report for session", session.session_id)
        
        # Collect all answers and feedback
        answer_texts = []
        all_feedback = []
        all_strengths = []
        all_weaknesses = []
        
        for answer in session.answer_history:
            answer_texts.append(answer.get("answer", ""))
            eval_data = answer.get("evaluation", {})
            if eval_data:
                all_feedback.append(eval_data.get("recruiter_feedback") or eval_data.get("overall_impression", ""))
                all_strengths.extend(eval_data.get("strengths", []))
                all_weaknesses.extend(eval_data.get("areas_for_improvement", []))
        
        # Build a summary prompt for Gemini
        prompt = f"""
You are an expert recruitment interviewer. Based on the following interview session, generate a comprehensive final recruiter assessment:

Interview Type: {session.interview_type}
Position: {session.position}
Experience Level: {session.experience_level}
Total Questions Asked: {len(session.question_history)}
Total Answers Provided: {len(session.answer_history)}

Recent Answer Feedback Summary:
{chr(10).join(f"- {fb[:150]}" for fb in all_feedback[-5:] if fb)}

Identified Strengths: {', '.join(set(all_strengths[-10:]))}
Improvement Areas: {', '.join(set(all_weaknesses[-10:]))}

Please provide a final executive summary in JSON format with:
{{
  "executive_summary": "A 2-3 sentence overall assessment",
  "communication_quality": "Assessment of communication skills demonstrated",
  "technical_competence": "Assessment of technical/domain knowledge",
  "problem_solving_approach": "How they approached problems",
  "confidence_level": "Overall confidence demonstrated",
  "key_strengths": "Top 2-3 strengths observed",
  "improvement_areas": "Top 2-3 areas for development",
  "recommendation": "RECOMMENDED / CONDITIONAL / REQUIRES_TRAINING",
  "next_steps": "Suggested next interview round or actions",
  "overall_score": 75
}}
"""
        
        service = AIOrchestrationService()
        try:
            # Try to get Gemini's final assessment
            final_report = service.generate_interview_analysis(
                prompt=prompt,
                interview_type=session.interview_type,
            )
            if final_report:
                # Merge final report into session data
                session.final_gemini_report = final_report
                session.save_session()
                logger.info("[FINAL REPORT] Successfully generated and saved final Gemini report")
                print("[FINAL REPORT] Successfully generated and saved final Gemini report")
        except Exception as e:
            logger.warning("[FINAL REPORT] Gemini final report generation failed, using aggregated feedback: %s", e)
            print("[FINAL REPORT] Gemini generation failed, using aggregated feedback")
            # Fall back to aggregated feedback from individual turns
            
    except Exception as e:
        logger.error("[FINAL REPORT] Failed to generate final report: %s", e)
        print("[FINAL REPORT] Error:", str(e))


@router.post("/start", response_model=InterviewSessionResponse)
async def start_interview(request: InterviewSessionRequest, current_user: dict | None = Depends(get_current_user_from_header)):
    """Start a new interview session."""
    try:
        # Create session
        user = _require_authenticated_user(current_user)
        user_id = user.get("user_id")
        user_name = user.get("username")
        user_email = user.get("email")
        google_sub = user.get("google_sub")
        session = session_manager.create_session(
            interview_type=request.interview_type,
            position=request.position,
            experience_level=request.experience_level,
            enable_proctoring=request.enable_proctoring,
            user_id=user_id,
            user_name=user_name,
            user_email=user_email,
            google_sub=google_sub,
        )
        
        # Log activity
        ActivityLogRepository.log(
            user_id=user_id,
            username=user_name or user_email,
            feature="Mock Interview",
            action="start_session",
            meta={"interview_type": request.interview_type, "position": request.position}
        )
        
        # Get first question
        question = question_bank.get_next_question(
            interview_type=request.interview_type,
            session_id=session.session_id,
            difficulty_level="easy",
        )
        
        if not question:
            raise HTTPException(status_code=500, detail="No questions available")
        
        # Add question to session
        session.add_question(
            question=question["text"],
            question_id=question["id"],
            category=question.get("category", "general"),
            difficulty=question.get("difficulty", "medium"),
        )
        
        estimated_duration = 45  # minutes
        
        return InterviewSessionResponse(
            session_id=session.session_id,
            interview_type=request.interview_type,
            position=request.position,
            experience_level=request.experience_level,
            first_question=question["text"],
            first_question_id=question["id"],
            proctoring_enabled=request.enable_proctoring,
            estimated_duration_minutes=estimated_duration,
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/answer", response_model=InterviewAnswerResponse)
async def submit_answer(
    request: InterviewAnswerRequest,
    background_tasks: BackgroundTasks,
    current_user: dict | None = Depends(get_current_user_from_header),
):
    """Submit an answer and get analysis + follow-up."""
    try:
        session = session_manager.get_session(request.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        _enforce_session_owner(session, current_user)
        
        # Get the question
        question = None
        for q in session.question_history:
            if q["question_id"] == request.question_id:
                question = q
                break
        
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        
        # Generate the full recruiter-style turn with one Gemini call
        ai_turn = _get_interviewer_turn(
            question=question["question"],
            answer=request.answer_text,
            category=question["category"],
            difficulty=question["difficulty"],
            context=session.memory.get_context_for_follow_up(),
        )

        logger.debug("[ORCHESTRATION] Gemini returned ai_turn: %s", ai_turn)
        print("[ORCHESTRATION] Gemini returned ai_turn:", ai_turn)
        ai_analysis = ai_turn
        active_response_function = "_get_interviewer_turn() -> generate_interviewer_turn()"
        try:
            validated = AnalysisModel.model_validate(ai_analysis)
            ai_analysis = validated.model_dump()
        except ValidationError:
            logger.warning("Gemini turn validation failed for session %s question %s", request.session_id, request.question_id, exc_info=True)
            print("[ORCHESTRATION] Gemini validation failed, keeping normalized dict")
            # keep the normalized dict if it is at least structurally useful

        # Use the follow-up question provided directly by the model (no generated fallbacks)
        follow_up_question: Optional[str] = ai_analysis.get("follow_up_question") or None
        if follow_up_question:
            session.add_follow_up_question(
                follow_up=follow_up_question,
                parent_question_id=request.question_id,
            )
        
        # Add answer to session
        session.add_answer(
            answer=request.answer_text,
            question_id=request.question_id,
            ai_analysis=ai_analysis,
            follow_up_question=follow_up_question,
            typing_metrics=request.typing_metrics,
        )

        # Log activity
        ActivityLogRepository.log(
            user_id=session.user_id,
            username=session.user_name or session.user_email,
            feature="Mock Interview",
            action="submit_answer",
            meta={"interview_type": session.interview_type, "question_id": request.question_id}
        )
        
        # Determine adaptive difficulty
        current_score = ai_analysis.get("overall_impression", "")
        performance_score = (
            (ai_analysis.get("technical_score", 50) +
             ai_analysis.get("communication_score", 50)) / 2
        )
        
        new_difficulty = question_bank.get_adaptive_difficulty(
            current_difficulty=session.difficulty_level,
            performance_score=performance_score,
        )
        session.difficulty_level = new_difficulty
        
        # Save session immediately to ensure persistence (not in background)
        session.save_session()
        
        # Map AI analysis to API AnswerAnalysis schema shape
        api_analysis = {
            "technical_score": float(ai_analysis.get("technical_score", 0)),
            "communication_score": float(ai_analysis.get("communication_score", 0)),
            "confidence_score": float(ai_analysis.get("confidence_score", 0)),
            "clarity_score": float(ai_analysis.get("clarity_score", 0)),
            "relevance_score": float(ai_analysis.get("relevance_score", 0)),
            "depth_score": float(ai_analysis.get("depth_score", ai_analysis.get("depth_score", 0))),
            "vocabulary_score": float(ai_analysis.get("vocabulary_score", 0)),
            "hesitation_score": float(ai_analysis.get("hesitation_indicators", ai_analysis.get("hesitation_score", 0))),
            "feedback_points": ai_analysis.get("feedback", []),
            "strengths": ai_analysis.get("strengths", []),
            "areas_for_improvement": ai_analysis.get("areas_for_improvement", []),
            "recommended_follow_up": follow_up_question or ai_analysis.get("recommended_follow_up"),
            "adaptive_difficulty_adjustment": ai_analysis.get("difficulty_adjustment", ai_analysis.get("difficulty_adjustment", "maintain")),
            "recruiter_feedback": ai_analysis.get("recruiter_feedback", ai_analysis.get("overall_impression", "")),
        }

        selected_feedback_field = "recruiter_feedback" if ai_analysis.get("recruiter_feedback") else ("overall_impression" if ai_analysis.get("overall_impression") else ("feedback" if ai_analysis.get("feedback") else "none"))
        feedback_text = ai_analysis.get("recruiter_feedback") or ai_analysis.get("overall_impression") or (
            ". ".join(ai_analysis.get("feedback", [])[:2]) if ai_analysis.get("feedback") else "The AI reviewed your answer and provided guidance."
        )
        logger.debug("[ORCHESTRATION] feedback_text selected from %s: %s", selected_feedback_field, feedback_text)
        print("[ORCHESTRATION] feedback_text selected from", selected_feedback_field, ":", feedback_text)
        logger.debug("[ORCHESTRATION] FINAL recruiter response: %s", feedback_text)
        logger.debug("[ORCHESTRATION] ACTIVE RESPONSE FUNCTION: %s", active_response_function)
        print("[ORCHESTRATION] FINAL recruiter response:", feedback_text)
        print("[ORCHESTRATION] ACTIVE RESPONSE FUNCTION:", active_response_function)

        return InterviewAnswerResponse(
            session_id=request.session_id,
            question_id=request.question_id,
            answer_text=request.answer_text,
            analysis=api_analysis,
            feedback=feedback_text,
            follow_up=follow_up_question,
            follow_up_question=follow_up_question,
            interview_state=session.interview_state,
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/next-question/{session_id}")
async def get_next_question(session_id: str, current_user: dict | None = Depends(get_current_user_from_header)):
    """Get the next question for the interview."""
    try:
        session = session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        _enforce_session_owner(session, current_user)
        
        # Check if interview should continue
        if not session.should_continue_interview():
            return {
                "should_continue": False,
                "message": "Interview completed or time limit reached",
            }
        
        # Get excluded question IDs
        exclude_ids = [q["question_id"] for q in session.question_history]
        
        # Get next question
        question = question_bank.get_next_question(
            interview_type=session.interview_type,
            session_id=session.session_id,
            difficulty_level=session.difficulty_level,
            exclude_ids=exclude_ids,
        )
        
        if not question:
            return {
                "should_continue": False,
                "message": "No more questions available",
            }
        
        # Add question to session
        session.add_question(
            question=question["text"],
            question_id=question["id"],
            category=question.get("category", "general"),
            difficulty=question.get("difficulty", "medium"),
        )
        
        return {
            "should_continue": True,
            "question_id": question["id"],
            "question": question["text"],
            "difficulty": question.get("difficulty", "medium"),
            "category": question.get("category", "general"),
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/end/{session_id}")
async def end_interview(
    session_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict | None = Depends(get_current_user_from_header),
):
    """End interview and generate Gemini final report."""
    try:
        session = session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        _enforce_session_owner(session, current_user)

        success = session_manager.end_session(session_id)
        if not success:
            raise HTTPException(status_code=404, detail="Session not found")

        session = session_manager.get_session(session_id) or session
        
        # Generate Gemini final summary asynchronously
        background_tasks.add_task(_generate_final_gemini_report, session)
        
        report = session.get_session_report()
        
        return {
            "success": True,
            "session_id": session_id,
            "message": "Interview completed",
            "report_ready": True,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/report/{session_id}", response_model=InterviewReport)
async def get_interview_report(session_id: str, current_user: dict | None = Depends(get_current_user_from_header)):
    """Get comprehensive interview report."""
    try:
        session = session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        _enforce_session_owner(session, current_user)
        
        report = session.get_session_report()
        
        proc_data = report.get("proctoring")
        if proc_data:
            risk = proc_data.get("risk_level", "low")
            if risk not in ["low", "medium", "high"]:
                risk = "low"
            proctoring_session = {
                "session_id": proc_data.get("session_id", session_id),
                "total_frames_analyzed": int(proc_data.get("total_frames_analyzed", 0)),
                "faces_detected_anomalies": int(proc_data.get("faces_detected_anomalies", proc_data.get("suspicious_events_count", 0))),
                "total_looking_away_duration_seconds": float(proc_data.get("total_looking_away_duration_seconds", 0.0)),
                "max_looking_away_duration_seconds": float(proc_data.get("max_looking_away_duration_seconds", 0.0)),
                "suspicious_events": int(proc_data.get("suspicious_events", proc_data.get("suspicious_events_count", 0))),
                "average_cheating_probability": float(proc_data.get("average_cheating_probability", 0.0)),
                "integrity_score": float(proc_data.get("integrity_score", 100.0)),
                "flagged_for_review": bool(proc_data.get("flagged_for_review", False)),
                "risk_level": risk,
            }
        else:
            proctoring_session = {
                "session_id": session_id,
                "total_frames_analyzed": 0,
                "faces_detected_anomalies": 0,
                "total_looking_away_duration_seconds": 0.0,
                "max_looking_away_duration_seconds": 0.0,
                "suspicious_events": 0,
                "average_cheating_probability": 0.0,
                "integrity_score": 100.0,
                "flagged_for_review": False,
                "risk_level": "low",
            }

        return InterviewReport(
            session_id=report["session_id"],
            interview_type=report["interview_type"],
            position=report["position"],
            experience_level=report["experience_level"],
            interview_date=report["start_time"],
            duration_minutes=int(report["duration_minutes"]),
            metrics={
                "overall_score": report["metrics"]["overall_score"],
                "communication_score": report["metrics"]["communication_score"],
                "technical_score": report["metrics"]["technical_score"],
                "confidence_score": report["metrics"]["confidence_score"],
                "problem_solving_score": report["metrics"]["problem_solving_score"],
                "behavioral_score": report["metrics"]["behavioral_consistency_score"],
                "consistency_score": report["metrics"]["behavioral_consistency_score"],
                "employability_rating": report["metrics"]["employability_rating"],
            },
            proctoring=proctoring_session,
            recommendation={
                "recommendation_id": session_id,
                "candidate_status": "RECOMMENDED" if report["metrics"]["overall_score"] >= 70 else "REQUIRES_REVIEW" if report["metrics"]["overall_score"] >= 60 else "NOT_RECOMMENDED",
                "recommended_for_round": "technical" if report["metrics"]["overall_score"] >= 70 else None,
                "strengths": report["strengths"],
                "concerns": report["weaknesses"],
                "recommendation_text": report["feedback"],
                "follow_up_actions": ["Review feedback", "Schedule next round"],
            },
            answer_summaries=report.get("answer_summaries", [{"index": i, "score": report["metrics"]["overall_score"]} for i in range(len(session.answer_history))]),
            interview_transcript=report["interview_transcript"],
            final_gemini_report=report.get("final_gemini_report"),
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{session_id}")
async def get_session_status(session_id: str, current_user: dict | None = Depends(get_current_user_from_header)):
    """Get current session status."""
    try:
        session = session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        _enforce_session_owner(session, current_user)
        
        return {
            "session_id": session_id,
            "state": session.interview_state,
            "questions_answered": len(session.answer_history),
            "duration_minutes": session.get_duration_minutes(),
            "should_continue": session.should_continue_interview(),
            "current_difficulty": session.difficulty_level,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

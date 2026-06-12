"""Interview session management service."""
import json
import uuid
from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path
from app.services.interview_memory import InterviewMemory
from app.services.ai_orchestration import AIOrchestrationService
from app.services.evaluation import InterviewEvaluationService
from app.services.proctoring import ProctoringService
from app.core.config import settings


class InterviewSession:
    """Represents a single interview session."""

    def __init__(
        self,
        session_id: str,
        interview_type: str,
        position: str,
        experience_level: str,
        enable_proctoring: bool = True,
        user_id: str | None = None,
        user_name: str | None = None,
        user_email: str | None = None,
        google_sub: str | None = None,
    ):
        """Initialize interview session."""
        self.session_id = session_id
        self.interview_type = interview_type
        self.position = position
        self.experience_level = experience_level
        self.enable_proctoring = enable_proctoring
        self.start_time = datetime.utcnow()
        self.end_time: Optional[datetime] = None
        
        # Services
        self.memory = InterviewMemory(session_id, storage_path=str(Path(settings.DATA_DIR) / "sessions" / f"{session_id}.memory.json"))
        self.evaluation = InterviewEvaluationService()
        self.proctoring = ProctoringService(session_id) if enable_proctoring else None
        self.user_id = user_id
        self.user_name = user_name
        self.user_email = user_email
        self.google_sub = google_sub
        
        # State
        self.current_question_index = 0
        self.question_history: List[Dict[str, Any]] = []
        self.answer_history: List[Dict[str, Any]] = []
        self.follow_up_count = 0
        self.max_follow_ups_per_question = settings.MAX_FOLLOW_UP_QUESTIONS
        self.interview_state = "initialized"
        self.difficulty_level = "medium"
        
        # Store path
        self.storage_path = Path(settings.DATA_DIR) / "sessions" / f"{session_id}.json"

    def start(self) -> None:
        """Start the interview session."""
        self.interview_state = "in_progress"

    def end(self) -> None:
        """End the interview session."""
        self.end_time = datetime.utcnow()
        self.interview_state = "completed"

    def add_question(
        self,
        question: str,
        question_id: str,
        category: str,
        difficulty: str,
    ) -> None:
        """Add question to session."""
        question_record = {
            "index": len(self.question_history),
            "question_id": question_id,
            "question": question,
            "category": category,
            "difficulty": difficulty,
            "asked_at": datetime.utcnow().isoformat(),
            "is_follow_up": False,
        }
        self.question_history.append(question_record)

    def add_follow_up_question(
        self,
        follow_up: str,
        parent_question_id: str,
    ) -> None:
        """Add follow-up question."""
        question_record = {
            "index": len(self.question_history),
            "question_id": f"{parent_question_id}_followup_{self.follow_up_count}",
            "question": follow_up,
            "category": self.question_history[-1]["category"] if self.question_history else "general",
            "difficulty": self.question_history[-1]["difficulty"] if self.question_history else "medium",
            "asked_at": datetime.utcnow().isoformat(),
            "is_follow_up": True,
            "parent_question_id": parent_question_id,
        }
        self.question_history.append(question_record)
        self.follow_up_count += 1

    def add_answer(
        self,
        answer: str,
        question_id: str,
        ai_analysis: Dict[str, Any],
        follow_up_question: Optional[str] = None,
        typing_metrics: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Add answer with analysis."""
        evaluation = self.evaluation.evaluate_answer(ai_analysis, typing_metrics)
        
        answer_record = {
            "answer_index": len(self.answer_history),
            "question_id": question_id,
            "answer": answer,
            "answered_at": datetime.utcnow().isoformat(),
            "evaluation": evaluation,
            "ai_analysis": ai_analysis,
        }
        self.answer_history.append(answer_record)
        
        # Update memory
        self._update_memory_from_answer(answer, question_id, ai_analysis, follow_up_question=follow_up_question)

    def _update_memory_from_answer(
        self,
        answer: str,
        question_id: str,
        ai_analysis: Dict[str, Any],
        follow_up_question: Optional[str] = None,
    ) -> None:
        """Update interview memory from answer."""
        # Find corresponding question
        question = None
        for q in self.question_history:
            if q["question_id"] == question_id:
                question = q
                break
        
        if not question:
            return
        
        # Add to memory
        self.memory.add_exchange(
            question=question["question"],
            answer=answer,
            question_id=question_id,
            category=question["category"],
            difficulty=question["difficulty"],
            analysis=ai_analysis,
            follow_up_question=follow_up_question,
        )
        
        # Track strengths and weaknesses
        strengths = ai_analysis.get("strengths", [])
        weaknesses = ai_analysis.get("areas_for_improvement", [])
        
        for strength in strengths:
            self.memory.add_strength(strength)
        for weakness in weaknesses:
            self.memory.add_weakness(weakness)

    def get_duration_minutes(self) -> float:
        """Get interview duration in minutes."""
        end = self.end_time or datetime.utcnow()
        duration = (end - self.start_time).total_seconds() / 60
        return duration

    def should_continue_interview(self) -> bool:
        """Determine if interview should continue."""
        duration = self.get_duration_minutes()
        
        # Check duration limits
        if duration > settings.MAX_INTERVIEW_DURATION_MINUTES:
            return False
        if duration < settings.MIN_INTERVIEW_DURATION_MINUTES and len(self.answer_history) > 0:
            return True
        
        # Check if enough questions answered
        if len(self.answer_history) < 3:
            return True
        
        return False

    def save_session(self) -> bool:
        """Persist session to storage."""
        try:
            self.storage_path.parent.mkdir(parents=True, exist_ok=True)
            self.memory.save_to_file()
            
            report_data = self.get_session_report()
            session_data = {
                "session_id": self.session_id,
                "interview_type": self.interview_type,
                "position": self.position,
                "experience_level": self.experience_level,
                "user_id": self.user_id,
                "username": self.user_name,
                "email": self.user_email,
                "google_sub": self.google_sub,
                "start_time": self.start_time.isoformat(),
                "end_time": self.end_time.isoformat() if self.end_time else None,
                "duration_minutes": self.get_duration_minutes(),
                "interview_state": self.interview_state,
                "difficulty_level": self.difficulty_level,
                "question_history": self.question_history,
                "answer_history": self.answer_history,
                "memory_summary": self.memory.get_summary(),
                "metrics": report_data.get("metrics"),
                "strengths": report_data.get("strengths"),
                "weaknesses": report_data.get("weaknesses"),
                "feedback": report_data.get("feedback"),
                "answer_summaries": report_data.get("answer_summaries"),
                "interview_transcript": report_data.get("interview_transcript"),
                "final_gemini_report": report_data.get("final_gemini_report"),
                "recommendation": report_data.get("recommendation"),
            }
            
            if self.proctoring:
                session_data["proctoring"] = self.proctoring.get_session_integrity_score()
            
            with open(self.storage_path, "w") as f:
                json.dump(session_data, f, indent=2)
            
            return True
        except Exception as e:
            print(f"Error saving session: {e}")
            return False

    def get_session_report(self) -> Dict[str, Any]:
        """Generate comprehensive session report."""
        # Calculate metrics
        metrics = self.evaluation.calculate_aggregate_metrics(
            self.memory,
            [a["evaluation"] for a in self.answer_history],
        )
        
        # Extract feedback
        all_strengths = self.memory.identified_strengths
        all_weaknesses = self.memory.identified_weaknesses

        recent_feedback = [
            answer.get("evaluation", {}).get("recruiter_feedback")
            or answer.get("evaluation", {}).get("overall_impression")
            for answer in self.answer_history[-3:]
        ]
        recent_feedback = [feedback for feedback in recent_feedback if feedback]
        
        feedback_text = self.evaluation.generate_feedback_text(
            metrics, all_strengths, all_weaknesses
        )

        answer_summaries = []
        for index, answer in enumerate(self.answer_history):
            question = next((q for q in self.question_history if q["question_id"] == answer["question_id"]), {})
            answer_summaries.append({
                "index": index,
                "question_id": answer["question_id"],
                "question": question.get("question", ""),
                "answer": answer.get("answer", ""),
                "feedback": answer.get("evaluation", {}).get("recruiter_feedback") or answer.get("evaluation", {}).get("overall_impression", ""),
                "follow_up_question": next((q["question"] for q in self.question_history if q.get("is_follow_up") and q.get("parent_question_id") == answer["question_id"]), None),
                "analysis": answer.get("evaluation", {}),
                "difficulty": question.get("difficulty", "medium"),
            })
        
        report = {
            "session_id": self.session_id,
            "interview_type": self.interview_type,
            "position": self.position,
            "experience_level": self.experience_level,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_minutes": self.get_duration_minutes(),
            "total_questions": len(self.question_history),
            "total_answers": len(self.answer_history),
            "follow_up_questions": sum(1 for q in self.question_history if q.get("is_follow_up", False)),
            "metrics": metrics,
            "strengths": all_strengths[:5],
            "weaknesses": all_weaknesses[:5],
            "feedback": feedback_text,
            "answer_summaries": answer_summaries,
            "interview_transcript": self._generate_transcript(),
            "final_gemini_report": getattr(self, 'final_gemini_report', None),
        }
        
        if self.proctoring:
            report["proctoring"] = self.proctoring.get_session_integrity_score()
        
        return report

    def _generate_transcript(self) -> List[Dict[str, str]]:
        """Generate interview transcript."""
        transcript = []
        
        for question in self.question_history:
            transcript.append({
                "role": "interviewer",
                "content": question["question"],
                "timestamp": question["asked_at"],
            })
            
            # Find corresponding answer
            for answer in self.answer_history:
                if answer["question_id"] == question["question_id"]:
                    transcript.append({
                        "role": "candidate",
                        "content": answer["answer"][:200] + "..." if len(answer["answer"]) > 200 else answer["answer"],
                        "timestamp": answer["answered_at"],
                    })
                    break
        
        return transcript


class InterviewSessionManager:
    """Manages all interview sessions."""

    def __init__(self):
        """Initialize session manager."""
        self.sessions: Dict[str, InterviewSession] = {}
        self.sessions_dir = Path(settings.DATA_DIR) / "sessions"

    def _restore_session_from_disk(self, session_id: str) -> Optional[InterviewSession]:
        """Restore a session from disk storage."""
        try:
            session_file = self.sessions_dir / f"{session_id}.json"
            if not session_file.exists():
                return None
            
            with open(session_file, "r") as f:
                data = json.load(f)
            
            # Create a new session object with the same ID
            session = InterviewSession(
                session_id=data["session_id"],
                interview_type=data["interview_type"],
                position=data["position"],
                experience_level=data["experience_level"],
                enable_proctoring=data.get("enable_proctoring", False),
                user_id=data.get("user_id"),
                user_name=data.get("username"),
                user_email=data.get("email"),
                google_sub=data.get("google_sub"),
            )
            
            # Restore state from disk
            session.start_time = datetime.fromisoformat(data["start_time"])
            if data.get("end_time"):
                session.end_time = datetime.fromisoformat(data["end_time"])
            session.interview_state = data["interview_state"]
            session.question_history = data.get("question_history", [])
            session.answer_history = data.get("answer_history", [])
            session.follow_up_count = len([q for q in session.question_history if q.get("is_follow_up", False)])
            session.current_question_index = len(session.question_history)
            session.difficulty_level = data.get("difficulty_level", "medium")
            session.interview_state = data.get("interview_state", "in_progress")
            session.final_gemini_report = data.get("final_gemini_report")
            session.memory.load_from_file()
            
            print(f"[SESSION MANAGER] Restored session {session_id} from disk")
            return session
        except Exception as e:
            print(f"[SESSION MANAGER] Error restoring session from disk: {e}")
            return None

    def create_session(
        self,
        interview_type: str,
        position: str,
        experience_level: str,
        enable_proctoring: bool = True,
        user_id: str | None = None,
        user_name: str | None = None,
        user_email: str | None = None,
        google_sub: str | None = None,
    ) -> InterviewSession:
        """Create new interview session."""
        session_id = str(uuid.uuid4())
        session = InterviewSession(
            session_id=session_id,
            interview_type=interview_type,
            position=position,
            experience_level=experience_level,
            enable_proctoring=enable_proctoring,
            user_id=user_id,
            user_name=user_name,
            user_email=user_email,
            google_sub=google_sub,
        )
        session.start()
        # Save immediately to ensure persistence
        session.save_session()
        self.sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> Optional[InterviewSession]:
        """Get interview session by ID, restoring from disk if needed."""
        # First try to get from memory
        if session_id in self.sessions:
            return self.sessions[session_id]
        
        # Try to restore from disk
        session = self._restore_session_from_disk(session_id)
        if session:
            self.sessions[session_id] = session
            return session
        
        return None

    def end_session(self, session_id: str) -> bool:
        """End interview session."""
        session = self.get_session(session_id)
        if not session:
            return False
        
        session.end()
        session.save_session()
        # Remove from memory to prevent stale references
        if session_id in self.sessions:
            del self.sessions[session_id]
        return True
    
    def delete_session(self, session_id: str) -> bool:
        """Permanently delete a session."""
        try:
            session_file = self.sessions_dir / f"{session_id}.json"
            if session_file.exists():
                session_file.unlink()
            # Also remove from memory
            if session_id in self.sessions:
                del self.sessions[session_id]
            return True
        except Exception as e:
            print(f"[SESSION MANAGER] Error deleting session: {e}")
            return False


# Global session manager
session_manager = InterviewSessionManager()

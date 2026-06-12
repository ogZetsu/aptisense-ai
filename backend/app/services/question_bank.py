"""Question bank and adaptive question selection."""
import json
from typing import Dict, List, Any, Optional
from pathlib import Path
from app.core.config import settings


class QuestionBankService:
    """Manages question bank and adaptive selection."""

    def __init__(self):
        """Initialize question bank."""
        self.questions_file = Path(settings.DATA_DIR) / "questions.json"
        self.questions = self._load_questions()
        self.selected_questions: Dict[str, List[str]] = {}  # session_id -> list of question_ids

    def _load_questions(self) -> Dict[str, List[Dict[str, Any]]]:
        """Load questions from file."""
        try:
            if self.questions_file.exists():
                with open(self.questions_file, "r") as f:
                    questions = json.load(f)
                    return self._normalize_question_bank(questions)
        except Exception as e:
            print(f"Error loading questions: {e}")

        print("Warning: questions.json not found. Interview question bank is empty until seeded.")
        return {}

    def _normalize_question(self, question: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize a question entry to support legacy and new field names."""
        normalized_text = question.get("text") or question.get("question") or ""

        return {
            "id": str(question.get("id", "")),
            "text": normalized_text,
            "question": normalized_text,
            "difficulty": question.get("difficulty", "medium"),
            "category": question.get("category", "general"),
        }

    def _normalize_question_bank(self, questions: Dict[str, List[Dict[str, Any]]]) -> Dict[str, List[Dict[str, Any]]]:
        """Normalize all questions in the bank."""
        return {
            interview_type: [self._normalize_question(question) for question in question_list]
            for interview_type, question_list in questions.items()
        }

    def get_next_question(
        self,
        interview_type: str,
        session_id: str,
        difficulty_level: str = "medium",
        exclude_ids: Optional[List[str]] = None,
        category_preference: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Get next question with adaptive difficulty.
        
        Args:
            interview_type: Type of interview (hr, technical, mixed)
            session_id: Interview session ID
            difficulty_level: Current difficulty (easy, medium, hard)
            exclude_ids: Question IDs to exclude
            category_preference: Preferred question category
            
        Returns:
            Next question or None if no questions available
        """
        if exclude_ids is None:
            exclude_ids = []
        
        # Get questions of appropriate type
        questions = self.questions.get(interview_type, [])
        if not questions:
            return None
        
        # Filter by difficulty and exclusion
        available = [
            q for q in questions
            if q.get("difficulty") == difficulty_level and q["id"] not in exclude_ids
        ]
        
        # Prefer category if specified
        if category_preference:
            category_questions = [q for q in available if q.get("category") == category_preference]
            if category_questions:
                available = category_questions
        
        # Select question (preferring ones not recently selected)
        if not available:
            # If no questions at difficulty, try adjacent difficulty
            if difficulty_level == "easy":
                available = [q for q in questions if q.get("difficulty") == "medium" and q["id"] not in exclude_ids]
            elif difficulty_level == "hard":
                available = [q for q in questions if q.get("difficulty") == "medium" and q["id"] not in exclude_ids]
            else:  # medium
                available = [q for q in questions if q.get("difficulty") in ["easy", "hard"] and q["id"] not in exclude_ids]
        
        if not available:
            return None
        
        # Return first available
        selected = available[0]
        
        # Track selection
        if session_id not in self.selected_questions:
            self.selected_questions[session_id] = []
        self.selected_questions[session_id].append(selected["id"])
        
        return selected

    def get_adaptive_difficulty(
        self,
        current_difficulty: str,
        performance_score: float,
        threshold: float = settings.ADAPTIVE_DIFFICULTY_THRESHOLD,
    ) -> str:
        """
        Calculate adaptive difficulty based on performance.
        
        Args:
            current_difficulty: Current difficulty level
            performance_score: Performance score (0-100)
            threshold: Threshold for difficulty change (0-1 scale)
            
        Returns:
            New difficulty level
        """
        # Normalize performance to 0-1 scale
        normalized_performance = performance_score / 100
        
        if current_difficulty == "easy":
            if normalized_performance >= threshold:
                return "medium"
            return "easy"
        elif current_difficulty == "hard":
            if normalized_performance < threshold:
                return "medium"
            return "hard"
        else:  # medium
            if normalized_performance >= threshold:
                return "hard"
            elif normalized_performance < (threshold - 0.2):
                return "easy"
            return "medium"

    def get_category_distribution(self, interview_type: str) -> Dict[str, int]:
        """Get distribution of questions by category."""
        questions = self.questions.get(interview_type, [])
        distribution = {}
        
        for q in questions:
            category = q.get("category", "uncategorized")
            distribution[category] = distribution.get(category, 0) + 1
        
        return distribution

    def add_question(
        self,
        interview_type: str,
        text: str,
        difficulty: str,
        category: str,
    ) -> str:
        """Add new question to bank."""
        if interview_type not in self.questions:
            self.questions[interview_type] = []
        
        question_id = f"{interview_type}_{len(self.questions[interview_type]):03d}"
        
        question = {
            "id": question_id,
            "text": text,
            "question": text,
            "difficulty": difficulty,
            "category": category,
        }
        
        self.questions[interview_type].append(question)
        
        # Save to file
        self._save_questions()
        
        return question_id

    def _save_questions(self) -> None:
        """Save questions to file."""
        try:
            self.questions_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.questions_file, "w") as f:
                json.dump(self.questions, f, indent=2)
        except Exception as e:
            print(f"Error saving questions: {e}")


# Global question bank
question_bank = QuestionBankService()

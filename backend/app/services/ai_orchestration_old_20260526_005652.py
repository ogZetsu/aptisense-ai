"""AI orchestration service for intelligent interview analysis and follow-ups."""
import logging
import json
import os
import re
import time
from typing import Dict, List, Any, Optional, Tuple
import random
import google.generativeai as genai
from app.core.config import settings
from app.schemas.analysis import AnalysisModel, RecommendationModel
from pydantic import ValidationError


class AIOrchestrationService:
    """Orchestrates Gemini AI for intelligent interview analysis."""

    RECENT_PHRASES_LIMIT = 12

    def __init__(self):
        """Initialize AI service."""
        api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not configured")
        genai.configure(api_key=api_key)
        # Try configured model, but fall back to known compatible names if unavailable
        preferred_models = [settings.GEMINI_MODEL] if settings.GEMINI_MODEL else []
        preferred_models += [
            "models/text-bison-001",
            "chat-bison-001",
            "models/chat-bison-001",
            "gemini-1.0",
        ]

        last_exc = None
        self.model = None
        for m in preferred_models:
            if not m:
                continue
            try:
                self.model = genai.GenerativeModel(m)
                # store the actual model name chosen for diagnostics
                self.chosen_model = m
                break
            except Exception as e:
                last_exc = e
                try:
                    # best-effort logging
                    print(f"[AIOrchestrationService] model {m} not available: {e}")
                except Exception:
                    pass

        if self.model is None:
            raise last_exc or RuntimeError("No valid generative model available")
        self.logger = logging.getLogger("app.ai_orchestration")
        self._recent_phrases: List[str] = []
        try:
            self.logger.info("Using generative model: %s", getattr(self, "chosen_model", "unknown"))
        except Exception:
            pass
        self.logger = logging.getLogger("app.ai_orchestration")

    def generate_interviewer_turn(
        self,
        question: str,
        answer: str,
        category: str,
        difficulty: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Generate a single recruiter-style answer analysis and follow-up in one Gemini call."""
        prompt = self._build_interviewer_turn_prompt(question, answer, category, difficulty, context)

        # Debug: log the full prompt and context for one-off troubleshooting
        try:
            self.logger.debug("Interviewer turn prompt:\n%s", prompt)
            print("[AIOrchestrationService] Interviewer turn prompt:\n", prompt)
        except Exception:
            pass

        try:
            response_text = self._call_model(prompt)
            # Always attempt to parse what Gemini returned, even if it's not strict JSON
            analysis = self._parse_analysis_response(response_text)
            # Log raw response for inspection
            try:
                self.logger.debug("Interviewer turn raw response: %s", response_text)
                print("[AIOrchestrationService] Interviewer turn raw response:\n", response_text)
            except Exception:
                pass

            normalized = self._normalize_turn_payload(analysis or {}, question, answer, category, difficulty, context)
            if normalized:
                return normalized

            # Only fallback when normalization cannot produce a usable turn
            return self._fallback_interviewer_turn(question, answer, category, difficulty, context)

        except Exception as e:
            # Log exception and indicate fallback
            try:
                self.logger.exception("Interviewer turn failed, using fallback: %s", e)
                print(f"[AIOrchestrationService] Interviewer turn failed, using fallback: {e}")
            except Exception:
                pass
            return self._fallback_interviewer_turn(question, answer, category, difficulty, context)

    def _build_interviewer_turn_prompt(
        self,
        question: str,
        answer: str,
        category: str,
        difficulty: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Build a single-turn prompt that returns analysis and a follow-up question."""
        context = context or {}
        recent_questions = context.get("recent_questions", [])
        recent_answers = context.get("recent_answers", [])
        recent_feedback = context.get("recent_feedback", [])
        conversation_theme = context.get("conversation_theme", "general")
        candidate_focus_areas = context.get("candidate_focus_areas", [])

        category_rules = {
            "hr": "Focus on confidence, self-introduction quality, motivation, and clarity of communication.",
            "technical": "Focus on concept clarity, correctness, depth of explanation, trade-offs, and precision.",
            "behavioral": "Focus on teamwork, leadership, conflict handling, ownership, and practical examples.",
            "communication": "Focus on fluency, articulation, sentence structure, pacing, and speaking confidence.",
        }

        category_focus = category_rules.get(category.lower(), "Focus on recruiter-style evaluation and a natural next question.")

        # New directive: ask the model to produce a single, natural recruiter message
        prompt = (
            "You are a human recruiter conducting a live interview. Respond naturally in one realistic recruiter turn that does three things:\n"
            "1) briefly acknowledge the candidate's answer in a human way;\n"
            "2) keep any evaluative comment light and recruiter-appropriate, never academic or coaching-first; and\n"
            "3) continue the conversation with one natural follow-up question that flows from the reply.\n\n"
            "The primary goal is a live recruiter conversation, not a grading report. Do NOT sound like an evaluator, a coach, or an assessment engine.\n"
            "Do NOT start with coaching phrase patterns such as 'That’s a useful start', 'Good attempt', 'Add a specific example', 'Please provide more details', 'Consider elaborating', or 'Provide stronger examples'.\n"
            "If the answer is short, politely ask for elaboration instead of criticizing.\n"
            "Do NOT run any internal rewriting or templating — produce a human-sounding utterance that a recruiter would say live in an interview.\n\n"
            f"INTERVIEW TYPE: {category}\n"
            f"DIFFICULTY: {difficulty}\n"
            f"CURRENT QUESTION: {question}\n"
            f"CANDIDATE ANSWER:\n{answer}\n\n"
            f"RECENT CONTEXT: Theme={conversation_theme}; RecentQuestions={' | '.join(recent_questions[-3:]) if recent_questions else 'none'}; RecentAnswers={' | '.join(recent_answers[-3:]) if recent_answers else 'none'}\n\n"
            "Return ONLY valid JSON with the following fields:\n"
            "{\n"
            "  \"technical_score\": 0-100,\n"
            "  \"communication_score\": 0-100,\n"
            "  \"confidence_score\": 0-100,\n"
            "  \"clarity_score\": 0-100,\n"
            "  \"relevance_score\": 0-100,\n"
            "  \"depth_score\": 0-100,\n"
            "  \"vocabulary_score\": 0-100,\n"
            "  \"hesitation_indicators\": 0-100,\n"
            "  \"overall_impression\": \"short 1-2 sentence senior recruiter observation\",\n"
            "  \"recruiter_message\": \"A single natural recruiter utterance that includes reaction, evaluation, and the next question in one flow\",\n"
            "  \"strengths\": [\"specific strength from the answer\"],\n"
            "  \"areas_for_improvement\": [\"specific improvement from the answer\"],\n"
            "  \"feedback\": [\"actionable feedback 1\", \"actionable feedback 2\"],\n"
            "  \"is_well_structured\": true,\n"
            "  \"demonstrates_problem_solving\": true,\n"
            "  \"shows_leadership\": false,\n"
            "  \"has_specific_examples\": true,\n"
            "  \"difficulty_adjustment\": \"increase|maintain|decrease\",\n"
            "  \"hiring_potential\": \"excellent|good|moderate|needs_improvement\"\n"
            "}\n\n"
            "Hard requirements:\n"
            "- The field 'recruiter_message' must be a single, complete, human-sounding recruiter utterance combining reaction, evaluation, and a follow-up question.\n"
            "- Do NOT include separate coaching prompts or fallback generator text.\n"
            "- Do not output any internal instructions or JSON within the 'recruiter_message' field.\n"
        )
        return prompt

    def _normalize_turn_payload(
        self,
        payload: Dict[str, Any],
        question: str,
        answer: str,
        category: str,
        difficulty: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Validate and normalize the single-turn payload."""
        # If payload looks structurally valid, use it directly
        if payload and self._validate_analysis(payload):
            model = AnalysisModel.parse_obj(payload)
            normalized = model.dict()
        else:
            # Start from a conservative rule-based base and overlay any usable fields
            normalized = self._fallback_analysis(question, answer, category)
            # overlay any fields returned by Gemini (prefer Gemini text values)
            for k, v in (payload or {}).items():
                if v is None:
                    continue
                normalized[k] = v

        # Use model-provided follow-up only; do not generate fallback follow-ups here.
        # Prefer a single natural recruiter message returned by the model.
        recruiter_msg = None
        if isinstance(payload, dict):
            recruiter_msg = payload.get("recruiter_message") or payload.get("recruiter_feedback")

        # Fall back to any normalized field if model did not provide recruiter_message
        if not recruiter_msg:
            recruiter_msg = normalized.get("recruiter_feedback") or normalized.get("overall_impression") or ""

        # Assign the recruiter message directly without additional humanization or templating
        normalized["recruiter_feedback"] = recruiter_msg

        # Try to extract a single follow-up question from the recruiter message (last sentence ending with '?')
        follow_up = ""
        try:
            m = re.findall(r"([^\n\r]*\?)", recruiter_msg)
            if m:
                follow_up = m[-1].strip()
        except Exception:
            follow_up = ""

        normalized["follow_up_question"] = follow_up or None

        return normalized

    def _humanize_recruiter_feedback(self, feedback: str, answer: str, context: Dict[str, Any], category: str) -> str:
        """Post-process raw feedback to sound more human and emotionally intelligent.

        This layer references a short candidate quote when possible, varies phrasing,
        and avoids analytic or instruction-like openings.
        """
        if not feedback or not isinstance(feedback, str):
            return "I appreciated your answer; a bit more detail would help in a live interview."

        # Clean the feedback
        fb = re.sub(r"\s+", " ", feedback).strip()

        # Extract a short candidate quote to cite (prefer a sentence or first 6-10 words)
        candidate_quote = ""
        try:
            # pick first sentence if available
            first_sentence = re.split(r"[\.\n]", answer.strip())[0]
            words = first_sentence.split()
            if len(words) > 0:
                candidate_quote = " ".join(words[:8])
        except Exception:
            candidate_quote = "your answer"

        # Normalize quote for inclusion
        candidate_quote = candidate_quote.strip()
        if len(candidate_quote) > 60:
            candidate_quote = candidate_quote[:57] + "..."

        # Small pool of recruiter-sounding lead-ins to make feedback feel human and warm
        lead_ins = [
            f"You mentioned \"{candidate_quote}\", and that gives a strong starting point",
            f"Nice detail: \"{candidate_quote}\"",
            "Good point —",
            "I liked how you described \"{candidate_quote}\"",
            "You mentioned \"{candidate_quote}\",",
            "One useful point is",
            "A strong element of your answer was",
            "What stands out here is",
            "I appreciate this detail:",
            "A clear highlight is",
        ]

        # If the feedback already contains first-person empathetic language, prefer it
        normalized_fb = fb[0].upper() + fb[1:]

        # Choose a lead-in randomly to increase variety
        try:
            lead = random.choice(lead_ins)
        except Exception:
            lead = lead_ins[0]

        # Avoid doubling if feedback already begins with a warm or first-person opener
        lower_fb = normalized_fb.lower()
        if any(lower_fb.startswith(prefix) for prefix in ["thanks", "i appreciate", "that", "i hear", "nice", "good", "helpful", "i like"]):
            human = normalized_fb
        else:
            # Prefer concise combined sentence
            if len(normalized_fb) < 100:
                human = f"{lead} {normalized_fb}"
            else:
                human = normalized_fb

        # Final cleanup: avoid orchestration-like phrases
        human = re.sub(r"\b(overall impression|the answer|the AI reviewed)\b", "", human, flags=re.IGNORECASE).strip()
        human = re.sub(r"\s+", " ", human).strip()

        # Ensure it reads naturally (capitalization and punctuation)
        if human and human[-1] not in ".!?":
            human += "."

        return human

    def _get_candidate_quote(self, answer: str, max_words: int = 10) -> str:
        """Extract a concise candidate quote from the first sentence of the answer."""
        if not isinstance(answer, str):
            return ""
        answer = answer.strip()
        if not answer:
            return ""
        first_sentence = re.split(r"[\.\n\?!]", answer.strip())[0]
        words = re.findall(r"\w+['-]?\w*", first_sentence)
        quote = " ".join(words[:max_words])
        return quote[:57] + "..." if len(quote) > 60 else quote

    def _fallback_interviewer_turn(
        self,
        question: str,
        answer: str,
        category: str,
        difficulty: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Produce a specific non-generic fallback when Gemini fails."""
        base = self._fallback_analysis(question, answer, category)
        follow_up = self._generate_contextual_follow_up(question, answer, category, context or {}, base)
        base["follow_up_question"] = follow_up
        base["recruiter_feedback"] = self._fallback_recruiter_feedback(question, answer, category)
        return base

    def _generate_contextual_follow_up(
        self,
        question: str,
        answer: str,
        category: str,
        context: Dict[str, Any],
        analysis: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Generate a deterministic but contextual follow-up when Gemini output is unusable."""
        analysis = analysis or {}
        answer_lower = answer.lower()
        quote = self._get_candidate_quote(answer)
        recent_questions = context.get("recent_questions", [])
        recent_follow_ups = context.get("recent_follow_ups", [])

        candidates: List[str] = []
        if category.lower() == "hr":
            if len(answer.split()) <= 8:
                candidates.append("I’d like one story that shows why this role fits you.")
            if any(term in answer_lower for term in ["passionate", "hardworking", "motivated"]):
                candidates.append("What example makes that strength feel real in your experience?")
            if quote:
                candidates.append(f"You said '{quote}'; what happened next in that situation?")
            candidates.append("Which part of your background makes you especially excited for this role?")
        elif category.lower() == "technical":
            if "sql" in answer_lower and "nosql" in answer_lower:
                candidates.append("Which NoSQL database have you used, and why would it be the better fit there?")
            if any(term in answer_lower for term in ["algorithm", "time complexity", "space complexity", "optimized"]):
                candidates.append("What trade-off or edge case did you think about when you designed that solution?")
            if any(term in answer_lower for term in ["memory", "garbage collection", "pointer", "manual memory"]):
                candidates.append("How would that decision change if memory or performance were the priority?")
            if quote:
                candidates.append(f"You mentioned '{quote}'; how did you put that into code or architecture?")
            candidates.append("What would you describe next to complete that technical picture?")
        elif category.lower() == "behavioral":
            if len(answer.split()) <= 10:
                candidates.append("Can you tell me one concrete action you took and what the result was?")
            if any(term in answer_lower for term in ["team", "conflict", "lead", "collaborat", "stakeholder"]):
                candidates.append("What specific action did you take in that team situation?")
            if quote:
                candidates.append(f"You said '{quote}'; what was the outcome of that action?")
            candidates.append("How did that experience change how you handle similar situations now?")
        elif category.lower() == "communication":
            if len(answer.split()) <= 10:
                candidates.append("Can you say that again with a clearer opening and one concrete detail?")
            if any(term in answer_lower for term in ["uh", "um", "i think", "like"]):
                candidates.append("If you had to say that in 30 seconds, how would you phrase it?")
            if quote:
                candidates.append(f"You said '{quote}'; how would you make that point sharper for a non-technical listener?")
            candidates.append("How would you explain that same idea to someone who isn’t technical?")
        else:
            candidates.append("What part of that answer would you expand if you had another 30 seconds?")

        candidates.extend([
            "If you had another 30 seconds, how would you add one more detail to make that clearer?",
            "What would you say next to complete the picture for me?",
            "How would you explain the most important part of that answer in one sentence?",
        ])

        random.shuffle(candidates)
        for candidate in candidates:
            cleaned = self._dedupe_follow_up(candidate, question, answer, category, context, analysis, allow_fallback=False)
            if cleaned and cleaned not in recent_follow_ups and cleaned not in recent_questions:
                # remember recent follow ups to avoid repetition in the same session
                self._recent_phrases.append(cleaned.lower())
                if len(self._recent_phrases) > self.RECENT_PHRASES_LIMIT:
                    self._recent_phrases.pop(0)
                return cleaned

        # If no candidate passed dedupe, prefer a short, category-aware fallback
        quote = self._get_candidate_quote(answer)
        fallback = self._generate_fallback_follow_up(category)
        if quote:
            # make the fallback slightly more specific by referencing the candidate text
            return f"{fallback} You said '{quote}'; can you give one concrete example or detail?"
        return fallback

    def _dedupe_phrase(self, text: str, question: str, answer: str, category: str) -> str:
        """Avoid repeated generic phrases across a session."""
        if not text:
            return text

        cleaned = re.sub(r"\s+", " ", text).strip()
        normalized = cleaned.lower()
        generic_phrases = [
            "could you elaborate more on that point",
            "could you provide more specific examples",
            "tell me more about that",
            "can you elaborate",
            "what specific part of that answer should i probe next",
            "what part of that answer",
            "what would you elaborate",
            "which part of that answer",
        ]
        # Only treat as generic if it exactly matches or starts with a known canned phrase
        if any(normalized == phrase or normalized.startswith(phrase) for phrase in generic_phrases):
            return self._fallback_recruiter_feedback(question, answer, category)
        # If extremely short and unhelpful, fallback
        if len(cleaned) < 12:
            return self._fallback_recruiter_feedback(question, answer, category)

        if normalized in self._recent_phrases:
            return self._fallback_recruiter_feedback(question, answer, category)

        return cleaned

    def _dedupe_follow_up(
        self,
        follow_up: str,
        question: str,
        answer: str,
        category: str,
        context: Dict[str, Any],
        analysis: Optional[Dict[str, Any]] = None,
        allow_fallback: bool = True,
    ) -> str:
        """Ensure the follow-up is not repeated or generic."""
        cleaned = re.sub(r"\s+", " ", (follow_up or "")).strip()
        # remove surrounding quotes or backslashes if present
        cleaned = re.sub(r'^[\"\'"\\]+|[\"\'"\\]+$', '', cleaned)
        if not cleaned:
            return "" if not allow_fallback else self._generate_contextual_follow_up(question, answer, category, context, analysis)

        normalized = cleaned.lower()
        forbidden = [
            "could you elaborate more on that point",
            "could you provide more specific examples",
            "tell me more about that",
            "can you elaborate",
            "what specific part of that answer should i probe next",
            "what part of that answer",
            "which part of that answer",
            "what would you elaborate",
        ]
        # Reject or rewrite exact matches of generic/orchestration prompts
        if any(normalized == item or normalized.startswith(item) for item in forbidden):
            quote = self._get_candidate_quote(answer)
            if quote:
                return f"When you said '{quote}', could you tell me a bit more about what happened there?"
            return "Could you share one more detail so I understand that better?"

        # Avoid repeating the exact same follow-up within the recent history
        if normalized in self._recent_phrases:
            # Instead of immediate fallback, allow the follow-up if it contains additional context
            if len(normalized) > 30:
                return cleaned
            return ""

        # Short follow-ups are allowed; only reject extremely short ones
        if len(cleaned) < 6:
            return "" if not allow_fallback else self._generate_contextual_follow_up(question, answer, category, context, analysis)

        return cleaned

    def _remember_phrase(self, phrase: str) -> None:
        """Track recent phrases so we can avoid repeating them."""
        normalized = re.sub(r"\s+", " ", (phrase or "")).strip().lower()
        if not normalized:
            return
        self._recent_phrases.append(normalized)
        if len(self._recent_phrases) > self.RECENT_PHRASES_LIMIT:
            self._recent_phrases = self._recent_phrases[-self.RECENT_PHRASES_LIMIT :]

    def analyze_answer(
        self,
        question: str,
        answer: str,
        category: str,
        difficulty: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Intelligently analyze candidate answer using Gemini.
        
        Args:
            question: The question asked
            answer: Candidate's answer
            category: Question category (hr, technical, etc.)
            difficulty: Question difficulty (easy, medium, hard)
            context: Optional context from interview memory
            
        Returns:
            Comprehensive analysis with scores and feedback
        """
        prompt = self._build_analysis_prompt(
            question, answer, category, difficulty, context
        )

        try:
            response_text = self._call_model(prompt)
            # Log raw response for debugging
            try:
                self.logger.debug("Raw model response text: %s", response_text)
                print("[AIOrchestrationService] Raw model response:", response_text)
            except Exception:
                pass
            json_str = self._extract_json_block(response_text)
            if json_str:
                analysis = json.loads(json_str)
                try:
                    model = AnalysisModel.parse_obj(analysis)
                    return model.dict()
                except ValidationError:
                    # fall through to more forgiving parse
                    pass
            # If parsing/validation failed, try parsing free text fallback
            return self._parse_analysis_response(response_text)
        except Exception:
            return self._fallback_analysis(question, answer, category)

    def _build_analysis_prompt(
        self,
        question: str,
        answer: str,
        category: str,
        difficulty: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Build detailed prompt for AI analysis."""
        context_str = ""
        if context:
            context_str = f"""
Previous Interview Context:
- Identified Strengths: {', '.join(context.get('identified_strengths', []))}
- Areas for Improvement: {', '.join(context.get('identified_weaknesses', []))}
- Focus Areas: {', '.join(context.get('candidate_focus_areas', []))}
"""

        prompt = f"""You are a senior recruiter, Principal Software Engineer, and elite technical bar raiser conducting a live interview. Analyze the candidate's response with professional rigor and speak like a human interviewer.

CANDIDATE AND QUESTION DETAIL:
- Category: {category}
- Difficulty Level: {difficulty}
- Core Interview Question: {question}

CANDIDATE'S DETAILED RESPONSE:
\"\"\"
{answer}
\"\"\"

{context_str}

    Evaluate the candidate's performance across technical mastery (especially algorithmic correctness, structural knowledge, and time/space complexity analysis if a technical question), depth of thought, communication effectiveness, and clarity. Avoid generic, robotic templates. Your observations must be customized and cite exact words or phrases from the candidate when possible.

    The most important output is a recruiter-style reaction that reads like a live interviewer: conversational, varied in phrasing, and grounded in the candidate's exact reply. Explicitly reference one prior answer or memory item when available (e.g., 'Earlier you said X...'), name one concrete strength with citation, one specific improvement with actionable advice, and a natural next step for improvement. Avoid canned openings like "That is a great explanation"; start directly with the observation.
Provide a structured, highly parsable JSON analysis matching this schema:
{{
    "technical_score": <0-100 score indicating depth of conceptual understanding, algorithmic accuracy, and technical exactness>,
    "communication_score": <0-100 score evaluating clarity, sentence structuring, speed, and articulate explanation>,
    "confidence_score": <0-100 score assessing certainty, lack of hesitations, and fluid speaking posture>,
    "clarity_score": <0-100 score for conciseness and logical structure>,
    "relevance_score": <0-100 score for addressing the exact question asked without wandering>,
    "depth_score": <0-100 score for explaining underlying mechanics and edge-cases rather than high-level summaries>,
    "vocabulary_score": <0-100 score evaluating proper industry-standard/academic terminology usage>,
    "hesitation_indicators": <0-100 score, high indicates frequent pauses, fillers, or uncertainty>,
    "overall_impression": "<A custom 1-2 sentence senior recruiter observation reflecting the exact technical depth and communication style shown>",
    "recruiter_feedback": "<A natural, human recruiter-style spoken reaction to this exact answer>",
    "strengths": ["<Specific strength with citation from their words>", "<Second specific strength>", ...],
    "areas_for_improvement": ["<Concrete improvement recommendation referencing their words>", "<Second improvement suggestion>", ...],
    "feedback": ["<Actionable, detailed feedback point 1>", "<Actionable, detailed feedback point 2>", "<Actionable, detailed feedback point 3>"],
    "is_well_structured": <true/false>,
    "demonstrates_problem_solving": <true/false>,
    "shows_leadership": <true/false>,
    "has_specific_examples": <true/false>,
    "difficulty_adjustment": "<increase|maintain|decrease>",
    "hiring_potential": "<excellent|good|moderate|needs_improvement>"
}}

    Ensure all feedback points are constructive, direct, highly professional, and customized. Vary sentence openings across calls and avoid repeating identical feedback across the session.
"""
        
        return prompt

    def _parse_analysis_response(self, response_text: str) -> Dict[str, Any]:
        """Parse Gemini response into structured analysis."""
        try:
            json_str = self._extract_json_block(response_text)
            if json_str:
                analysis = json.loads(json_str)
                if self._validate_analysis(analysis):
                    return analysis
        except (json.JSONDecodeError, ValueError):
            pass

        # If we couldn't extract strict JSON, try to heuristically extract useful fields
        analysis = {}
        if not response_text:
            return self._fallback_analysis_from_text(response_text)

        # Heuristic: find a follow-up question (last sentence ending with '?')
        try:
            sentences = re.split(r"(?<=[\.\!\?])\s+", response_text.strip())
            # find last sentence that is a question
            follow = None
            for s in reversed(sentences):
                if s.strip().endswith('?') and len(s.strip()) > 5:
                    follow = s.strip().strip('"')
                    break
            if follow:
                analysis['follow_up_question'] = follow
        except Exception:
            pass

        # Heuristic: pick first 1-2 sentences as recruiter feedback if present
        try:
            # remove any JSON-like remnants
            plain = re.sub(r"\{.*\}", "", response_text, flags=re.S)
            parts = re.split(r"\n\s*\n|\n", plain)
            # choose first non-empty block
            for block in parts:
                block = block.strip()
                if not block:
                    continue
                # limit to 2 sentences
                sents = re.split(r'(?<=[\.\!\?])\s+', block)
                feedback = ' '.join(sents[:2]).strip()
                if feedback:
                    analysis['recruiter_feedback'] = feedback
                    break
        except Exception:
            pass

        # Return heuristically assembled analysis (may be partial)
        return analysis

    def _call_model(self, prompt: str, max_retries: int = 3, initial_delay: float = 1.0) -> str:
        """Call the Gemini model with simple retry/backoff and return text."""
        delay = initial_delay
        last_err = None
        for attempt in range(1, max_retries + 1):
            try:
                # Debug: log the request prompt (truncated to avoid extremely large logs)
                try:
                    self.logger.debug("Model request prompt (truncated): %s", prompt[:4000])
                    print("[AIOrchestrationService] Model request prompt (truncated):\n", prompt[:4000])
                except Exception:
                    pass

                response = self.model.generate_content(prompt)
                # debug log the full response object if possible
                try:
                    self.logger.debug("Model generate_content response: %s", repr(response))
                except Exception:
                    pass
                text = getattr(response, "text", None)
                if text is None and hasattr(response, "candidates"):
                    # Some SDKs return candidates list
                    candidates = getattr(response, "candidates", [])
                    if candidates:
                        text = candidates[0].get("content") if isinstance(candidates[0], dict) else str(candidates[0])
                return text or ""
            except Exception as e:
                last_err = e
                # log exception per-attempt for visibility
                try:
                    self.logger.exception("Model call attempt %s failed: %s", attempt, e)
                    print(f"[AIOrchestrationService] model call attempt {attempt} failed: {e}")
                except Exception:
                    pass
                # If the error indicates the configured model is not available for this API,
                # try a few known compatible model names and retry a single time.
                err_text = str(e).lower()
                if "not found" in err_text or "not supported" in err_text or "is not found" in err_text:
                    fallback_names = [
                        "models/text-bison-001",
                        "chat-bison-001",
                        "models/chat-bison-001",
                        "gemini-1.0",
                    ]
                    for alt in fallback_names:
                        try:
                            try:
                                self.logger.info("Attempting fallback model: %s", alt)
                            except Exception:
                                pass
                            self.model = genai.GenerativeModel(alt)
                            response = self.model.generate_content(prompt)
                            text = getattr(response, "text", None)
                            if text is None and hasattr(response, "candidates"):
                                candidates = getattr(response, "candidates", [])
                                if candidates:
                                    text = candidates[0].get("content") if isinstance(candidates[0], dict) else str(candidates[0])
                            return text or ""
                        except Exception as alt_e:
                            try:
                                self.logger.warning("Fallback model %s failed: %s", alt, alt_e)
                                print(f"[AIOrchestrationService] fallback model {alt} failed: {alt_e}")
                            except Exception:
                                pass
                time.sleep(delay)
                delay *= 2
        raise last_err

    def _extract_json_block(self, text: str) -> Optional[str]:
        """Extract the first JSON object block from text using brace counting."""
        if not text:
            return None
        start = text.find("{")
        if start == -1:
            return None
        depth = 0
        for i in range(start, len(text)):
            ch = text[i]
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return text[start : i + 1]
        return None

    def _validate_analysis(self, analysis: Dict[str, Any]) -> bool:
        """Quick validation to ensure required fields exist and have reasonable types."""
        required_numeric = [
            "technical_score",
            "communication_score",
            "confidence_score",
            "clarity_score",
            "relevance_score",
        ]
        for key in required_numeric:
            if key not in analysis:
                return False
            try:
                val = float(analysis.get(key, 0))
            except Exception:
                return False
        # strengths and areas_for_improvement should be lists
        if not isinstance(analysis.get("strengths", []), list):
            return False
        if not isinstance(analysis.get("areas_for_improvement", []), list):
            return False
        return True

    def generate_follow_up_question(
        self,
        last_question: str,
        last_answer: str,
        category: str,
        context: Dict[str, Any],
        follow_up_count: int = 1,
    ) -> str:
        """
        Generate intelligent follow-up question.
        
        Args:
            last_question: Previous question
            last_answer: Candidate's answer
            category: Question category
            context: Interview context
            follow_up_count: Which follow-up this is
            
        Returns:
            Contextual follow-up question
        """
        prompt = f"""You are a senior recruiter and Principal Software Engineer acting as an elite live interviewer. Generate a single, adaptive follow-up question that directly probes the candidate's exact response and, where appropriate, references earlier comments from session memory. You may include a very short, empathetic connector (one short clause) if it makes the probe feel more natural, but the probe itself must be crisp and start quickly.

CONTEXT:
- Round Category: {category}
- Original Question Asked: {last_question}
- Candidate's Exact Response:
\"\"\"
{last_answer}
\"\"\"

INTERVIEW MEMORY STATE:
- Candidate Strengths so far: {', '.join(context.get('identified_strengths', []))}
- Areas for Improvement: {', '.join(context.get('identified_weaknesses', []))}
- Focus Areas: {', '.join(context.get('candidate_focus_areas', []))}
- Follow-up Count: {follow_up_count}

Generate a SINGLE follow-up question. Follow these strict directives:
1. Do NOT repeat or rephrase the original question.
2. Where possible, reference a past candidate statement from the provided memory context (e.g., 'Earlier you mentioned X; can you explain...').
3. Directly reference specific concepts, claims, technologies, or algorithms the candidate mentioned. Challenge them to explain mechanics, edge-cases, or trade-offs.
4. For technical answers, probe deep into complexity, resource constraints, or failure modes. For behavioral answers, ask for concrete actions and outcomes. For HR, ask for motivations tied to past examples.
5. The question must feel live and dialogic—start immediately with the probe (no lead-in phrases) and keep it concise.

Return ONLY the question text, with no introductory text, surrounding markdown, or extra explanations."""

        try:
            # Debug: log follow-up prompt
            try:
                self.logger.debug("Follow-up prompt:\n%s", prompt)
                print("[AIOrchestrationService] Follow-up prompt:\n", prompt)
            except Exception:
                pass

            response_text = self._call_model(prompt)
            follow_up = (response_text or "").strip()
            try:
                self.logger.debug("Follow-up raw response: %s", follow_up)
                print("[AIOrchestrationService] Follow-up raw response:\n", follow_up)
            except Exception:
                pass
            follow_up = follow_up.strip('"\'')
            return follow_up
        except Exception as e:
            try:
                self.logger.exception("Follow-up generation failed, using fallback: %s", e)
                print(f"[AIOrchestrationService] Follow-up generation failed, using fallback: {e}")
            except Exception:
                pass
            return self._generate_fallback_follow_up(category)

    def generate_recruiter_recommendation(
        self,
        session_data: Dict[str, Any],
        metrics: Dict[str, float],
        proctoring_integrity: float,
    ) -> Dict[str, Any]:
        """
        Generate professional recruiter recommendation.
        
        Args:
            session_data: Complete session data
            metrics: Interview metrics
            proctoring_integrity: Proctoring integrity score
            
        Returns:
            Recruiter recommendation with action items
        """
        prompt = f"""You are an expert hiring manager reviewing a candidate interview.

CANDIDATE METRICS:
- Overall Score: {metrics.get('overall_score', 0):.1f}
- Communication: {metrics.get('communication_score', 0):.1f}
- Technical: {metrics.get('technical_score', 0):.1f}
- Confidence: {metrics.get('confidence_score', 0):.1f}
- Problem Solving: {metrics.get('problem_solving_score', 0):.1f}
- Behavioral: {metrics.get('behavioral_score', 0):.1f}
- Proctoring Integrity: {proctoring_integrity:.1f}

INTERVIEW SUMMARY:
{json.dumps(session_data.get('summary', {}), indent=2)}

Provide professional hiring recommendation in JSON format:
{{
    "recommendation": "<RECOMMENDED|CONDITIONAL|NOT_RECOMMENDED|REQUIRES_REVIEW>",
    "recommended_for_round": "<technical|hr|both|none>",
    "confidence_level": "<high|medium|low>",
    "key_strengths": ["<strength1>", "<strength2>", "<strength3>"],
    "key_concerns": ["<concern1>", "<concern2>"],
    "recommendation_text": "<2-3 sentence professional summary>",
    "next_steps": ["<action1>", "<action2>"],
    "interview_quality": "<professional observation>"
}}

Be fair, specific, and hiring-focused."""

        try:
            response_text = self._call_model(prompt)
            json_str = self._extract_json_block(response_text)
            if json_str:
                recommendation = json.loads(json_str)
                try:
                    model = RecommendationModel.parse_obj(recommendation)
                    return model.dict()
                except ValidationError:
                    pass
        except Exception:
            pass
        
        return self._fallback_recommendation(metrics)

    def _fallback_analysis(self, question: str, answer: str, category: str) -> Dict[str, Any]:
        """Fallback rule-based analysis."""
        answer_words = len(answer.split())
        
        # Base scores
        technical_score = 50
        communication_score = 60
        confidence_score = 55
        
        # Adjust based on answer length
        if answer_words > 50:
            communication_score += 20
            confidence_score += 10
        elif answer_words < 15:
            communication_score -= 15
            confidence_score -= 10
        
        # Category-specific adjustments
        if "technical" in category.lower():
            technical_score = 70 if answer_words > 30 else 45
        
        return {
            "technical_score": min(100, max(0, technical_score)),
            "communication_score": min(100, max(0, communication_score)),
            "confidence_score": min(100, max(0, confidence_score)),
            "clarity_score": 60,
            "relevance_score": 65,
            "depth_score": 55,
            "vocabulary_score": 60,
            "hesitation_indicators": 70,
            "overall_impression": "Answer provided.",
            "recruiter_feedback": self._fallback_recruiter_feedback(question, answer, category),
            "strengths": ["Provided a response"],
            "areas_for_improvement": ["Add one concrete detail to make the answer more vivid."],
            "feedback": ["Can you share a specific example or result from your experience?"],
            "is_well_structured": answer_words > 20,
            "demonstrates_problem_solving": "solved" in answer.lower() or "approach" in answer.lower(),
            "shows_leadership": "led" in answer.lower() or "team" in answer.lower(),
            "has_specific_examples": answer_words > 25,
            "difficulty_adjustment": "maintain",
            "hiring_potential": "moderate",
        }

    def _fallback_analysis_from_text(self, text: str) -> Dict[str, Any]:
        """Fallback analysis from text."""
        return self._fallback_analysis("", text, "general")

    def _fallback_recruiter_feedback(self, question: str, answer: str, category: str) -> str:
        """Create a short recruiter-style response when Gemini is unavailable."""
        answer_lower = answer.lower().strip()
        quote = self._get_candidate_quote(answer)
        # Produce natural, answer-referenced recruiter feedback
        if not answer_lower:
            return "I didn’t catch that clearly — can you say it again with one concrete example?"

        if any(term in answer_lower for term in ["i don't know", "dont know", "no idea", "not sure"]):
            return "No worries — how would you approach finding the answer if you were in a real interview?"

        # Use a quote if available to make feedback feel grounded
        if quote:
            if category.lower() == "technical":
                return f"You mentioned '{quote}'; can you walk me through one implementation detail or trade-off there?"
            if category.lower() == "behavioral":
                return f"You said '{quote}'; what did you do next, and what was the outcome?"
            if category.lower() == "communication":
                return f"You said '{quote}'; can you finish that with one clear example or result?"
            if category.lower() == "hr":
                return f"You said '{quote}'; what project or achievement best illustrates that?"

        # Short answers - ask for natural elaboration
        if len(answer.split()) < 10:
            if category.lower() == "technical":
                return "Could you say a bit more about how you applied that idea in a real project?"
            if category.lower() == "behavioral":
                return "Can you describe one action you took and what happened next?"
            if category.lower() == "communication":
                return "Could you rephrase that with a clearer opening sentence?"
            if category.lower() == "hr":
                return "Can you share one recent achievement that shows why you’d be a good fit?"

        # Longer answers: keep the response conversational
        if category.lower() == "technical":
            if any(term in answer_lower for term in ["sql", "nosql", "database"]):
                return "I get the technical direction — which database would you choose there, and why?"
            if any(term in answer_lower for term in ["algorithm", "complexity", "optimize"]):
                return "You’re on a solid path — what edge case or performance trade-off did you think about?"
            return "I hear you — could you add one practical detail that shows how you’d build that?"

        if category.lower() == "behavioral":
            return "You gave a strong example — what did you do personally, and what was the result?"

        if category.lower() == "communication":
            return "I understand — how would you explain that to someone who isn’t technical?"

        if category.lower() == "hr":
            return "That sounds interesting. Which accomplishment would you point to first?"

        # Default safe fallback
        return "I hear you. Which part of that answer would you describe in a bit more detail?"

    def analyze_aptitude_attempt(
        self,
        category: str,
        score: int,
        total_questions: int,
        attention_score: float,
        suspicious_count: int,
        tab_switches: int,
        time_seconds: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Generate a Gemini-backed analysis for a completed aptitude attempt."""
        percentage = int((score / total_questions) * 100) if total_questions else 0
        prompt = f"""You are a senior recruiter and assessment analyst reviewing a completed aptitude test only after the full test is finished.

TEST SUMMARY:
- Category: {category}
- Score: {score}/{total_questions} ({percentage}%)
- Attention Score: {attention_score:.1f}%
- Suspicious Activity Count: {suspicious_count}
- Tab Switches: {tab_switches}
- Time Taken (seconds): {time_seconds if time_seconds is not None else 'unknown'}

Write a concise but specific JSON analysis that feels like a real analyst commenting on this exact attempt. Include the candidate's strong areas, weak areas, time management, accuracy pattern, and any suspicious behavior signals. Do not produce generic study advice.

Return ONLY valid JSON with this schema:
{{
  "overall_impression": "<1-2 sentence recruiter-style summary of the completed aptitude performance>",
  "strengths": ["<specific strength>", "<specific strength>"],
  "areas_for_improvement": ["<specific weakness>", "<specific weakness>"],
  "time_management": "<comment on pace, consistency, or finishing pattern>",
  "accuracy_trends": "<comment on which part of the attempt looked strong or uneven>",
  "suspicious_activity": "<comment on tab switches, low attention, or anything suspicious>",
  "recommendation_text": "<practical next-step guidance>",
  "risk_level": "<low|medium|high>",
  "next_steps": ["<action 1>", "<action 2>"]
}}"""

        try:
            response_text = self._call_model(prompt)
            json_str = self._extract_json_block(response_text)
            if json_str:
                parsed = json.loads(json_str)
                if isinstance(parsed, dict):
                    return parsed
        except Exception:
            pass

        risk_level = "high" if suspicious_count > 3 else "medium" if suspicious_count > 0 else "low"
        return {
            "overall_impression": "The aptitude attempt was completed, but the fallback evaluator could not reach Gemini.",
            "strengths": ["Completed the assessment"],
            "areas_for_improvement": ["Improve pace, accuracy, or focus depending on the category"],
            "time_management": "Time management data was captured, but a richer AI interpretation was unavailable.",
            "accuracy_trends": f"Scored {percentage}% overall in {category}.",
            "suspicious_activity": f"Observed {suspicious_count} suspicious events and {tab_switches} tab switches.",
            "recommendation_text": "Review the weaker topic areas and repeat the test under more controlled conditions.",
            "risk_level": risk_level,
            "next_steps": ["Review missed questions", "Retake the assessment after targeted practice"],
        }

    def _generate_fallback_follow_up(self, category: str) -> str:
        """Generate fallback follow-up question."""
        category_key = (category or "").lower()
        follow_ups = {
            "hr": [
                "What did you personally do in that situation, and what was the result?",
                "Which part of that story best shows why this role fits you?",
                "How would you summarize the strongest part of your fit for this job?",
            ],
            "technical": [
                "What trade-off or edge case mattered most in your approach?",
                "How would you describe the most important implementation detail?",
                "Which technical constraint shaped your decision the most?",
            ],
            "behavioral": [
                "What did you learn from that experience that changed how you handle similar situations now?",
                "What specific action did you take and what happened next?",
                "How did that experience shape your next decision?",
            ],
            "communication": [
                "How would you tighten that explanation if you had to say it in 20 seconds?",
                "What detail would you add to make that clearer for someone outside your field?",
                "How would you rephrase that to be more concise and direct?",
            ],
        }
        default_follow_ups = [
            "Tell me one more detail from your answer so I can understand it better.",
            "If you had to add one sentence, what would it be?",
            "How would you explain the key point more clearly?",
        ]
        options = follow_ups.get(category_key, default_follow_ups)
        return random.choice(options)

    def _fallback_recommendation(self, metrics: Dict[str, float]) -> Dict[str, Any]:
        """Generate fallback recommendation."""
        overall = metrics.get("overall_score", 0)
        
        if overall >= 75:
            recommendation = "RECOMMENDED"
            next_steps = ["Schedule technical round", "Prepare offer"]
        elif overall >= 60:
            recommendation = "CONDITIONAL"
            next_steps = ["Schedule follow-up interview", "Address concerns"]
        else:
            recommendation = "NOT_RECOMMENDED"
            next_steps = ["Provide feedback", "Consider for future"]
        
        return {
            "recommendation": recommendation,
            "recommended_for_round": "technical" if overall >= 70 else "none",
            "confidence_level": "high" if overall >= 75 else "medium",
            "key_strengths": ["Communication", "Problem solving"],
            "key_concerns": ["Technical depth"] if metrics.get("technical_score", 0) < 60 else [],
            "recommendation_text": f"Candidate shows {overall:.0f}% overall performance.",
            "next_steps": next_steps,
            "interview_quality": "Completed assessment",
        }

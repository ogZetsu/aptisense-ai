from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import urllib.request
import urllib.error
import json
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/chatbot", tags=["chatbot"])

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

SYSTEM_PROMPT = """You are the AptiSense AI Assistant, a friendly and knowledgeable chatbot designed to help users navigate and get the most out of the AptiSense AI platform.

AptiSense AI is an advanced AI-powered recruitment intelligence and assessment platform. Here are its core features you should know about and guide users on:
1. **Mock Interviews (AI Recruiter)**:
   - Users can take live AI-driven interviews for various roles (e.g., Software Engineer, HR, Frontend, Backend, Data Science).
   - The AI asks custom questions, analyzes responses, and evaluates answers.
   - At the end, users get a detailed Recruiter Recommendation (Recommended, Conditional, Requires Review), strengths, areas to address, and a transcript.
2. **Detailed Analytics**:
   - The AI placements dashboard provides benchmarks, skill breakdowns (Technical, Communication, Confidence, Problem Solving, Leadership, Behavioral), and charts.
3. **Aptitude Tests**:
   - Practice sets under various categories: Verbal Ability, Numerical Ability, Reasoning Ability, Advanced Quantitative, Advanced Coding.
   - Users can review past attempts, see correct answers, score metrics (accuracy, time taken, integrity), and read detailed explanations for each question.
4. **Cognitive Proctoring**:
   - Features real-time eye-tracking, gaze detection, tab-switch logging, and facial analysis to ensure integrity.
   - Warnings are displayed (e.g., looking away warnings, face detection warnings) to help users keep focus.

Instructions for your behavior:
- Be encouraging, professional, and clear.
- Keep your answers relatively concise, since you live in a small floating chat widget.
- If a user asks how to do something, explain the navigation route (e.g., "Go to 'Interview Types' to start a mock interview", or "Check 'Previous Attempts' to see your aptitude test history").
- Do NOT make up features that don't exist. Keep recommendations aligned with the actual platform.
- You can format your output in clean Markdown (like bold text or bullet points).
"""

@router.post("/chat")
async def chat_with_assistant(request: ChatRequest):
    api_key = settings.OPENROUTER_API_KEY
    if not api_key:
        return {
            "message": "Hello! I am the AptiSense AI Assistant. It looks like my API key is not configured in the backend, but I am ready to help you navigate our platform! We offer mock interviews, proctoring metrics, and aptitude tests. How can I help you today?"
        }

    # Detect if it is a Google Gemini key or an OpenRouter key
    is_gemini_key = not api_key.startswith("sk-or-v1-")

    if is_gemini_key:
        model = settings.OPENROUTER_MODEL or "gemini-flash-latest"
        model_name = model.split("/")[-1] if "/" in model else model
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        
        contents = []
        for msg in request.messages:
            contents.append({
                "role": "user" if msg.role == "user" else "model",
                "parts": [{"text": msg.content}]
            })
            
        payload = {
            "contents": contents,
            "systemInstruction": {
                "parts": [{"text": SYSTEM_PROMPT}]
            },
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 500
            }
        }
        
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=30) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                
            candidates = res_data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    bot_msg = parts[0].get("text", "")
                    return {"message": bot_msg}
            
            logger.warning("Empty response from Gemini: %s", res_data)
            raise HTTPException(status_code=502, detail="Invalid response from Gemini service")
            
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode('utf-8')
            logger.error("Gemini HTTP Error: %s", err_msg)
            raise HTTPException(status_code=502, detail=f"Gemini service error: {err_msg}")
        except Exception as e:
            logger.error("Gemini chatbot exception: %s", e)
            raise HTTPException(status_code=500, detail=f"Failed to communicate with Gemini: {str(e)}")

    else:
        model = settings.OPENROUTER_MODEL or "google/gemini-2.5-flash"
        openrouter_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for msg in request.messages:
            openrouter_messages.append({
                "role": msg.role,
                "content": msg.content
            })

        payload = {
            "model": model,
            "messages": openrouter_messages,
            "temperature": 0.7,
            "max_tokens": 500
        }

        try:
            req = urllib.request.Request(
                "https://openrouter.ai/api/v1/chat/completions",
                data=json.dumps(payload).encode('utf-8'),
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://aptisense.ai",
                    "X-Title": "AptiSense AI Chatbot"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=30) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                
            choices = res_data.get("choices", [])
            if choices:
                bot_msg = choices[0].get("message", {}).get("content", "")
                return {"message": bot_msg}
            else:
                logger.warning("Empty response from OpenRouter: %s", res_data)
                raise HTTPException(status_code=502, detail="Invalid response from OpenRouter service")
                
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode('utf-8')
            logger.error("OpenRouter HTTP Error: %s", err_msg)
            raise HTTPException(status_code=502, detail=f"OpenRouter service error: {err_msg}")
        except Exception as e:
            logger.error("Chatbot exception: %s", e)
            raise HTTPException(status_code=500, detail=f"Failed to communicate with OpenRouter: {str(e)}")

"""API routes."""
from app.api.auth import router as auth_router
from app.api.interview import router as interview_router
from app.api.proctoring import router as proctoring_router
from app.api.analytics import router as analytics_router
from app.api.models import router as models_router
from app.api.admin import router as admin_router
from app.api.chatbot import router as chatbot_router

__all__ = [
    "auth_router",
    "interview_router",
    "proctoring_router",
    "analytics_router",
    "models_router",
    "admin_router",
    "chatbot_router"
]

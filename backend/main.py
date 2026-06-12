"""
AptiSense AI - Recruitment Intelligence Platform
Main FastAPI application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.startup import initialize_database
from app.db.connection import close_mongodb
from app.api import auth_router, interview_router, proctoring_router, analytics_router, models_router, admin_router, chatbot_router
from app.routes.api import router as legacy_api_router
from app.routes.aptitude import router as aptitude_router

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered recruitment intelligence and assessment platform",
    version=settings.APP_VERSION,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(interview_router)
app.include_router(proctoring_router)
app.include_router(analytics_router)
app.include_router(models_router)
app.include_router(admin_router)
app.include_router(chatbot_router)
app.include_router(legacy_api_router)
app.include_router(aptitude_router)


@app.on_event("startup")
async def _on_startup():
    initialize_database()
    print(f"[AptiSense AI] Backend v{settings.APP_VERSION} started — MongoDB Atlas connected")


@app.on_event("shutdown")
async def _on_shutdown():
    close_mongodb()


@app.get("/")
def home():
    """Health check and API info."""
    return {
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "endpoints": {
            "interview": "/api/v1/interview",
            "proctoring": "/api/v1/proctoring",
            "docs": "/docs",
            "health": "/health",
        }
    }


@app.get("/health")
def health_check():
    """Health check endpoint."""
    from app.db.connection import get_database
    from app.repositories.user_repository import UserRepository
    from app.repositories.question_repository import QuestionRepository

    db_status = "connected"
    try:
        get_database().command("ping")
    except Exception:
        db_status = "disconnected"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "version": settings.APP_VERSION,
        "mongodb": db_status,
        "collections": {
            "users": UserRepository.count(),
            "questions": QuestionRepository.count_all(),
        },
    }


@app.get("/api/v1")
def api_v1_info():
    """API v1 information."""
    return {
        "version": "1.0",
        "endpoints": {
            "interview": "/api/v1/interview",
            "proctoring": "/api/v1/proctoring",
        }
    }
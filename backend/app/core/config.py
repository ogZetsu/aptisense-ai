"""
Application configuration and environment settings.
"""
import os
from typing import List
from pathlib import Path
from pydantic import field_validator
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env files if they exist.
# Load workspace root .env first so shared values like GOOGLE_CLIENT_ID are available,
# then load backend/.env to allow backend-specific overrides.
backend_env_path = Path(__file__).parent.parent.parent / ".env"
project_root_env_path = Path(__file__).resolve().parents[3] / ".env"

if project_root_env_path.exists():
    load_dotenv(project_root_env_path, override=False)
if backend_env_path.exists():
    load_dotenv(backend_env_path, override=True)

if os.getenv("DEBUG", "").lower() not in {"", "true", "false", "1", "0", "yes", "no", "on", "off"}:
    os.environ["DEBUG"] = "False"


class Settings(BaseSettings):
    """Application settings."""

    # App
    APP_NAME: str = "AptiSense AI - Recruitment Intelligence Platform"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # API
    API_V1_STR: str = "/api/v1"
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "*"
    ]
    
    # Gemini
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    # Default to a broadly-supported generative model; override with a
    # Gemini-specific model name in the environment if available (e.g. "gemini-1.0").
    GEMINI_MODEL: str = "models/text-bison-001"

    # OpenRouter
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "google/gemini-2.5-flash")
    
    # Storage
    DATA_DIR: str = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "data"
    )
    # Auth
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-to-a-secure-random-value")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    ADMIN_EMAILS: str = os.getenv("ADMIN_EMAILS", "")

    # MongoDB Atlas
    MONGODB_URI: str = os.getenv("MONGODB_URI", "")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "aptisense")
    
    # SMTP Email Settings
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "")
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "AptiSense AI")
    
    # Interview
    MAX_INTERVIEW_DURATION_MINUTES: int = 60
    MIN_INTERVIEW_DURATION_MINUTES: int = 5
    MAX_FOLLOW_UP_QUESTIONS: int = 3
    ADAPTIVE_DIFFICULTY_THRESHOLD: float = 0.65
    
    # Proctoring
    PROCTORING_ENABLED: bool = True
    FACE_DETECTION_CONFIDENCE: float = 0.5
    MAX_LOOKING_AWAY_DURATION_SECONDS: int = 5
    CHEATING_PROBABILITY_THRESHOLD: float = 0.7
    
    # Analytics
    ANALYTICS_STORAGE_ENABLED: bool = True
    ENABLE_DETAILED_LOGGING: bool = True

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, value):
        if isinstance(value, str) and value.lower() in {"release", "production"}:
            return False
        return value
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()

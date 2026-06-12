"""Authentication API — backed by MongoDB Atlas."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

from app.core.config import settings
from app.repositories.user_repository import UserRepository

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

PWD_CTX = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None
    username: str | None = None


class LoginRequest(BaseModel):
    email: str | None = None
    username: str | None = None
    password: str


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = None
    username: str | None = None
    profile_image: str | None = None
    gender: str | None = None
    dob: str | None = None
    contact_number: str | None = None
    degree: str | None = None
    branch: str | None = None
    graduation_year: int | None = None
    cgpa: float | None = None
    skills: list[str] | None = None
    github_url: str | None = None
    linkedin_url: str | None = None


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class GoogleLoginRequest(BaseModel):
    credential: str


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": int(expire.timestamp())})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    return PWD_CTX.verify(plain, hashed)


def get_password_hash(password: str) -> str:
    return PWD_CTX.hash(password)


def _admin_emails() -> set[str]:
    raw = settings.ADMIN_EMAILS or ""
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def _resolve_role(email: str | None) -> str:
    if email and email.strip().lower() in _admin_emails():
        return "admin"
    return "user"


def _public_user(user: dict | None) -> dict | None:
    if not user:
        return None
    return {
        "user_id": user.get("user_id") or user.get("id"),
        "username": user.get("username") or user.get("full_name"),
        "email": user.get("email"),
        "full_name": user.get("full_name"),
        "role": user.get("role", "user"),
        "auth_provider": user.get("auth_provider") or user.get("provider", "email"),
        "profile_image": user.get("profile_image"),
        "created_at": user.get("created_at"),
        "updated_at": user.get("updated_at"),
        "last_login_at": user.get("last_login_at"),
        # New profile fields
        "gender": user.get("gender"),
        "dob": user.get("dob"),
        "contact_number": user.get("contact_number"),
        "degree": user.get("degree"),
        "branch": user.get("branch"),
        "graduation_year": user.get("graduation_year"),
        "cgpa": user.get("cgpa"),
        "skills": user.get("skills"),
        "github_url": user.get("github_url"),
        "linkedin_url": user.get("linkedin_url"),
    }


def _validate_email(email: str) -> str:
    normalized = email.strip().lower()
    if "@" not in normalized or len(normalized) < 5:
        raise HTTPException(status_code=400, detail="Please enter a valid email address")
    return normalized


def _validate_password(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")


def get_current_user_from_header(authorization: str | None = Header(None)) -> dict | None:
    if not authorization or not isinstance(authorization, str):
        return None
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1]
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except JWTError:
        return None

    user_id = payload.get("user_id")
    google_sub = payload.get("google_sub")
    user = None

    if user_id:
        user = UserRepository.find_by_id(user_id)
    if not user and google_sub:
        user = UserRepository.find_by_google_sub(google_sub)

    if user:
        return _public_user(user)

    return {
        "user_id": payload.get("user_id"),
        "username": payload.get("username"),
        "email": payload.get("email"),
        "google_sub": payload.get("google_sub"),
        "role": "user",
    }


@router.post("/signup")
def signup(payload: SignupRequest):
    """Create a new user in MongoDB."""
    email = _validate_email(str(payload.email))
    _validate_password(payload.password)

    if UserRepository.find_by_email(email):
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    full_name = (payload.full_name or payload.username or email.split("@")[0]).strip()
    user = UserRepository.create({
        "fullName": full_name,
        "email": email,
        "password": get_password_hash(payload.password),
        "provider": "email",
        "role": _resolve_role(email),
        "username": full_name,
    })

    token = create_access_token({
        "user_id": user["user_id"],
        "username": user["username"],
        "email": email,
        "google_sub": None,
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _public_user(user),
    }


@router.post("/login")
def login(payload: LoginRequest):
    """Authenticate user against MongoDB."""
    identifier = (payload.email or payload.username or "").strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="Email is required")

    user = None
    if "@" in identifier:
        user = UserRepository.find_by_email(identifier.lower())
    else:
        user = UserRepository.find_by_username(identifier)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="This account uses Google sign-in. Please continue with Google.")

    if not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    updates = {"last_login_at": datetime.utcnow()}
    if user.get("email") and user["email"].lower() in _admin_emails():
        updates["role"] = "admin"
    user = UserRepository.update(user["user_id"], updates)

    token = create_access_token({
        "user_id": user["user_id"],
        "username": user["username"],
        "email": user.get("email"),
        "google_sub": user.get("google_sub"),
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _public_user(user),
    }


@router.post("/google")
def google_login(payload: GoogleLoginRequest):
    """Google OAuth login/signup — stored in MongoDB."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured")

    try:
        token_data = id_token.verify_oauth2_token(
            payload.credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    if token_data.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        raise HTTPException(status_code=401, detail="Invalid Google issuer")

    google_sub = token_data.get("sub")
    email = (token_data.get("email") or "").strip().lower()
    if not google_sub or not email:
        raise HTTPException(status_code=400, detail="Google account data is incomplete")

    full_name = token_data.get("name") or email.split("@")[0]
    profile_image = token_data.get("picture")

    user = UserRepository.find_by_google_sub(google_sub)
    if not user:
        user = UserRepository.find_by_email(email)

    if not user:
        user = UserRepository.create({
            "fullName": full_name,
            "email": email,
            "provider": "google",
            "googleSub": google_sub,
            "profileImage": profile_image,
            "role": _resolve_role(email),
            "username": full_name,
        })
    else:
        updates = {
            "full_name": full_name,
            "username": full_name,
            "email": email,
            "google_sub": google_sub,
            "provider": "google",
            "last_login_at": datetime.utcnow(),
        }
        if profile_image:
            updates["profile_image"] = profile_image
        if email in _admin_emails():
            updates["role"] = "admin"
        user = UserRepository.update(user["user_id"], updates)

    token = create_access_token({
        "user_id": user["user_id"],
        "username": user.get("username"),
        "email": user.get("email"),
        "google_sub": user.get("google_sub"),
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _public_user(user),
    }


@router.get("/me")
def me(current_user=Depends(get_current_user_from_header)):
    """Get current user profile from MongoDB."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = UserRepository.find_by_id(current_user.get("user_id"))
    if user:
        return _public_user(user)
    return current_user


@router.patch("/profile")
def update_profile(payload: ProfileUpdateRequest, current_user=Depends(get_current_user_from_header)):
    """Update user profile in MongoDB."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = current_user.get("user_id")
    if not UserRepository.find_by_id(user_id):
        raise HTTPException(status_code=404, detail="User not found")

    updates = {}
    if payload.full_name is not None:
        updates["full_name"] = payload.full_name.strip()
        updates["username"] = payload.full_name.strip()
    if payload.username is not None:
        updates["username"] = payload.username.strip()
    if payload.profile_image is not None:
        updates["profile_image"] = payload.profile_image.strip()
    if payload.gender is not None:
        updates["gender"] = payload.gender.strip()
    if payload.dob is not None:
        updates["dob"] = payload.dob.strip()
    if payload.contact_number is not None:
        updates["contact_number"] = payload.contact_number.strip()
    if payload.degree is not None:
        updates["degree"] = payload.degree.strip()
    if payload.branch is not None:
        updates["branch"] = payload.branch.strip()
    if payload.graduation_year is not None:
        updates["graduation_year"] = payload.graduation_year
    if payload.cgpa is not None:
        updates["cgpa"] = payload.cgpa
    if payload.skills is not None:
        updates["skills"] = payload.skills
    if payload.github_url is not None:
        updates["github_url"] = payload.github_url.strip()
    if payload.linkedin_url is not None:
        updates["linkedin_url"] = payload.linkedin_url.strip()

    user = UserRepository.update(user_id, updates)
    return {"user": _public_user(user)}


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest):
    """Generate a random 6-digit OTP code for password reset."""
    import random
    from app.services.email_service import send_reset_code_email
    
    email = payload.email.strip().lower()
    user = UserRepository.find_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email address")
        
    if user.get("auth_provider") == "google":
        raise HTTPException(status_code=400, detail="This account uses Google sign-in. Password reset is not available.")
        
    # Generate 6 digit OTP
    code = f"{random.randint(100000, 999999)}"
    expiry = datetime.utcnow() + timedelta(minutes=10)
    
    UserRepository.update(user["user_id"], {
        "reset_code": code,
        "reset_code_expires": expiry
    })
    
    # Try sending the email
    email_sent = send_reset_code_email(email, code)
    
    if email_sent:
        return {
            "message": "Verification code has been sent to your email address.",
            "email": email,
            "email_sent": True
        }
    else:
        # Fallback for local testing when SMTP is not configured
        return {
            "message": "Verification code generated (SMTP is not configured).",
            "code": code,
            "email": email,
            "email_sent": False
        }


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest):
    """Verify OTP and reset password."""
    email = payload.email.strip().lower()
    user = UserRepository.find_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    reset_code = user.get("reset_code")
    reset_expiry = user.get("reset_code_expires")
    
    if not reset_code or reset_code != payload.code.strip():
        raise HTTPException(status_code=400, detail="Invalid verification code")
        
    # Check expiry
    if reset_expiry:
        if isinstance(reset_expiry, str):
            try:
                reset_expiry = datetime.fromisoformat(reset_expiry)
            except ValueError:
                pass
        if isinstance(reset_expiry, datetime) and datetime.utcnow() > reset_expiry:
            raise HTTPException(status_code=400, detail="Verification code has expired")
            
    _validate_password(payload.new_password)
    
    UserRepository.update(user["user_id"], {
        "password": get_password_hash(payload.new_password),
        "reset_code": None,
        "reset_code_expires": None
    })
    
    return {"message": "Password has been reset successfully."}


@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, current_user=Depends(get_current_user_from_header)):
    """Change user password when logged in."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    user_id = current_user.get("user_id")
    user = UserRepository.find_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.get("auth_provider") == "google":
        raise HTTPException(status_code=400, detail="This account uses Google sign-in. Password change is not allowed.")
        
    if not verify_password(payload.current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Incorrect current password")
        
    _validate_password(payload.new_password)
    
    UserRepository.update(user_id, {
        "password": get_password_hash(payload.new_password)
    })
    
    return {"message": "Password changed successfully."}


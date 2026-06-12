from __future__ import annotations

import glob
import json
import os
from datetime import datetime
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.auth import create_access_token
from app.core.config import settings
from main import app


def _auth_header(token: str):
    return {"Authorization": f"Bearer {token}"}


def _latest_file(pattern: str):
    matches = glob.glob(pattern)
    return max(matches, key=os.path.getmtime) if matches else None


def main():
    client = TestClient(app)

    user_a = {
        "user_id": f"verify-user-a-{uuid4()}",
        "username": "verify.user.a",
        "email": "verify.user.a@example.com",
        "google_sub": f"google-sub-a-{uuid4()}",
    }
    user_b = {
        "user_id": f"verify-user-b-{uuid4()}",
        "username": "verify.user.b",
        "email": "verify.user.b@example.com",
        "google_sub": f"google-sub-b-{uuid4()}",
    }

    token_a = create_access_token(user_a)
    token_b = create_access_token(user_b)

    results = []

    # 1) Interview start should fail without auth
    no_auth_start = client.post(
        "/api/v1/interview/start",
        json={
            "interview_type": "technical",
            "position": "Software Engineer",
            "experience_level": "mid",
            "enable_proctoring": False,
        },
    )
    results.append(("interview_start_requires_auth", no_auth_start.status_code == 401, no_auth_start.status_code))

    # 2) Start with user A and verify persisted owner fields
    start_a = client.post(
        "/api/v1/interview/start",
        json={
            "interview_type": "technical",
            "position": "Software Engineer",
            "experience_level": "mid",
            "enable_proctoring": False,
        },
        headers=_auth_header(token_a),
    )
    ok_start_a = start_a.status_code == 200
    session_id = start_a.json().get("session_id") if ok_start_a else None
    results.append(("interview_start_with_auth", ok_start_a, start_a.status_code))

    owner_persisted = False
    if session_id:
        session_path = os.path.join(settings.DATA_DIR, "sessions", f"{session_id}.json")
        if os.path.exists(session_path):
            with open(session_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            owner_persisted = (
                data.get("user_id") == user_a["user_id"]
                and data.get("username") == user_a["username"]
                and data.get("email") == user_a["email"]
                and data.get("google_sub") == user_a["google_sub"]
            )
    results.append(("interview_owner_persisted", owner_persisted, session_id))

    # 3) User B cannot access user A report
    if session_id:
        report_b = client.get(f"/api/v1/interview/report/{session_id}", headers=_auth_header(token_b))
        results.append(("report_owner_enforced", report_b.status_code == 403, report_b.status_code))

    # 4) Aptitude submit requires auth
    no_auth_apt = client.post(
        "/aptitude/submit",
        json={
            "category": "numerical",
            "score": 3,
            "total_questions": 5,
            "attention_score": 0.9,
            "suspicious_count": 0,
            "tab_switches": 0,
        },
    )
    results.append(("aptitude_submit_requires_auth", no_auth_apt.status_code == 401, no_auth_apt.status_code))

    apt_a = client.post(
        "/aptitude/submit",
        json={
            "category": "numerical",
            "score": 4,
            "total_questions": 5,
            "attention_score": 0.92,
            "suspicious_count": 0,
            "tab_switches": 0,
        },
        headers=_auth_header(token_a),
    )
    results.append(("aptitude_submit_with_auth", apt_a.status_code == 200, apt_a.status_code))

    latest_attempt = _latest_file(os.path.join(settings.DATA_DIR, "aptitude_attempts", "*.json"))
    apt_owner_ok = False
    if latest_attempt:
        with open(latest_attempt, "r", encoding="utf-8") as f:
            attempt = json.load(f)
        apt_owner_ok = (
            attempt.get("user_id") == user_a["user_id"]
            and attempt.get("username") == user_a["username"]
            and attempt.get("email") == user_a["email"]
            and attempt.get("google_sub") == user_a["google_sub"]
        )
    results.append(("aptitude_owner_persisted", apt_owner_ok, latest_attempt))

    # 5) Analytics sessions should be private
    sessions_no_auth = client.get("/api/v1/analytics/sessions")
    sessions_a = client.get("/api/v1/analytics/sessions", headers=_auth_header(token_a))
    sessions_b = client.get("/api/v1/analytics/sessions", headers=_auth_header(token_b))

    no_auth_private = sessions_no_auth.status_code == 200 and sessions_no_auth.json() == []
    user_a_has_own = sessions_a.status_code == 200 and any(s.get("user_id") == user_a["user_id"] for s in sessions_a.json())
    user_b_not_see_a = sessions_b.status_code == 200 and not any(s.get("user_id") == user_a["user_id"] for s in sessions_b.json())

    results.append(("analytics_sessions_no_auth_empty", no_auth_private, sessions_no_auth.status_code))
    results.append(("analytics_sessions_user_a_has_data", user_a_has_own, len(sessions_a.json()) if sessions_a.status_code == 200 else sessions_a.status_code))
    results.append(("analytics_sessions_isolated", user_b_not_see_a, len(sessions_b.json()) if sessions_b.status_code == 200 else sessions_b.status_code))

    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)

    print(f"Verification run: {datetime.utcnow().isoformat()}Z")
    for name, ok, detail in results:
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {name}: {detail}")

    print(f"Summary: {passed}/{total} checks passed")
    if passed != total:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

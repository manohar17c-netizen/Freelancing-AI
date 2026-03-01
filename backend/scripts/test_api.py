from __future__ import annotations

import json
import tempfile
from pathlib import Path

import requests

BASE = "http://127.0.0.1:8000"


def assert_status(response: requests.Response, expected: int, message: str) -> None:
    if response.status_code != expected:
        raise RuntimeError(
            f"{message}\nExpected HTTP {expected}, got {response.status_code}.\nBody: {response.text}"
        )


def main() -> None:
    health = requests.get(f"{BASE}/", timeout=10)
    assert_status(health, 200, "Health endpoint failed")

    with tempfile.TemporaryDirectory() as tmp:
        resume_path = Path(tmp) / "resume.txt"
        resume_path.write_text(
            "Jane Developer\n"
            "Backend Python engineer with 5 years experience.\n"
            "Skills: Python, FastAPI, Docker, AWS, PostgreSQL.\n",
            encoding="utf-8",
        )

        with resume_path.open("rb") as fh:
            register = requests.post(
                f"{BASE}/freelancers/register",
                data={
                    "name": "Jane Developer",
                    "email": "jane@example.com",
                    "headline": "Backend Python Developer",
                    "experience_years": "5",
                    "skills": "python,fastapi,docker,aws,postgresql",
                    "bio": "Builds robust APIs",
                },
                files={"file": ("resume.txt", fh, "text/plain")},
                timeout=20,
            )
        assert_status(register, 200, "Freelancer registration failed")

    payload = {
        "description": "Need a Python FastAPI developer to build backend APIs on AWS.",
        "required_skills": ["python", "fastapi", "aws"],
        "min_experience_years": 3,
    }
    match = requests.post(f"{BASE}/post-job", json=payload, timeout=20)
    assert_status(match, 200, "Job matching failed")

    data = match.json()
    if "top_matches" not in data or not isinstance(data["top_matches"], list):
        raise RuntimeError(f"Unexpected /post-job response: {json.dumps(data)}")
    if not data["top_matches"]:
        raise RuntimeError("No top matches returned after registration")

    print("API tests passed: healthcheck, register, and post-job matching.")


if __name__ == "__main__":
    main()

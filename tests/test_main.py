import pytest

fastapi = pytest.importorskip("fastapi")
from fastapi.testclient import TestClient

from main import app, resume_collection, resume_metadata


client = TestClient(app)


def setup_function() -> None:
    resume_collection.clear()
    resume_metadata.clear()


def test_healthcheck() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "Freelancing AI Matching API"}


def test_upload_resume_success() -> None:
    response = client.post(
        "/upload-resume",
        files={"file": ("resume.txt", b"Python FastAPI engineer with 5 years experience in AWS")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["message"] == "Resume stored successfully"
    assert body["resume_id"] == "resume.txt"


def test_post_job_returns_ranked_matches() -> None:
    client.post(
        "/upload-resume",
        files={"file": ("resume1.txt", b"React FastAPI developer with 4 years experience and Docker")},
    )
    client.post(
        "/upload-resume",
        files={"file": ("resume2.txt", b"Python Django engineer with 2 years experience")},
    )

    response = client.post(
        "/post-job",
        json={
            "description": "Looking for React and FastAPI developer",
            "required_skills": ["react", "fastapi"],
            "min_experience_years": 3,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert "top_matches" in body
    assert len(body["top_matches"]) >= 1
    top = body["top_matches"][0]
    assert {"resume_id", "semantic_score", "skill_score", "experience_score", "final_score"}.issubset(top)


def test_post_job_without_resumes_returns_404() -> None:
    response = client.post(
        "/post-job",
        json={
            "description": "Need backend engineer",
            "required_skills": ["python"],
            "min_experience_years": 2,
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "No resumes found. Upload resumes first."

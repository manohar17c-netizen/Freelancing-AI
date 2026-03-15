from __future__ import annotations

import hashlib
import json
import io
import re
import uuid
from typing import Dict, List, Tuple

from fastapi import Body, FastAPI, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field

from auth import auth_router
from auth import get_authenticated_user
from database import (
    create_application,
    create_job,
    delete_job,
    get_client_profile,
    get_client_profile_by_name,
    get_freelancer_by_email,
    get_freelancer_by_name,
    get_freelancer_by_resume_id,
    get_job,
    init_db,
    list_applications_for_client,
    list_applications_for_freelancer,
    list_jobs,
    list_jobs_for_client,
    list_freelancer_profiles,
    load_freelancer_records,
    schedule_interview,
    set_job_live,
    update_application_status,
    upsert_client_profile,
    upsert_freelancer_record,
)
from ui_routes import ui_router

try:
    from sentence_transformers import SentenceTransformer
except ImportError:  # pragma: no cover
    SentenceTransformer = None

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover
    PdfReader = None

try:
    from docx import Document
except ImportError:  # pragma: no cover
    Document = None


app = FastAPI(title="Freelancing AI Matching API")
app.include_router(auth_router)
app.include_router(ui_router)


class InMemoryCollection:
    """A tiny in-memory substitute for vector DB behaviour."""

    def __init__(self) -> None:
        self._rows: List[Dict] = []

    def add(self, documents: List[str], embeddings: List[List[float]], ids: List[str]) -> None:
        for doc, emb, item_id in zip(documents, embeddings, ids):
            self._rows.append({"id": item_id, "document": doc, "embedding": emb})

    def upsert(self, documents: List[str], embeddings: List[List[float]], ids: List[str]) -> None:
        for doc, emb, item_id in zip(documents, embeddings, ids):
            self._rows = [row for row in self._rows if row["id"] != item_id]
            self._rows.append({"id": item_id, "document": doc, "embedding": emb})

    def query(self, query_embedding: List[float], n_results: int = 5) -> List[Dict]:
        scored = []
        for row in self._rows:
            score = cosine_similarity(query_embedding, row["embedding"])
            scored.append({"id": row["id"], "document": row["document"], "score": round(score, 4)})
        scored.sort(key=lambda item: item["score"], reverse=True)
        return scored[:n_results]


class JobPost(BaseModel):
    description: str = Field(..., min_length=10)
    required_skills: List[str] = Field(default_factory=list)
    min_experience_years: int = 0
    client_name: str = Field(default="", min_length=0)
    client_email: str = Field(default="", min_length=0)
    client_whatsapp: str = Field(default="", min_length=0)


class ScheduleInterviewRequest(BaseModel):
    job_id: str
    resume_id: str
    client_email: str
    freelancer_email: str
    slot_start: str  # ISO format e.g. "2025-03-15T10:00:00"
    slot_end: str


class MakeJobLiveRequest(BaseModel):
    is_live: bool = True


class UpdateApplicationStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(accepted|rejected)$")


class ClientProfileRequest(BaseModel):
    name: str = Field(default="", min_length=0)
    whatsapp_phone: str = Field(default="", min_length=0)
    company_name: str = Field(default="", min_length=0)
    role_title: str = Field(default="", min_length=0)
    hiring_goals: str = Field(default="", min_length=0)
    preferred_skills: List[str] = Field(default_factory=list)
    timezone: str = Field(default="", min_length=0)
    budget_notes: str = Field(default="", min_length=0)


class JobUpdateRequest(BaseModel):
    description: str = Field(..., min_length=10)
    required_skills: List[str] = Field(default_factory=list)
    min_experience_years: int = 0
    client_name: str = Field(default="", min_length=0)
    client_email: str = Field(default="", min_length=0)
    client_whatsapp: str = Field(default="", min_length=0)


def cosine_similarity(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = sum(x * x for x in a) ** 0.5
    mag_b = sum(y * y for y in b) ** 0.5
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def _fallback_embedding(text: str, dim: int = 32) -> List[float]:
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    return [((digest[i % len(digest)] / 255.0) * 2) - 1 for i in range(dim)]


class EmbeddingService:
    def __init__(self) -> None:
        if SentenceTransformer is None:
            self.model = None
            return
        try:
            self.model = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception:
            self.model = None

    def encode(self, texts: List[str]) -> List[List[float]]:
        if self.model:
            vectors = self.model.encode(texts)
            return [vector.tolist() for vector in vectors]
        return [_fallback_embedding(text) for text in texts]


embedder = EmbeddingService()
resume_collection = InMemoryCollection()
resume_metadata: Dict[str, Dict] = {}


@app.on_event("startup")
def initialize_persistence() -> None:
    init_db()
    for record in load_freelancer_records():
        embedding = record.get("embedding") or embedder.encode([record["resume_text"]])[0]
        resume_collection.add(
            documents=[record["resume_text"]],
            embeddings=[embedding],
            ids=[record["resume_id"]],
        )
        resume_metadata[record["resume_id"]] = {
            "name": record["name"],
            "email": record["email"],
            "headline": record["headline"],
            "bio": record["bio"],
            "experience_years": max(int(record["experience_years"]), 0),
            "experience_months": max(min(int(record.get("experience_months", 0) or 0), 11), 0),
            "skills": sorted({skill.strip().lower() for skill in record["skills"] if isinstance(skill, str)}),
            "availability_slots": record.get("availability_slots") or [],
            "whatsapp_phone": record.get("whatsapp_phone") or "",
            "profile_live": record.get("profile_live", True),
        }


@app.get("/")
def healthcheck() -> Dict[str, str]:
    return {"status": "ok", "service": "Freelancing AI Matching API", "ui": "/ui"}


@app.post("/freelancers/register")
async def register_freelancer(
    name: str = Form(...),
    email: str = Form(...),
    headline: str = Form(...),
    experience_years: int = Form(0),
    experience_months: int = Form(0),
    allow_empty_resume: bool = Form(False),
    pdf_password: str = Form(""),
    skills: str = Form(""),
    bio: str = Form(""),
    whatsapp_phone: str = Form(""),
    availability_slots: str = Form("[]"),
    file: UploadFile | None = File(None),
) -> Dict:
    existing_profile = get_freelancer_by_email(email) or get_freelancer_by_name(name)
    content = b""
    if file is not None:
        content = await file.read()

    if file is not None and not content:
        raise HTTPException(status_code=400, detail="Uploaded resume is empty.")

    extraction_warning = ""
    if content:
        text, extraction_warning = _extract_resume_text(
            file, content, allow_empty_resume=allow_empty_resume, pdf_password=pdf_password or ""
        )
        embedding = embedder.encode([text])[0]
        resume_id = existing_profile.get("resume_id") if existing_profile else f"resume-{uuid.uuid4().hex[:8]}"
    elif existing_profile:
        text = existing_profile.get("resume_text", "")
        embedding = existing_profile.get("embedding") or embedder.encode([text])[0]
        resume_id = existing_profile.get("resume_id", f"resume-{uuid.uuid4().hex[:8]}")
    else:
        raise HTTPException(status_code=400, detail="Please upload your resume file before submitting.")

    resume_collection.upsert(documents=[text], embeddings=[embedding], ids=[resume_id])

    typed_skills = [skill.strip().lower() for skill in skills.split(",") if skill.strip()]
    inferred_skills = _extract_skills(text.lower())
    merged_skills = sorted(set(typed_skills) | set(inferred_skills))
    extracted_years, extracted_months = _extract_experience_from_text(text.lower()) if text.strip() else (0, 0)

    normalized_months = max(min(experience_months, 11), 0)
    total_input_months = max(experience_years, 0) * 12 + normalized_months
    total_extracted_months = max(extracted_years, 0) * 12 + max(min(extracted_months, 11), 0)
    final_total_months = max(total_input_months, total_extracted_months)

    try:
        slots_data = json.loads(availability_slots) if availability_slots else []
    except json.JSONDecodeError:
        slots_data = []
    if not isinstance(slots_data, list):
        slots_data = []

    resume_metadata[resume_id] = {
        "name": name,
        "email": email,
        "headline": headline,
        "bio": bio,
        "experience_years": final_total_months // 12,
        "experience_months": final_total_months % 12,
        "skills": merged_skills,
        "availability_slots": slots_data,
        "whatsapp_phone": (whatsapp_phone or "").strip(),
        "profile_live": True,
    }

    upsert_freelancer_record(
        resume_id=resume_id,
        name=name,
        email=email,
        headline=headline,
        bio=bio,
        experience_years=resume_metadata[resume_id]["experience_years"],
        experience_months=resume_metadata[resume_id]["experience_months"],
        skills=merged_skills,
        resume_text=text,
        embedding=embedding,
        availability_slots=slots_data,
        whatsapp_phone=(whatsapp_phone or "").strip(),
        profile_live=True,
    )

    response = {
        "message": "Freelancer profile updated successfully" if existing_profile else "Freelancer registered successfully",
        "resume_id": resume_id,
        "profile": {"name": name, "email": email, "headline": headline, "skills": merged_skills},
    }
    if extraction_warning:
        response["warning"] = extraction_warning
    return response


@app.post("/upload-resume")
async def upload_resume(
    file: UploadFile = File(...), allow_empty_resume: bool = Form(False), pdf_password: str = Form("")
) -> Dict:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded resume is empty.")

    text, extraction_warning = _extract_resume_text(
        file, content, allow_empty_resume=allow_empty_resume, pdf_password=pdf_password or ""
    )

    resume_id = f"resume-{uuid.uuid4().hex[:8]}"
    embedding = embedder.encode([text])[0]
    resume_collection.add(documents=[text], embeddings=[embedding], ids=[resume_id])

    lowered = text.lower() if text.strip() else ""
    extracted_years, extracted_months = _extract_experience_from_text(lowered)
    resume_metadata[resume_id] = {
        "name": file.filename,
        "email": "",
        "headline": "Freelancer",
        "bio": "",
        "experience_years": extracted_years,
        "experience_months": extracted_months,
        "skills": _extract_skills(lowered),
    }

    upsert_freelancer_record(
        resume_id=resume_id,
        name=file.filename,
        email="",
        headline="Freelancer",
        bio="",
        experience_years=resume_metadata[resume_id]["experience_years"],
        experience_months=resume_metadata[resume_id]["experience_months"],
        skills=resume_metadata[resume_id]["skills"],
        resume_text=text,
        embedding=embedding,
    )

    response = {"message": "Resume stored successfully", "resume_id": resume_id}
    if extraction_warning:
        response["warning"] = extraction_warning
    return response


@app.post("/post-job")
def post_job(job: JobPost) -> Dict:
    if not resume_metadata:
        raise HTTPException(status_code=404, detail="No resumes found. Upload resumes first.")

    job_embedding = embedder.encode([job.description])[0]
    semantic_matches = resume_collection.query(query_embedding=job_embedding, n_results=10)

    ranked = []
    for result in semantic_matches:
        candidate = resume_metadata.get(result["id"], {"skills": [], "experience_years": 0, "experience_months": 0, "profile_live": True})
        if not candidate.get("profile_live", True):
            continue
        candidate_total_months = max(candidate["experience_years"], 0) * 12 + max(candidate.get("experience_months", 0), 0)
        required_total_months = max(job.min_experience_years, 0) * 12
        experience_score = min(candidate_total_months / max(required_total_months, 1), 1.0)

        required = {skill.lower() for skill in job.required_skills}
        available = set(candidate["skills"])
        skill_score = len(required & available) / max(len(required), 1)

        final_score = round((0.5 * skill_score) + (0.3 * experience_score) + (0.2 * result["score"]), 4)
        match_percentage = min(100, max(1, int(final_score * 100)))
        ranked.append(
            {
                "resume_id": result["id"],
                "name": candidate.get("name", result["id"]),
                "email": candidate.get("email", ""),
                "headline": candidate.get("headline", "Freelancer"),
                "semantic_score": result["score"],
                "skill_score": round(skill_score, 4),
                "experience_score": round(experience_score, 4),
                "experience_years": candidate.get("experience_years", 0),
                "experience_months": candidate.get("experience_months", 0),
                "final_score": final_score,
                "match_percentage": match_percentage,
                "availability_slots": candidate.get("availability_slots", []),
                "whatsapp_phone": candidate.get("whatsapp_phone", ""),
            }
        )

    ranked.sort(key=lambda item: item["final_score"], reverse=True)
    top_matches = ranked[:10]

    job_id = f"job-{uuid.uuid4().hex[:8]}"
    create_job(
        job_id=job_id,
        client_name=job.client_name or "Client",
        client_email=job.client_email or "",
        client_whatsapp=job.client_whatsapp or "",
        description=job.description,
        required_skills=job.required_skills,
        min_experience_years=job.min_experience_years,
        is_live=False,
    )
    upsert_client_profile(
        client_email=job.client_email or "",
        name=job.client_name or "Client",
        whatsapp_phone=job.client_whatsapp or "",
        preferred_skills=job.required_skills or [],
    )

    return {
        "job_id": job_id,
        "top_matches": top_matches,
        "whatsapp_message": _build_whatsapp_message(job.description[:80], top_matches),
    }


@app.get("/freelancers")
def get_freelancers(
    limit: int = 100,
    q: str = "",
    name: str = "",
    skill: str = "",
    min_experience: int = 0,
) -> Dict:
    profiles = list_freelancer_profiles(limit)
    query = q.strip().lower()
    name_query = name.strip().lower()
    skill_query = skill.strip().lower()
    min_exp = max(int(min_experience or 0), 0)

    filtered = []
    for profile in profiles:
      if not profile.get("profile_live", True):
          continue
      haystack = " ".join(
          [
              str(profile.get("name", "") or ""),
              str(profile.get("headline", "") or ""),
              str(profile.get("bio", "") or ""),
              " ".join(str(skill_item) for skill_item in (profile.get("skills") or [])),
          ]
      ).lower()
      skills = {str(skill_item).strip().lower() for skill_item in (profile.get("skills") or []) if str(skill_item).strip()}
      if query and query not in haystack:
          continue
      if name_query and name_query not in str(profile.get("name", "") or "").lower():
          continue
      if skill_query and skill_query not in skills:
          continue
      if int(profile.get("experience_years", 0) or 0) < min_exp:
          continue
      filtered.append(profile)

    return {"count": len(filtered), "freelancers": filtered}


@app.get("/freelancers/me")
def get_my_freelancer_profile(request: Request) -> Dict:
    user = get_authenticated_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    profile = get_freelancer_by_email(user.get("email", ""))
    if not profile:
        return {"registered": False, "profile": None}
    safe_profile = {
        "resume_id": profile.get("resume_id", ""),
        "name": profile.get("name", ""),
        "email": profile.get("email", ""),
        "headline": profile.get("headline", ""),
        "bio": profile.get("bio", ""),
        "experience_years": profile.get("experience_years", 0),
        "experience_months": profile.get("experience_months", 0),
        "skills": profile.get("skills", []),
        "availability_slots": profile.get("availability_slots", []),
        "whatsapp_phone": profile.get("whatsapp_phone", ""),
        "profile_live": profile.get("profile_live", True),
    }
    return {"registered": True, "profile": safe_profile}


@app.get("/freelancers/{resume_id}")
def get_freelancer_profile_by_resume(resume_id: str, request: Request) -> Dict:
    user = get_authenticated_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    profile = get_freelancer_by_resume_id(resume_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Freelancer not found")
    safe_profile = {
        "resume_id": profile.get("resume_id", ""),
        "name": profile.get("name", ""),
        "email": profile.get("email", ""),
        "headline": profile.get("headline", ""),
        "bio": profile.get("bio", ""),
        "experience_years": profile.get("experience_years", 0),
        "experience_months": profile.get("experience_months", 0),
        "skills": profile.get("skills", []),
        "availability_slots": profile.get("availability_slots", []),
        "whatsapp_phone": profile.get("whatsapp_phone", ""),
        "profile_live": profile.get("profile_live", True),
    }
    return {"profile": safe_profile}


@app.get("/clients/me")
def get_my_client_profile(request: Request) -> Dict:
    user = get_authenticated_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    profile = get_client_profile(user.get("email", "")) or get_client_profile_by_name(user.get("name", ""))
    if profile:
        return {"registered": True, "profile": profile}
    jobs = list_jobs_for_client(user.get("email", ""), client_name=user.get("name", ""), limit=1)
    if jobs:
        first_job = jobs[0]
        return {
            "registered": False,
            "profile": {
                "client_email": user.get("email", ""),
                "name": first_job.get("client_name", "") or user.get("name", ""),
                "whatsapp_phone": first_job.get("client_whatsapp", ""),
                "company_name": "",
                "role_title": "",
                "hiring_goals": first_job.get("description", ""),
                "preferred_skills": first_job.get("required_skills", []),
                "timezone": "",
                "budget_notes": "",
            },
        }
    return {
        "registered": False,
        "profile": {
            "client_email": user.get("email", ""),
            "name": user.get("name", ""),
            "whatsapp_phone": "",
            "company_name": "",
            "role_title": "",
            "hiring_goals": "",
            "preferred_skills": [],
            "timezone": "",
            "budget_notes": "",
        },
    }


@app.post("/clients/profile")
def save_client_profile(body: ClientProfileRequest, request: Request) -> Dict:
    user = get_authenticated_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    upsert_client_profile(
        client_email=user.get("email", ""),
        name=body.name.strip(),
        whatsapp_phone=body.whatsapp_phone.strip(),
        company_name=body.company_name.strip(),
        role_title=body.role_title.strip(),
        hiring_goals=body.hiring_goals.strip(),
        preferred_skills=[str(skill).strip() for skill in body.preferred_skills if str(skill).strip()],
        timezone=body.timezone.strip(),
        budget_notes=body.budget_notes.strip(),
    )
    return {
        "message": "Client profile updated successfully",
        "profile": get_client_profile(user.get("email", "")),
    }


@app.get("/jobs/recommended")
def recommended_jobs(request: Request, q: str = "", limit: int = 30) -> Dict:
    user = get_authenticated_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    freelancer = get_freelancer_by_email(user.get("email", ""))
    if not freelancer:
        return {"registered": False, "jobs": []}

    freelancer_skills = {str(s).strip().lower() for s in (freelancer.get("skills") or []) if str(s).strip()}
    freelancer_embedding = freelancer.get("embedding") or []
    freelancer_total_months = max(int(freelancer.get("experience_years", 0) or 0), 0) * 12 + max(
        int(freelancer.get("experience_months", 0) or 0), 0
    )

    jobs = list_jobs(limit=limit, q=q, live_only=True)
    ranked = []
    for job in jobs:
        required = {str(s).strip().lower() for s in (job.get("required_skills") or []) if str(s).strip()}
        if required:
            skill_score = len(required & freelancer_skills) / max(len(required), 1)
        else:
            # No explicit skill requirement; treat as low-confidence match.
            skill_score = 0.0

        required_total_months = max(int(job.get("min_experience_years", 0) or 0), 0) * 12
        experience_score = min(freelancer_total_months / max(required_total_months, 1), 1.0)

        semantic_score = 0.0
        desc = str(job.get("description", "") or "")
        if desc.strip() and isinstance(freelancer_embedding, list) and freelancer_embedding:
            job_emb = embedder.encode([desc])[0]
            semantic_score = cosine_similarity(job_emb, freelancer_embedding)

        # Prioritize explicit skill mapping; blend in experience + semantics.
        final_score = round((0.6 * skill_score) + (0.25 * experience_score) + (0.15 * semantic_score), 4)
        match_percentage = min(100, max(1, int(final_score * 100)))

        ranked.append(
            {
                **job,
                "skill_score": round(skill_score, 4),
                "experience_score": round(experience_score, 4),
                "semantic_score": round(semantic_score, 4),
                "final_score": final_score,
                "match_percentage": match_percentage,
            }
        )

    ranked.sort(key=lambda item: item["final_score"], reverse=True)
    return {"registered": True, "jobs": ranked}


def _rank_freelancers_for_job(job: Dict, limit: int = 5) -> List[Dict]:
    required = {
        str(skill).strip().lower()
        for skill in (job.get("required_skills") or [])
        if str(skill).strip()
    }
    required_total_months = max(int(job.get("min_experience_years", 0) or 0), 0) * 12
    description = str(job.get("description", "") or "")
    job_embedding = embedder.encode([description])[0] if description.strip() else []

    ranked = []
    for freelancer in load_freelancer_records():
        if not freelancer.get("profile_live", True):
            continue
        available = {
            str(skill).strip().lower()
            for skill in (freelancer.get("skills") or [])
            if str(skill).strip()
        }
        skill_score = len(required & available) / max(len(required), 1) if required else 0.0
        total_months = max(int(freelancer.get("experience_years", 0) or 0), 0) * 12 + max(
            int(freelancer.get("experience_months", 0) or 0), 0
        )
        experience_score = min(total_months / max(required_total_months, 1), 1.0)
        semantic_score = 0.0
        if job_embedding and freelancer.get("embedding"):
            semantic_score = cosine_similarity(job_embedding, freelancer.get("embedding") or [])
        final_score = round((0.6 * skill_score) + (0.25 * experience_score) + (0.15 * semantic_score), 4)
        match_percentage = min(100, max(1, int(final_score * 100)))
        ranked.append(
            {
                "resume_id": freelancer.get("resume_id", ""),
                "name": freelancer.get("name", "Freelancer"),
                "email": freelancer.get("email", ""),
                "headline": freelancer.get("headline", "Freelancer"),
                "experience_years": freelancer.get("experience_years", 0),
                "experience_months": freelancer.get("experience_months", 0),
                "skills": freelancer.get("skills", []),
                "matched_skills": sorted(required & available),
                "match_percentage": match_percentage,
            }
        )
    ranked.sort(key=lambda item: item["match_percentage"], reverse=True)
    return ranked[:limit]


@app.get("/jobs/mine")
def my_jobs(request: Request, q: str = "", limit: int = 50) -> Dict:
    user = get_authenticated_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    jobs = list_jobs_for_client(user.get("email", ""), client_name=user.get("name", ""), limit=limit, q=q)
    response_jobs = []
    for job in jobs:
        try:
            suggested_developers = _rank_freelancers_for_job(job, limit=5)
        except Exception:
            suggested_developers = []
        response_jobs.append(
            {
                **job,
                "suggested_developers": suggested_developers,
            }
        )
    return {"jobs": response_jobs}


def _build_whatsapp_message(job_preview: str, matches: List[Dict]) -> str:
    lines = [
        "🔔 *FreelancingAI – Developers matching your requirement*",
        "",
        f"📋 Job: {job_preview}...",
        "",
        "👥 *Top matching developers:*",
    ]
    for i, m in enumerate(matches[:5], 1):
        pct = m.get("match_percentage", int((m.get("final_score", 0) * 100)))
        lines.append(f"{i}. *{m.get('name', 'N/A')}* – {pct}% match")
        lines.append(f"   {m.get('headline', '')} | {m.get('experience_years', 0)}+ yrs")
    lines.extend(["", "Schedule an interview at: /jobs", "Reply to this message to connect."])
    return "\n".join(lines)


def _build_application_view(application: Dict, freelancer: Dict | None, job: Dict | None) -> Dict:
    freelancer = freelancer or {}
    job = job or {}
    freelancer_skills = {
        str(skill).strip().lower()
        for skill in (freelancer.get("skills") or [])
        if str(skill).strip()
    }
    required_skills = {
        str(skill).strip().lower()
        for skill in (job.get("required_skills") or [])
        if str(skill).strip()
    }
    matched_skills = sorted(required_skills & freelancer_skills)
    missing_skills = sorted(required_skills - freelancer_skills)
    skill_match_percent = int((len(matched_skills) / max(len(required_skills), 1)) * 100) if required_skills else 0
    return {
        **application,
        "job_description": job.get("description", ""),
        "client_name": job.get("client_name", "Client"),
        "freelancer_name": freelancer.get("name", "Freelancer"),
        "headline": freelancer.get("headline", "Freelancer"),
        "experience_years": freelancer.get("experience_years", 0),
        "experience_months": freelancer.get("experience_months", 0),
        "skills": freelancer.get("skills", []),
        "required_skills": list(required_skills),
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "skill_match_percent": skill_match_percent,
    }


@app.post("/jobs/{job_id}/live")
def make_job_live_endpoint(job_id: str, body: MakeJobLiveRequest | None = Body(None)) -> Dict:
    is_live = body.is_live if body else True
    if set_job_live(job_id, is_live):
        return {"message": f"Job is now {'live' if is_live else 'draft'}", "job_id": job_id}
    raise HTTPException(status_code=404, detail="Job not found")


@app.delete("/jobs/{job_id}")
def delete_job_endpoint(job_id: str, request: Request) -> Dict:
    user = get_authenticated_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if delete_job(job_id, user.get("email", "")):
        return {"message": "Job deleted", "job_id": job_id}
    raise HTTPException(status_code=404, detail="Job not found")


@app.put("/jobs/{job_id}")
def update_job_endpoint(job_id: str, body: JobUpdateRequest, request: Request) -> Dict:
    user = get_authenticated_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    same_email = str(job.get("client_email", "")).strip().lower() == str(user.get("email", "")).strip().lower()
    same_name = str(job.get("client_name", "")).strip().lower() == str(user.get("name", "")).strip().lower()
    if not (same_email or same_name):
        raise HTTPException(status_code=403, detail="You cannot edit this requirement.")

    create_job(
        job_id=job_id,
        client_name=body.client_name or job.get("client_name", "Client"),
        client_email=body.client_email or job.get("client_email", ""),
        client_whatsapp=body.client_whatsapp or job.get("client_whatsapp", ""),
        description=body.description,
        required_skills=body.required_skills,
        min_experience_years=max(body.min_experience_years, 0),
        is_live=bool(job.get("is_live", False)),
    )
    return {"message": "Requirement updated", "job": get_job(job_id)}


@app.post("/jobs/{job_id}/apply")
def apply_to_job(job_id: str, request: Request) -> Dict:
    user = get_authenticated_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    freelancer = get_freelancer_by_email(user.get("email", ""))
    if not freelancer:
        raise HTTPException(status_code=400, detail="Complete your freelancer profile before applying.")
    job = get_job(job_id)
    if not job or not job.get("is_live", False):
        raise HTTPException(status_code=404, detail="Live job not found")

    application_id = f"app-{uuid.uuid4().hex[:8]}"
    created = create_application(
        application_id=application_id,
        job_id=job_id,
        resume_id=freelancer.get("resume_id", ""),
        client_email=job.get("client_email", ""),
        freelancer_email=user.get("email", ""),
    )
    if not created:
        raise HTTPException(status_code=400, detail="You have already applied to this job.")
    return {"message": "Application submitted", "application_id": application_id, "job_id": job_id}


@app.get("/applications/me")
def get_my_applications(request: Request) -> Dict:
    user = get_authenticated_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    applications = list_applications_for_freelancer(user.get("email", ""))
    detailed = []
    for application in applications:
        freelancer = get_freelancer_by_resume_id(application["resume_id"])
        job = get_job(application["job_id"])
        detailed.append(_build_application_view(application, freelancer, job))
    return {"applications": detailed}


@app.get("/applications/received")
def get_received_applications(request: Request) -> Dict:
    user = get_authenticated_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    applications = list_applications_for_client(user.get("email", ""))
    detailed = []
    for application in applications:
        freelancer = get_freelancer_by_resume_id(application["resume_id"])
        job = get_job(application["job_id"])
        detailed.append(_build_application_view(application, freelancer, job))
    return {"applications": detailed}


@app.post("/applications/{application_id}/status")
def set_application_status(application_id: str, body: UpdateApplicationStatusRequest, request: Request) -> Dict:
    user = get_authenticated_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    applications = list_applications_for_client(user.get("email", ""))
    target = next((application for application in applications if application["application_id"] == application_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Application not found")
    if update_application_status(application_id, body.status):
        return {"message": f"Application {body.status}", "application_id": application_id, "status": body.status}
    raise HTTPException(status_code=400, detail="Could not update application")


def _normalize_time(t: str) -> str:
    if not t:
        return ""
    if "T" in t:
        return t.split("T")[-1][:5]
    return str(t)[:5]


@app.post("/interviews/schedule")
def schedule_interview_endpoint(req: ScheduleInterviewRequest) -> Dict:
    freelancer = get_freelancer_by_resume_id(req.resume_id)
    if not freelancer:
        raise HTTPException(status_code=404, detail="Freelancer not found")
    valid_slots = freelancer.get("availability_slots") or []
    req_start = _normalize_time(req.slot_start)
    req_end = _normalize_time(req.slot_end)
    slot_ok = any(
        _normalize_time(str(s.get("start", ""))) == req_start and _normalize_time(str(s.get("end", ""))) == req_end
        for s in valid_slots
        if isinstance(s, dict)
    )
    if valid_slots and not slot_ok:
        return {
            "message": "Slot not in freelancer availability. Use one of their listed slots.",
            "availability_slots": valid_slots,
        }
    if schedule_interview(req.job_id, req.resume_id, req.client_email, req.freelancer_email, req.slot_start, req.slot_end):
        return {"message": "Interview scheduled", "job_id": req.job_id, "resume_id": req.resume_id}
    raise HTTPException(status_code=400, detail="Could not schedule (slot may already be booked)")


@app.get("/jobs/{job_id}")
def get_job_endpoint(job_id: str) -> Dict:
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.get("/freelancers/{resume_id}/slots")
def get_freelancer_slots(resume_id: str) -> Dict:
    freelancer = get_freelancer_by_resume_id(resume_id)
    if not freelancer:
        raise HTTPException(status_code=404, detail="Freelancer not found")
    return {"resume_id": resume_id, "availability_slots": freelancer.get("availability_slots", [])}


def _extract_resume_text(
    file: UploadFile, content: bytes, allow_empty_resume: bool = False, pdf_password: str = ""
) -> Tuple[str, str]:
    filename = (file.filename or "").lower()
    extension = "." + filename.rsplit(".", 1)[-1] if "." in filename else ""

    def _empty_text_fallback(detail: str) -> Tuple[str, str]:
        if allow_empty_resume:
            fallback_text = f"[UNPARSEABLE_RESUME:{extension or 'unknown'}] {detail}"
            return fallback_text, detail
        raise HTTPException(status_code=400, detail=detail)

    if filename.endswith(".txt"):
        text = content.decode("utf-8", errors="ignore").strip()
        if text:
            return text, ""
        return _empty_text_fallback("TXT has no readable text content.")

    if filename.endswith(".pdf"):
        if PdfReader is None:
            raise HTTPException(status_code=500, detail="PDF support requires pypdf. Install dependency and retry.")
        try:
            reader = PdfReader(io.BytesIO(content))
            if reader.is_encrypted:
                if pdf_password:
                    reader.decrypt(pdf_password)
                else:
                    return _empty_text_fallback(
                        "PDF is password-protected. Please enter the password in the password field and try again."
                    )
            text = "\n".join(page.extract_text() or "" for page in reader.pages).strip()
        except Exception:
            return _empty_text_fallback(
                "PDF could not be parsed. It is likely password-protected or corrupted. Convert it to a readable TXT/PDF and upload again."
            )
        if text:
            return text, ""
        return _empty_text_fallback(
            "PDF text extraction returned empty content. The PDF is likely scanned/image-only or protected."
        )

    if filename.endswith(".docx"):
        if Document is None:
            raise HTTPException(status_code=500, detail="DOCX support requires python-docx. Install dependency and retry.")
        document = Document(io.BytesIO(content))
        paragraphs = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text and paragraph.text.strip()]
        table_cells = []
        for table in document.tables:
            for row in table.rows:
                for cell in row.cells:
                    cell_text = cell.text.strip()
                    if cell_text:
                        table_cells.append(cell_text)
        text = "\n".join(paragraphs + table_cells).strip()
        if text:
            return text, ""
        return _empty_text_fallback("DOCX has no readable text in paragraphs or tables.")

    if filename.endswith(".doc"):
        # Legacy .doc is binary and not reliably parseable without external converters.
        decoded = content.decode("utf-8", errors="ignore").strip()
        if decoded:
            return decoded, "Legacy DOC parsed with fallback decoder. Convert to DOCX for better accuracy."
        return _empty_text_fallback(
            "Legacy DOC could not be parsed reliably. Convert the file to DOCX and upload again."
        )

    raise HTTPException(status_code=400, detail="Unsupported resume format. Upload TXT, PDF, DOCX, or DOC.")


def _extract_experience_from_text(resume_text_lower: str) -> tuple[int, int]:
    years = 0
    months = 0

    year_match = re.search(r"(\d{1,2})\s*\+?\s*(?:years?|yrs?)", resume_text_lower)
    month_match = re.search(r"(\d{1,2})\s*\+?\s*(?:months?|mos?)", resume_text_lower)

    if year_match:
        years = max(0, min(int(year_match.group(1)), 50))
    if month_match:
        months = max(0, min(int(month_match.group(1)), 11))

    if years == 0 and months == 0:
        for token in resume_text_lower.split():
            if token.isdigit():
                value = int(token)
                if 0 < value < 51:
                    years = value
                    break

    return years, months


def _extract_skills(resume_text_lower: str) -> List[str]:
    common_skills = {
        "python",
        "fastapi",
        "django",
        "flask",
        "react",
        "next.js",
        "node",
        "aws",
        "postgresql",
        "docker",
        "kubernetes",
    }
    return sorted(skill for skill in common_skills if skill in resume_text_lower)

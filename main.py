from __future__ import annotations

import hashlib
from typing import Dict, List

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

try:
    from sentence_transformers import SentenceTransformer
except ImportError:  # pragma: no cover
    SentenceTransformer = None


app = FastAPI(title="Freelancing AI Matching API")


class InMemoryCollection:
    """A tiny in-memory substitute for vector DB behaviour."""

    def __init__(self) -> None:
        self._rows: List[Dict] = []

    def add(self, documents: List[str], embeddings: List[List[float]], ids: List[str]) -> None:
        for doc, emb, item_id in zip(documents, embeddings, ids):
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


def cosine_similarity(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = sum(x * x for x in a) ** 0.5
    mag_b = sum(y * y for y in b) ** 0.5
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def _fallback_embedding(text: str, dim: int = 32) -> List[float]:
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    # deterministic pseudo-embedding for environments without sentence-transformers
    return [((digest[i % len(digest)] / 255.0) * 2) - 1 for i in range(dim)]


class EmbeddingService:
    def __init__(self) -> None:
        self.model = SentenceTransformer("all-MiniLM-L6-v2") if SentenceTransformer else None

    def encode(self, texts: List[str]) -> List[List[float]]:
        if self.model:
            vectors = self.model.encode(texts)
            return [vector.tolist() for vector in vectors]
        return [_fallback_embedding(text) for text in texts]


embedder = EmbeddingService()
resume_collection = InMemoryCollection()
resume_metadata: Dict[str, Dict] = {}


@app.get("/")
def healthcheck() -> Dict[str, str]:
    return {"status": "ok", "service": "Freelancing AI Matching API"}


@app.post("/upload-resume")
async def upload_resume(file: UploadFile = File(...)) -> Dict:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded resume is empty.")

    text = content.decode("utf-8", errors="ignore").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Could not parse UTF-8 text from resume.")

    embedding = embedder.encode([text])[0]
    resume_collection.add(documents=[text], embeddings=[embedding], ids=[file.filename])

    lowered = text.lower()
    resume_metadata[file.filename] = {
        "experience_years": _extract_experience_years(lowered),
        "skills": _extract_skills(lowered),
    }

    return {"message": "Resume stored successfully", "resume_id": file.filename}


@app.post("/post-job")
def post_job(job: JobPost) -> Dict:
    if not resume_metadata:
        raise HTTPException(status_code=404, detail="No resumes found. Upload resumes first.")

    job_embedding = embedder.encode([job.description])[0]
    semantic_matches = resume_collection.query(query_embedding=job_embedding, n_results=10)

    ranked = []
    for result in semantic_matches:
        candidate = resume_metadata.get(result["id"], {"skills": [], "experience_years": 0})
        experience_score = min(candidate["experience_years"] / max(job.min_experience_years, 1), 1.0)

        required = {skill.lower() for skill in job.required_skills}
        available = set(candidate["skills"])
        skill_score = len(required & available) / max(len(required), 1)

        final_score = round((0.5 * skill_score) + (0.3 * experience_score) + (0.2 * result["score"]), 4)
        ranked.append(
            {
                "resume_id": result["id"],
                "semantic_score": result["score"],
                "skill_score": round(skill_score, 4),
                "experience_score": round(experience_score, 4),
                "final_score": final_score,
            }
        )

    ranked.sort(key=lambda item: item["final_score"], reverse=True)
    return {"top_matches": ranked[:5]}


def _extract_experience_years(resume_text_lower: str) -> int:
    for token in resume_text_lower.split():
        if token.isdigit():
            value = int(token)
            if 0 < value < 51:
                return value
    return 0


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

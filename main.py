from __future__ import annotations

import hashlib
import uuid
from typing import Dict, List

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import HTMLResponse
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
    return {"status": "ok", "service": "Freelancing AI Matching API", "ui": "/ui"}


@app.get("/ui", response_class=HTMLResponse)
def freelancer_portal() -> str:
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Freelancing AI Portal</title>
      <style>
        :root {
          color-scheme: dark;
          --bg: #0f172a;
          --surface: #1e293b;
          --text: #f8fafc;
          --accent: #22d3ee;
        }
        body {
          font-family: Inter, system-ui, -apple-system, sans-serif;
          margin: 0;
          min-height: 100vh;
          background: linear-gradient(160deg, var(--bg), #020617);
          color: var(--text);
          display: grid;
          place-items: center;
        }
        main {
          width: min(760px, 92vw);
          background: rgba(30, 41, 59, 0.9);
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 16px;
          padding: 2rem;
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.35);
        }
        h1 { margin-top: 0; }
        p { color: #cbd5e1; }
        .actions {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
          margin-top: 1.25rem;
        }
        a {
          display: block;
          text-decoration: none;
          text-align: center;
          font-weight: 700;
          color: #082f49;
          background: linear-gradient(110deg, #0891b2, var(--accent));
          padding: 0.9rem;
          border-radius: 10px;
        }
      </style>
    </head>
    <body>
      <main>
        <h1>Freelancing AI Talent Portal</h1>
        <p>Select a dedicated page for freelancer resume intake or client job posting and matching.</p>
        <div class="actions">
          <a href="/ui/resume">Resume Intake Page</a>
          <a href="/ui/jobs">Job Posting Page</a>
        </div>
      </main>
    </body>
    </html>
    """


@app.get("/ui/resume", response_class=HTMLResponse)
def resume_portal() -> str:
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Freelancing AI Resume Intake</title>
      <style>
        :root {
          color-scheme: dark;
          --bg: #0f172a;
          --surface: #1e293b;
          --surface-soft: #334155;
          --text: #f8fafc;
          --accent: #22d3ee;
          --success: #22c55e;
          --warning: #f59e0b;
        }
        body {
          font-family: Inter, system-ui, -apple-system, sans-serif;
          margin: 0;
          background: linear-gradient(160deg, var(--bg), #020617);
          color: var(--text);
          min-height: 100vh;
        }
        .container {
          max-width: 1024px;
          margin: 0 auto;
          padding: 2rem 1rem 4rem;
        }
        h1 { font-size: 2rem; margin-bottom: 0.25rem; }
        .subtitle { color: #cbd5e1; margin-bottom: 1.5rem; }
        .card {
          background: rgba(30, 41, 59, 0.9);
          border-radius: 14px;
          padding: 1rem;
          border: 1px solid rgba(148, 163, 184, 0.3);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.35);
        }
        label {
          display: block;
          font-size: 0.9rem;
          margin-bottom: 0.25rem;
          color: #cbd5e1;
        }
        input, textarea {
          width: 100%;
          border-radius: 8px;
          border: 1px solid #475569;
          background: var(--surface-soft);
          color: var(--text);
          padding: 0.65rem;
          margin-bottom: 0.8rem;
          box-sizing: border-box;
        }
        button {
          width: 100%;
          background: linear-gradient(110deg, #0891b2, var(--accent));
          color: #082f49;
          border: none;
          border-radius: 10px;
          font-weight: 700;
          padding: 0.65rem;
          cursor: pointer;
        }
        button:hover { filter: brightness(1.08); }
        .message {
          font-size: 0.9rem;
          min-height: 1.1rem;
          margin-top: 0.45rem;
        }
        .success { color: var(--success); }
        .warning { color: var(--warning); }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 0.9rem;
          font-size: 0.9rem;
        }
        th, td {
          border-bottom: 1px solid #334155;
          text-align: left;
          padding: 0.45rem;
        }
        th { color: #67e8f9; }
      </style>
    </head>
    <body>
      <main class="container">
        <h1>Developer Resume Intake</h1>
        <p class="subtitle">Developers can upload resumes and profile details for AI-powered matching.</p>

        <article class="card">
          <h2>Freelancer Registration</h2>
          <form id="freelancerForm">
            <label for="name">Full name</label>
            <input id="name" name="name" required />

            <label for="email">Email</label>
            <input id="email" name="email" type="email" required />

            <label for="headline">Role / Headline</label>
            <input id="headline" name="headline" placeholder="Backend Python Developer" required />

            <label for="experience">Experience years</label>
            <input id="experience" name="experience_years" type="number" min="0" value="0" required />

            <label for="skills">Skills (comma-separated)</label>
            <input id="skills" name="skills" placeholder="python, fastapi, docker" />

            <label for="bio">Short bio</label>
            <textarea id="bio" name="bio" rows="3"></textarea>

            <label for="resume">Resume (.txt)</label>
            <input id="resume" name="resume" type="file" accept=".txt" required />

            <button type="submit">Upload Resume & Register</button>
            <p id="registerMessage" class="message"></p>
          </form>
        </article>
      </main>

      <script>
        const registerMessage = document.getElementById('registerMessage');

        document.getElementById('freelancerForm').addEventListener('submit', async (event) => {
          event.preventDefault();
          registerMessage.className = 'message';
          registerMessage.textContent = 'Uploading...';

          const formElement = event.target;
          const formData = new FormData();
          formData.append('name', formElement.name.value);
          formData.append('email', formElement.email.value);
          formData.append('headline', formElement.headline.value);
          formData.append('experience_years', formElement.experience_years.value);
          formData.append('skills', formElement.skills.value);
          formData.append('bio', formElement.bio.value);
          formData.append('file', formElement.resume.files[0]);

          try {
            const response = await fetch('/freelancers/register', { method: 'POST', body: formData });
            const data = await response.json();
            if (!response.ok) {
              throw new Error(data.detail || 'Failed to upload resume.');
            }
            registerMessage.className = 'message success';
            registerMessage.textContent = `Registered ${data.profile.name} (ID: ${data.resume_id})`;
            formElement.reset();
          } catch (error) {
            registerMessage.className = 'message warning';
            registerMessage.textContent = error.message;
          }
        });

      </script>
    </body>
    </html>
    """


@app.get("/ui/jobs", response_class=HTMLResponse)
def jobs_portal() -> str:
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Freelancing AI Job Posting</title>
      <style>
        :root {
          color-scheme: dark;
          --bg: #0f172a;
          --surface: #1e293b;
          --surface-soft: #334155;
          --text: #f8fafc;
          --accent: #22d3ee;
          --success: #22c55e;
          --warning: #f59e0b;
        }
        body {
          font-family: Inter, system-ui, -apple-system, sans-serif;
          margin: 0;
          background: linear-gradient(160deg, var(--bg), #020617);
          color: var(--text);
          min-height: 100vh;
        }
        .container {
          max-width: 1024px;
          margin: 0 auto;
          padding: 2rem 1rem 4rem;
        }
        .card {
          background: rgba(30, 41, 59, 0.9);
          border-radius: 14px;
          padding: 1rem;
          border: 1px solid rgba(148, 163, 184, 0.3);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.35);
        }
        label { display:block; margin-bottom:0.25rem; color:#cbd5e1; }
        input, textarea {
          width: 100%;
          border-radius: 8px;
          border: 1px solid #475569;
          background: var(--surface-soft);
          color: var(--text);
          padding: 0.65rem;
          margin-bottom: 0.8rem;
          box-sizing: border-box;
        }
        button {
          width: 100%;
          background: linear-gradient(110deg, #0891b2, var(--accent));
          color: #082f49;
          border: none;
          border-radius: 10px;
          font-weight: 700;
          padding: 0.65rem;
          cursor: pointer;
        }
        .message { font-size:0.9rem; min-height:1.1rem; margin-top:0.45rem; }
        .success { color: var(--success); }
        .warning { color: var(--warning); }
        table { width:100%; border-collapse: collapse; margin-top: 0.9rem; font-size: 0.9rem; }
        th, td { border-bottom: 1px solid #334155; text-align:left; padding: 0.45rem; }
        th { color: #67e8f9; }
      </style>
    </head>
    <body>
      <main class="container">
        <h1>Client Job Posting</h1>
        <p>Post a job and receive the top developer matches from uploaded resumes.</p>
        <article class="card">
          <form id="jobForm">
            <label for="description">Job description</label>
            <textarea id="description" name="description" rows="4" minlength="10" required></textarea>

            <label for="requiredSkills">Required skills (comma-separated)</label>
            <input id="requiredSkills" name="requiredSkills" placeholder="react, node, aws" />

            <label for="minExperience">Minimum experience years</label>
            <input id="minExperience" name="minExperience" type="number" min="0" value="0" />

            <button type="submit">Find Best Freelancers</button>
            <p id="jobMessage" class="message"></p>
          </form>
          <div id="results"></div>
        </article>
      </main>
      <script>
        const jobMessage = document.getElementById('jobMessage');
        const resultsContainer = document.getElementById('results');

        document.getElementById('jobForm').addEventListener('submit', async (event) => {
          event.preventDefault();
          jobMessage.className = 'message';
          jobMessage.textContent = 'Matching candidates...';
          resultsContainer.innerHTML = '';

          const form = event.target;
          const payload = {
            description: form.description.value,
            required_skills: form.requiredSkills.value
              .split(',')
              .map((skill) => skill.trim())
              .filter(Boolean),
            min_experience_years: Number(form.minExperience.value) || 0,
          };

          try {
            const response = await fetch('/post-job', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) {
              throw new Error(data.detail || 'Job matching failed.');
            }

            jobMessage.className = 'message success';
            jobMessage.textContent = `Found ${data.top_matches.length} top matches.`;

            const rows = data.top_matches.map((match) => `
              <tr>
                <td>${match.name}</td>
                <td>${match.headline}</td>
                <td>${match.final_score}</td>
                <td>${match.skill_score}</td>
                <td>${match.experience_score}</td>
              </tr>
            `).join('');

            resultsContainer.innerHTML = `
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Headline</th>
                    <th>Final Score</th>
                    <th>Skill</th>
                    <th>Experience</th>
                  </tr>
                </thead>
                <tbody>${rows || '<tr><td colspan="5">No results.</td></tr>'}</tbody>
              </table>
            `;
          } catch (error) {
            jobMessage.className = 'message warning';
            jobMessage.textContent = error.message;
          }
        });
      </script>
    </body>
    </html>
    """


@app.post("/freelancers/register")
async def register_freelancer(
    name: str = Form(...),
    email: str = Form(...),
    headline: str = Form(...),
    experience_years: int = Form(0),
    skills: str = Form(""),
    bio: str = Form(""),
    file: UploadFile = File(...),
) -> Dict:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded resume is empty.")

    text = content.decode("utf-8", errors="ignore").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Could not parse UTF-8 text from resume.")

    resume_id = f"resume-{uuid.uuid4().hex[:8]}"
    embedding = embedder.encode([text])[0]
    resume_collection.add(documents=[text], embeddings=[embedding], ids=[resume_id])

    typed_skills = [skill.strip().lower() for skill in skills.split(",") if skill.strip()]
    inferred_skills = _extract_skills(text.lower())
    merged_skills = sorted(set(typed_skills) | set(inferred_skills))

    resume_metadata[resume_id] = {
        "name": name,
        "email": email,
        "headline": headline,
        "bio": bio,
        "experience_years": max(experience_years, _extract_experience_years(text.lower())),
        "skills": merged_skills,
    }

    return {
        "message": "Freelancer registered successfully",
        "resume_id": resume_id,
        "profile": {"name": name, "email": email, "headline": headline, "skills": merged_skills},
    }


@app.post("/upload-resume")
async def upload_resume(file: UploadFile = File(...)) -> Dict:
    """Backward-compatible endpoint for plain resume-only uploads."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded resume is empty.")

    text = content.decode("utf-8", errors="ignore").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Could not parse UTF-8 text from resume.")

    resume_id = f"resume-{uuid.uuid4().hex[:8]}"
    embedding = embedder.encode([text])[0]
    resume_collection.add(documents=[text], embeddings=[embedding], ids=[resume_id])

    lowered = text.lower()
    resume_metadata[resume_id] = {
        "name": file.filename,
        "email": "",
        "headline": "Freelancer",
        "bio": "",
        "experience_years": _extract_experience_years(lowered),
        "skills": _extract_skills(lowered),
    }

    return {"message": "Resume stored successfully", "resume_id": resume_id}


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
                "name": candidate.get("name", result["id"]),
                "headline": candidate.get("headline", "Freelancer"),
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

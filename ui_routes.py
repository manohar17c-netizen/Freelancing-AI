from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from auth import get_authenticated_user

ui_router = APIRouter(tags=["ui"])


@ui_router.get("/ui", response_class=HTMLResponse)
def landing_page() -> str:
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Freelancing AI Portal</title>
      <style>
        :root { color-scheme: dark; --bg:#0f172a; --surface:#1e293b; --text:#f8fafc; --accent:#22d3ee; }
        body { font-family: Inter, system-ui, sans-serif; margin:0; min-height:100vh; background:linear-gradient(160deg,var(--bg),#020617); color:var(--text); display:grid; place-items:center; }
        main { width:min(760px,92vw); background:rgba(30,41,59,.9); border:1px solid rgba(148,163,184,.25); border-radius:16px; padding:2rem; }
        .actions { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:1rem; margin-top:1.2rem; }
        a { text-decoration:none; text-align:center; font-weight:700; color:#082f49; background:linear-gradient(110deg,#0891b2,var(--accent)); padding:.9rem; border-radius:10px; }
      </style>
    </head>
    <body>
      <main>
        <h1>Freelancing AI Talent Portal</h1>
        <p>Choose the workflow that matches your role.</p>
        <div class="actions">
          <a href="/auth/login?next=/ui/resume">I am a developer</a>
          <a href="/ui/jobs">I need a developer</a>
        </div>
      </main>
    </body>
    </html>
    """


@ui_router.get("/ui/resume", response_class=HTMLResponse)
def resume_page(request: Request):
    user = get_authenticated_user(request)
    if not user:
        return RedirectResponse("/auth/login?next=/ui/resume", status_code=302)

    user_name = user.get("name", "")
    user_email = user.get("email", "")
    provider = user.get("provider", "provider")

    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Developer Resume Intake</title>
      <style>
        :root {{ color-scheme: dark; --bg:#0f172a; --surface:#1e293b; --surface-soft:#334155; --text:#f8fafc; --accent:#22d3ee; --success:#22c55e; --warning:#f59e0b; }}
        body {{ font-family: Inter, system-ui, sans-serif; margin:0; background:linear-gradient(160deg,var(--bg),#020617); color:var(--text); min-height:100vh; }}
        .container {{ max-width:1024px; margin:0 auto; padding:2rem 1rem 4rem; }}
        .card {{ background:rgba(30,41,59,.9); border-radius:14px; padding:1rem; border:1px solid rgba(148,163,184,.3); }}
        input, textarea {{ width:100%; border-radius:8px; border:1px solid #475569; background:var(--surface-soft); color:var(--text); padding:.65rem; margin-bottom:.8rem; box-sizing:border-box; }}
        button {{ width:100%; background:linear-gradient(110deg,#0891b2,var(--accent)); color:#082f49; border:none; border-radius:10px; font-weight:700; padding:.65rem; cursor:pointer; }}
        .message {{ min-height:1.1rem; margin-top:.45rem; }}
        .success {{ color:var(--success); }} .warning {{ color:var(--warning); }}
      </style>
    </head>
    <body>
      <main class="container">
        <h1>Developer Resume Intake</h1>
        <p>Signed in via {provider.title()}. Complete your profile and upload your resume.</p>
        <article class="card">
          <form id="freelancerForm">
            <label for="name">Full name</label>
            <input id="name" name="name" value="{user_name}" required />

            <label for="email">Email</label>
            <input id="email" name="email" type="email" value="{user_email}" required />

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
        document.getElementById('freelancerForm').addEventListener('submit', async (event) => {{
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
          try {{
            const response = await fetch('/freelancers/register', {{ method:'POST', body:formData }});
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Failed to upload resume.');
            registerMessage.className = 'message success';
            registerMessage.textContent = `Registered ${{data.profile.name}} (ID: ${{data.resume_id}})`;
            formElement.reset();
            formElement.name.value = '{user_name}';
            formElement.email.value = '{user_email}';
          }} catch (error) {{
            registerMessage.className = 'message warning';
            registerMessage.textContent = error.message;
          }}
        }});
      </script>
    </body>
    </html>
    """


@ui_router.get("/ui/jobs", response_class=HTMLResponse)
def jobs_page() -> str:
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Freelancing AI Job Posting</title>
      <style>
        :root { color-scheme: dark; --bg:#0f172a; --surface:#1e293b; --surface-soft:#334155; --text:#f8fafc; --accent:#22d3ee; --success:#22c55e; --warning:#f59e0b; }
        body { font-family: Inter, system-ui, sans-serif; margin:0; background:linear-gradient(160deg,var(--bg),#020617); color:var(--text); min-height:100vh; }
        .container { max-width:1024px; margin:0 auto; padding:2rem 1rem 4rem; }
        .card { background:rgba(30,41,59,.9); border-radius:14px; padding:1rem; border:1px solid rgba(148,163,184,.3); }
        input, textarea { width:100%; border-radius:8px; border:1px solid #475569; background:var(--surface-soft); color:var(--text); padding:.65rem; margin-bottom:.8rem; box-sizing:border-box; }
        button { width:100%; background:linear-gradient(110deg,#0891b2,var(--accent)); color:#082f49; border:none; border-radius:10px; font-weight:700; padding:.65rem; cursor:pointer; }
        .message { font-size:.9rem; min-height:1.1rem; margin-top:.45rem; }
        .success { color:var(--success); } .warning { color:var(--warning); }
        table { width:100%; border-collapse:collapse; margin-top:.9rem; font-size:.9rem; }
        th, td { border-bottom:1px solid #334155; text-align:left; padding:.45rem; }
      </style>
    </head>
    <body>
      <main class="container">
        <h1>Client Job Posting</h1>
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
            required_skills: form.requiredSkills.value.split(',').map((s) => s.trim()).filter(Boolean),
            min_experience_years: Number(form.minExperience.value) || 0,
          };
          try {
            const response = await fetch('/post-job', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Job matching failed.');
            jobMessage.className = 'message success';
            jobMessage.textContent = `Found ${data.top_matches.length} top matches.`;
            const rows = data.top_matches.map((m) => `
              <tr><td>${m.name}</td><td>${m.headline}</td><td>${m.final_score}</td><td>${m.skill_score}</td><td>${m.experience_score}</td></tr>
            `).join('');
            resultsContainer.innerHTML = `<table><thead><tr><th>Name</th><th>Headline</th><th>Final Score</th><th>Skill</th><th>Experience</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No results.</td></tr>'}</tbody></table>`;
          } catch (error) {
            jobMessage.className = 'message warning';
            jobMessage.textContent = error.message;
          }
        });
      </script>
    </body>
    </html>
    """

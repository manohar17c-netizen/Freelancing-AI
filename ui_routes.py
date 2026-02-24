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
        :root {
          --bg:#f8f5ff;
          --surface:#ffffff;
          --surface-alt:#f1eafe;
          --text:#1e1534;
          --muted:#6b5a8e;
          --brand:#6d28d9;
          --brand-strong:#5b21b6;
          --accent:#f97316;
          --border:#dfd1fb;
        }
        * { box-sizing:border-box; }
        body {
          margin:0;
          font-family: Inter, system-ui, -apple-system, sans-serif;
          color:var(--text);
          background:
            radial-gradient(circle at 0% 0%, #efe7ff 0, transparent 40%),
            radial-gradient(circle at 100% 100%, #ffe8d6 0, transparent 35%),
            var(--bg);
        }
        .container { width:min(1120px, 92vw); margin:0 auto; }
        header {
          padding:1.2rem 0;
          display:flex;
          justify-content:space-between;
          align-items:center;
        }
        .logo { font-weight:800; font-size:1.15rem; }
        .logo span { color:var(--brand); }
        .hero {
          margin:1rem auto 3rem;
          border:1px solid var(--border);
          border-radius:24px;
          padding:2.2rem;
          background:linear-gradient(130deg, #ffffff 20%, #f3ebff 100%);
          box-shadow:0 20px 40px rgba(109,40,217,.12);
          display:grid;
          gap:1rem;
        }
        .badge {
          width:max-content;
          padding:.35rem .8rem;
          border-radius:999px;
          background:var(--surface-alt);
          color:var(--brand-strong);
          font-weight:700;
          font-size:.8rem;
        }
        h1 { margin:.3rem 0; font-size:clamp(1.8rem, 5vw, 3.2rem); }
        p { color:var(--muted); max-width:62ch; line-height:1.55; }
        .actions {
          margin-top:.5rem;
          display:grid;
          grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));
          gap:1rem;
        }
        .action {
          text-decoration:none;
          border:1px solid var(--border);
          border-radius:16px;
          padding:1.1rem;
          background:var(--surface);
          color:var(--text);
          font-weight:700;
          transition:transform .2s ease, box-shadow .2s ease;
        }
        .action:hover { transform:translateY(-2px); box-shadow:0 10px 20px rgba(91,33,182,.15); }
        .action.primary {
          background:linear-gradient(100deg, var(--brand), var(--brand-strong));
          color:#fff;
          border-color:transparent;
        }
        .grid {
          margin-top:1.4rem;
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
          gap:.9rem;
        }
        .stat {
          border:1px solid var(--border);
          border-radius:14px;
          padding:1rem;
          background:#fff;
        }
        .stat b { font-size:1.25rem; display:block; color:var(--brand-strong); }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <div class="logo"><span>Freelancing</span>AI</div>
          <nav style="display:flex; gap:.8rem"><a style="text-decoration:none;color:var(--brand);font-weight:700" href="/auth/login?next=/ui/resume">Login</a><a style="text-decoration:none;color:var(--accent);font-weight:700" href="/auth/logout">Logout</a></nav>
        </header>

        <main class="hero">
          <div class="badge">Marketplace makeover • Upwork-inspired</div>
          <h1>Find expert freelancers or your next high-value contract.</h1>
          <p>A polished hiring experience built for speed: profile intake, AI ranking, and instant top-match recommendations for your project needs.</p>
          <div class="actions">
            <a class="action primary" href="/auth/login?next=/ui/resume">I’m a Freelancer → Build My Profile</a>
            <a class="action" href="/ui/jobs">I’m Hiring → Post a Job</a>
          </div>
          <div class="grid">
            <div class="stat"><b>10x</b><span>Faster talent discovery with AI ranking.</span></div>
            <div class="stat"><b>Quality-first</b><span>Skill + experience weighted matching.</span></div>
            <div class="stat"><b>Simple flow</b><span>Upload resume and get discovered quickly.</span></div>
          </div>
        </main>
      </div>
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
      <title>Freelancer Profile Intake</title>
      <style>
        :root {{
          --bg:#f8f5ff;
          --surface:#ffffff;
          --surface-soft:#f5f0ff;
          --text:#1e1534;
          --muted:#6b5a8e;
          --brand:#6d28d9;
          --brand-strong:#5b21b6;
          --success:#0f9d58;
          --warning:#b45309;
          --border:#ddcdfb;
        }}
        * {{ box-sizing:border-box; }}
        body {{ margin:0; font-family: Inter, system-ui, sans-serif; background:var(--bg); color:var(--text); }}
        .container {{ max-width:1080px; margin:0 auto; padding:1.4rem 1rem 3rem; }}
        .topbar {{ display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; }}
        .brand {{ font-size:1.05rem; font-weight:800; }}
        .brand span {{ color:var(--brand); }}
        .layout {{ display:grid; grid-template-columns:320px 1fr; gap:1rem; }}
        .panel, .card {{ background:var(--surface); border:1px solid var(--border); border-radius:18px; }}
        .panel {{ padding:1.1rem; }}
        .panel p {{ color:var(--muted); line-height:1.45; }}
        .card {{ padding:1.3rem; box-shadow:0 14px 24px rgba(109,40,217,.08); }}
        input, textarea {{
          width:100%; border-radius:10px; border:1px solid #ccb8f8; background:var(--surface-soft);
          color:var(--text); padding:.7rem .8rem; margin:.35rem 0 .9rem; font-size:.95rem;
        }}
        label {{ font-weight:700; font-size:.9rem; }}
        button {{
          width:100%; border:none; border-radius:12px; color:#fff; font-weight:800; padding:.8rem;
          background:linear-gradient(100deg,var(--brand), var(--brand-strong)); cursor:pointer;
        }}
        .message {{ min-height:1.1rem; margin-top:.55rem; font-weight:600; }}
        .success {{ color:var(--success); }} .warning {{ color:var(--warning); }}
        @media (max-width:900px) {{ .layout {{ grid-template-columns:1fr; }} }}
      </style>
    </head>
    <body>
      <main class="container">
        <div class="topbar">
          <div class="brand"><span>Freelancing</span>AI</div>
          <small>Signed in via {provider.title()} · <a href="/auth/logout">Logout</a></small>
        </div>
        <section class="layout">
          <aside class="panel">
            <h2 style="margin-top:0">Create a standout profile</h2>
            <p>Complete your details so clients can discover and hire you faster. Your resume text and profile are ranked by skill fit + relevant experience.</p>
            <ul>
              <li>Use a clear headline</li>
              <li>Add key skills clients search for</li>
              <li>Upload a readable .txt resume</li>
            </ul>
          </aside>
          <article class="card">
            <h1 style="margin-top:0">Freelancer onboarding</h1>
            <form id="freelancerForm">
              <label for="name">Full name</label>
              <input id="name" name="name" value="{user_name}" required />

              <label for="email">Email</label>
              <input id="email" name="email" type="email" value="{user_email}" required />

              <label for="headline">Role / Headline</label>
              <input id="headline" name="headline" placeholder="Senior Backend Engineer" required />

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
        </section>
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
      <title>Client Job Posting</title>
      <style>
        :root {
          --bg:#f8f5ff;
          --surface:#ffffff;
          --surface-soft:#f5f0ff;
          --text:#1e1534;
          --muted:#6b5a8e;
          --brand:#6d28d9;
          --brand-strong:#5b21b6;
          --success:#0f9d58;
          --warning:#b45309;
          --border:#ddcdfb;
        }
        * { box-sizing:border-box; }
        body { margin:0; font-family: Inter, system-ui, sans-serif; background:var(--bg); color:var(--text); }
        .container { max-width:1080px; margin:0 auto; padding:1.4rem 1rem 3rem; }
        .brand { font-size:1.05rem; font-weight:800; margin-bottom:1rem; }
        .brand span { color:var(--brand); }
        .card { background:var(--surface); border:1px solid var(--border); border-radius:18px; padding:1.3rem; box-shadow:0 14px 24px rgba(109,40,217,.08); }
        input, textarea {
          width:100%; border-radius:10px; border:1px solid #ccb8f8; background:var(--surface-soft);
          color:var(--text); padding:.7rem .8rem; margin:.35rem 0 .9rem; font-size:.95rem;
        }
        label { font-weight:700; font-size:.9rem; }
        button {
          width:100%; border:none; border-radius:12px; color:#fff; font-weight:800; padding:.8rem;
          background:linear-gradient(100deg,var(--brand), var(--brand-strong)); cursor:pointer;
        }
        .message { font-size:.9rem; min-height:1.1rem; margin-top:.5rem; font-weight:600; }
        .success { color:var(--success); } .warning { color:var(--warning); }
        table { width:100%; border-collapse:collapse; margin-top:.95rem; font-size:.92rem; border:1px solid var(--border); border-radius:10px; overflow:hidden; }
        th, td { border-bottom:1px solid #e5dafc; text-align:left; padding:.58rem; }
        thead { background:#f0e8ff; }
      </style>
    </head>
    <body>
      <main class="container">
        <div class="brand"><span>Freelancing</span>AI</div>
        <p style="margin:.15rem 0 .85rem"><a href="/auth/login?next=/ui/resume">Freelancer Login</a> · <a href="/auth/logout">Logout</a></p>
        <article class="card">
          <h1 style="margin-top:0">Post a job and match top freelancers</h1>
          <p style="color:var(--muted)">Describe your project and instantly receive ranked recommendations based on semantic fit, required skills, and experience.</p>
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

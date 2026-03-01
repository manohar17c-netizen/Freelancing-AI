import React from "react";
import { useEffect, useState } from "react";

const initialForm = {
  name: "",
  email: "",
  headline: "",
  experience_years: 0,
  skills: "",
  bio: "",
};

export default function ResumePage() {
  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [authState, setAuthState] = useState({ loading: true, user: null });

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch("/auth/me", { credentials: "include" });
        if (response.status === 401) {
          window.location.href = "/auth/start/google?next=/ui/resume";
          return;
        }

        const data = await response.json();
        if (!response.ok || !data.authenticated) {
          throw new Error("Unable to load user session.");
        }

        setForm((prev) => ({
          ...prev,
          name: data.user.name || "",
          email: data.user.email || "",
        }));
        setAuthState({ loading: false, user: data.user });
      } catch (error) {
        setStatus({ type: "warning", message: error.message });
        setAuthState({ loading: false, user: null });
      }
    }

    loadSession();
  }, []);

  function onChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!file) {
      setStatus({ type: "warning", message: "Please upload your resume file." });
      return;
    }

    setStatus({ type: "", message: "Uploading..." });
    const body = new FormData();
    body.append("name", form.name);
    body.append("email", form.email);
    body.append("headline", form.headline);
    body.append("experience_years", String(form.experience_years));
    body.append("skills", form.skills);
    body.append("bio", form.bio);
    body.append("file", file);

    try {
      const response = await fetch("/freelancers/register", {
        method: "POST",
        body,
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to upload resume.");
      }

      setStatus({
        type: "success",
        message: `Registered ${data.profile.name} (ID: ${data.resume_id})`,
      });
      setFile(null);
      setForm((prev) => ({
        ...prev,
        headline: "",
        experience_years: 0,
        skills: "",
        bio: "",
      }));
    } catch (error) {
      setStatus({ type: "warning", message: error.message });
    }
  }

  if (authState.loading) {
    return (
      <div className="page">
        <main className="container">
          <article className="panel">
            <h1>Loading profile...</h1>
          </article>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <main className="container">
        <div className="topbar">
          <div className="logo">
            <span>Freelancing</span>AI
          </div>
          <div className="topbar-actions">
            <small>Signed in via {(authState.user?.provider || "provider").toUpperCase()}</small>
            <a className="text-link" href="/auth/logout">
              Logout
            </a>
          </div>
        </div>

        <section className="layout-grid">
          <aside className="panel">
            <h2>Create a standout profile</h2>
            <p className="muted">
              Complete your details so clients can discover and hire you faster. Your resume text and profile are
              ranked by skill fit + relevant experience.
            </p>
            <ul>
              <li>Use a clear headline</li>
              <li>Add key skills clients search for</li>
              <li>Upload a readable .txt resume</li>
            </ul>
          </aside>

          <article className="panel card-shadow">
            <h1>Freelancer onboarding</h1>
            <form onSubmit={onSubmit}>
              <label htmlFor="name">Full name</label>
              <input id="name" name="name" value={form.name} onChange={onChange} required />

              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" value={form.email} onChange={onChange} required />

              <label htmlFor="headline">Role / Headline</label>
              <input
                id="headline"
                name="headline"
                value={form.headline}
                onChange={onChange}
                placeholder="Senior Backend Engineer"
                required
              />

              <label htmlFor="experience_years">Experience years</label>
              <input
                id="experience_years"
                name="experience_years"
                type="number"
                min={0}
                value={form.experience_years}
                onChange={onChange}
                required
              />

              <label htmlFor="skills">Skills (comma-separated)</label>
              <input
                id="skills"
                name="skills"
                value={form.skills}
                onChange={onChange}
                placeholder="python, fastapi, docker"
              />

              <label htmlFor="bio">Short bio</label>
              <textarea id="bio" name="bio" rows={3} value={form.bio} onChange={onChange} />

              <label htmlFor="resume">Resume (.txt)</label>
              <input
                id="resume"
                name="resume"
                type="file"
                accept=".txt"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                required
              />

              <button type="submit">Upload Resume & Register</button>
              <p className={`message ${status.type}`}>{status.message}</p>
            </form>
          </article>
        </section>
      </main>
    </div>
  );
}

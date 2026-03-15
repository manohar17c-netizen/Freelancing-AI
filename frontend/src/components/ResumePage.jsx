import React from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const initialForm = {
  name: "",
  email: "",
  headline: "",
  experience_years: 0,
  experience_months: 0,
  skills: "",
  bio: "",
  whatsapp_phone: "",
  availability_slots: [],
  pdf_password: "",
};

export default function ResumePage() {
  const backendBase = import.meta.env.DEV ? "http://127.0.0.1:8000" : "";
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState(null);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [newSlot, setNewSlot] = useState({ day: "", start: "", end: "" });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [authState, setAuthState] = useState({ loading: true, user: null });

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch(`${backendBase}/auth/me`, { credentials: "include" });
        if (response.status === 401) {
          window.location.href = `${backendBase}/auth/login?next=/ui/resume`;
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
    const v = name === "experience_years" || name === "experience_months" ? Number(value) || 0 : value;
    setForm((prev) => ({ ...prev, [name]: v }));
  }

  function addSlot() {
    if (!newSlot.day || !newSlot.start || !newSlot.end) return;
    const slot = { day: newSlot.day, start: newSlot.start, end: newSlot.end };
    setForm((prev) => ({
      ...prev,
      availability_slots: [...(prev.availability_slots || []), slot],
    }));
    setNewSlot({ day: "", start: "", end: "" });
  }

  function removeSlot(idx) {
    setForm((prev) => ({
      ...prev,
      availability_slots: prev.availability_slots.filter((_, i) => i !== idx),
    }));
  }

  function onResumeUpload(event) {
    event.preventDefault();
    if (!file) {
      setStatus({ type: "warning", message: "Please choose a resume file before uploading." });
      return;
    }
    setResumeUploaded(true);
    setStatus({ type: "success", message: `Resume ready: ${file.name}` });
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!file || !resumeUploaded) {
      setStatus({ type: "warning", message: "Please upload your resume using the Upload Resume button first." });
      return;
    }

    setStatus({ type: "", message: "Uploading..." });
    const body = new FormData();
    body.append("name", form.name);
    body.append("email", form.email);
    body.append("headline", form.headline);
    body.append("experience_years", String(form.experience_years));
    body.append("experience_months", String(form.experience_months));
    body.append("skills", form.skills);
    body.append("bio", form.bio);
    body.append("whatsapp_phone", form.whatsapp_phone);
    body.append("availability_slots", JSON.stringify(form.availability_slots || []));
    body.append("pdf_password", form.pdf_password || "");
    body.append("file", file);

    try {
      const response = await fetch(`${backendBase}/freelancers/register`, {
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
        message: data.warning
          ? `Registered ${data.profile.name} (ID: ${data.resume_id}) with warning: ${data.warning}`
          : `Registered ${data.profile.name} (ID: ${data.resume_id})`,
      });
      setFile(null);
      setResumeUploaded(false);
      setForm((prev) => ({
        ...prev,
        headline: "",
        experience_years: 0,
        experience_months: 0,
        skills: "",
        bio: "",
        availability_slots: [],
      }));
      setTimeout(() => {
        navigate("/freelancer/home");
      }, 700);
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
            <a className="text-link" href={`${backendBase}/auth/logout`}>
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

              <div className="experience-row">
                <div>
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
                </div>
                <div>
                  <label htmlFor="experience_months">Experience months</label>
                  <input
                    id="experience_months"
                    name="experience_months"
                    type="number"
                    min={0}
                    max={11}
                    value={form.experience_months}
                    onChange={onChange}
                    required
                  />
                </div>
              </div>

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

              <label htmlFor="whatsapp_phone">WhatsApp number (for client contact)</label>
              <input
                id="whatsapp_phone"
                name="whatsapp_phone"
                value={form.whatsapp_phone}
                onChange={onChange}
                placeholder="+1234567890"
              />

              <label>Availability slots (when clients can schedule interviews)</label>
              <div className="slot-add-row">
                <input
                  placeholder="Day (e.g. Mon, Tue)"
                  value={newSlot.day}
                  onChange={(e) => setNewSlot((s) => ({ ...s, day: e.target.value }))}
                />
                <input
                  type="time"
                  placeholder="Start"
                  value={newSlot.start}
                  onChange={(e) => setNewSlot((s) => ({ ...s, start: e.target.value }))}
                />
                <input
                  type="time"
                  placeholder="End"
                  value={newSlot.end}
                  onChange={(e) => setNewSlot((s) => ({ ...s, end: e.target.value }))}
                />
                <button type="button" className="slot-add-btn" onClick={addSlot}>
                  Add slot
                </button>
              </div>
              {(form.availability_slots || []).length > 0 && (
                <ul className="slot-list">
                  {(form.availability_slots || []).map((s, i) => (
                    <li key={i}>
                      {s.day} {s.start}–{s.end}
                      <button type="button" className="slot-remove" onClick={() => removeSlot(i)}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <label htmlFor="resume">Resume (.txt, .pdf, .docx, .doc)</label>
              <div className="upload-row">
                <input
                  id="resume"
                  name="resume"
                  type="file"
                  accept=".txt,.pdf,.docx,.doc"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] || null);
                    setResumeUploaded(false);
                  }}
                  required
                />
                <button className="upload-btn" type="button" onClick={onResumeUpload}>
                  Upload Resume
                </button>
              </div>

              <label htmlFor="pdf_password">PDF password (only if your PDF is locked)</label>
              <input
                id="pdf_password"
                name="pdf_password"
                type="password"
                value={form.pdf_password}
                onChange={onChange}
                placeholder="Enter PDF password if required"
              />

              <button type="submit">Register</button>
              <p className={`message ${status.type}`}>{status.message}</p>
            </form>
          </article>
        </section>
      </main>
    </div>
  );
}

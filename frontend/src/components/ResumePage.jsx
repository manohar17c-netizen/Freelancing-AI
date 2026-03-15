import React from "react";
import { useEffect, useRef, useState } from "react";
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

function formFromProfile(profile, fallbackUser = null) {
  return {
    name: profile?.name || fallbackUser?.name || "",
    email: profile?.email || fallbackUser?.email || "",
    headline: profile?.headline || "",
    experience_years: profile?.experience_years || 0,
    experience_months: profile?.experience_months || 0,
    skills: Array.isArray(profile?.skills) ? profile.skills.join(", ") : "",
    bio: profile?.bio || "",
    whatsapp_phone: profile?.whatsapp_phone || "",
    availability_slots: Array.isArray(profile?.availability_slots) ? profile.availability_slots : [],
    pdf_password: "",
  };
}

export default function ResumePage() {
  const backendBase = import.meta.env.DEV ? "http://127.0.0.1:8000" : "";
  const navigate = useNavigate();
  const dateInputRef = useRef(null);
  const resumeInputRef = useRef(null);
  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState(null);
  const [newSlot, setNewSlot] = useState({ date: "", start: "", end: "" });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [authState, setAuthState] = useState({ loading: true, user: null });
  const [profileState, setProfileState] = useState({ loading: true, registered: false, profile: null });
  const [savedForm, setSavedForm] = useState(initialForm);
  const [isEditing, setIsEditing] = useState(true);

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

        const profileResponse = await fetch(`${backendBase}/freelancers/me`, { credentials: "include" });
        const profileData = await profileResponse.json();
        if (profileResponse.ok && profileData.registered && profileData.profile) {
          const hydratedForm = formFromProfile(profileData.profile, data.user);
          setForm(hydratedForm);
          setSavedForm(hydratedForm);
          setProfileState({ loading: false, registered: true, profile: profileData.profile });
          setIsEditing(false);
        } else {
          const freshForm = formFromProfile(null, data.user);
          setForm(freshForm);
          setSavedForm(freshForm);
          setProfileState({ loading: false, registered: false, profile: null });
          setIsEditing(true);
        }
        setAuthState({ loading: false, user: data.user });
      } catch (error) {
        setStatus({ type: "warning", message: error.message });
        setAuthState({ loading: false, user: null });
        setProfileState({ loading: false, registered: false, profile: null });
      }
    }

    loadSession();
  }, [backendBase]);

  function onChange(event) {
    const { name, value } = event.target;
    const v = name === "experience_years" || name === "experience_months" ? Number(value) || 0 : value;
    setForm((prev) => ({ ...prev, [name]: v }));
  }

  function startEditing() {
    setStatus({ type: "", message: "" });
    setIsEditing(true);
  }

  function cancelEditing() {
    setForm(savedForm);
    setFile(null);
    setNewSlot({ date: "", start: "", end: "" });
    if (resumeInputRef.current) {
      resumeInputRef.current.value = "";
    }
    setStatus({ type: "", message: "" });
    setIsEditing(false);
  }

  function addSlot() {
    if (!newSlot.date || !newSlot.start || !newSlot.end) return;
    const slot = { date: newSlot.date, start: newSlot.start, end: newSlot.end };
    setForm((prev) => ({
      ...prev,
      availability_slots: [...(prev.availability_slots || []), slot],
    }));
    setNewSlot({ date: "", start: "", end: "" });
  }

  function removeSlot(idx) {
    setForm((prev) => ({
      ...prev,
      availability_slots: prev.availability_slots.filter((_, i) => i !== idx),
    }));
  }

  function openDatePicker() {
    if (!dateInputRef.current) return;
    if (typeof dateInputRef.current.showPicker === "function") {
      dateInputRef.current.showPicker();
    } else {
      dateInputRef.current.focus();
    }
  }

  function onResumeSelect(event) {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);

    if (!selectedFile) {
      setStatus((prev) => (prev.type === "success" ? { type: "", message: "" } : prev));
      return;
    }

    setStatus({ type: "success", message: `Resume selected automatically: ${selectedFile.name}` });
  }

  function removeSelectedResume() {
    setFile(null);
    if (resumeInputRef.current) {
      resumeInputRef.current.value = "";
    }
    setStatus({ type: "", message: "" });
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!file) {
      if (!profileState.registered) {
        setStatus({ type: "warning", message: "Please select your resume file before submitting." });
        return;
      }
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
    if (file) {
      body.append("file", file);
    }

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
          ? `${data.message}: ${data.profile.name} (ID: ${data.resume_id}) with warning: ${data.warning}`
          : `${data.message}: ${data.profile.name} (ID: ${data.resume_id})`,
      });
      setFile(null);
      if (resumeInputRef.current) {
        resumeInputRef.current.value = "";
      }
      setProfileState((prev) => ({
        loading: false,
        registered: true,
        profile: {
          ...(prev.profile || {}),
          resume_id: data.resume_id,
          name: form.name,
          email: form.email,
          headline: form.headline,
          bio: form.bio,
          experience_years: form.experience_years,
          experience_months: form.experience_months,
          skills: form.skills
            .split(",")
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean),
          availability_slots: form.availability_slots,
          whatsapp_phone: form.whatsapp_phone,
          profile_live: true,
        },
      }));
      setSavedForm({
        ...form,
        pdf_password: "",
        availability_slots: form.availability_slots.map((slot) => ({ ...slot })),
      });
      setIsEditing(false);
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
            <h1>{profileState.registered ? "Edit freelancer profile" : "Freelancer onboarding"}</h1>
            {profileState.registered ? (
              <p className="muted profile-form-note">
                {isEditing
                  ? "Update any field below. Upload a new resume only if you want to replace the current one."
                  : "Your saved profile is shown below. Use Edit profile when you want to make changes."}
              </p>
            ) : null}
            {profileState.registered && !isEditing ? (
              <div className="profile-actions-row">
                <button type="button" className="btn-outline" onClick={startEditing}>
                  Edit profile
                </button>
              </div>
            ) : null}
            <form onSubmit={onSubmit}>
              <label htmlFor="name">Full name</label>
              <input id="name" name="name" value={form.name} onChange={onChange} required disabled={!isEditing} />

              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={onChange}
                required
                disabled={!isEditing}
              />

              <label htmlFor="headline">Role / Headline</label>
              <input
                id="headline"
                name="headline"
                value={form.headline}
                onChange={onChange}
                placeholder="Senior Backend Engineer"
                required
                disabled={!isEditing}
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
                    disabled={!isEditing}
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
                    disabled={!isEditing}
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
                disabled={!isEditing}
              />

              <label htmlFor="bio">Short bio</label>
              <textarea id="bio" name="bio" rows={3} value={form.bio} onChange={onChange} disabled={!isEditing} />

              <label htmlFor="whatsapp_phone">WhatsApp number (for client contact)</label>
              <input
                id="whatsapp_phone"
                name="whatsapp_phone"
                value={form.whatsapp_phone}
                onChange={onChange}
                placeholder="+1234567890"
                disabled={!isEditing}
              />

              <label>Availability slots (when clients can schedule interviews)</label>
              <div className="slot-add-row">
                <div className="date-input-row">
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={newSlot.date}
                    onChange={(e) => setNewSlot((s) => ({ ...s, date: e.target.value }))}
                    disabled={!isEditing}
                  />
                  <button
                    type="button"
                    className="slot-add-btn slot-picker-btn"
                    onClick={openDatePicker}
                    disabled={!isEditing}
                  >
                    Open calendar
                  </button>
                </div>
                <input
                  type="time"
                  placeholder="Start"
                  value={newSlot.start}
                  onChange={(e) => setNewSlot((s) => ({ ...s, start: e.target.value }))}
                  disabled={!isEditing}
                />
                <input
                  type="time"
                  placeholder="End"
                  value={newSlot.end}
                  onChange={(e) => setNewSlot((s) => ({ ...s, end: e.target.value }))}
                  disabled={!isEditing}
                />
                <button type="button" className="slot-add-btn" onClick={addSlot} disabled={!isEditing}>
                  Add slot
                </button>
              </div>
              {(form.availability_slots || []).length > 0 && (
                <ul className="slot-list">
                  {(form.availability_slots || []).map((s, i) => (
                    <li key={i}>
                      {s.date} {s.start}–{s.end}
                      <button type="button" className="slot-remove" onClick={() => removeSlot(i)} disabled={!isEditing}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <label htmlFor="resume">Resume (.txt, .pdf, .docx, .doc)</label>
              <div className="upload-row">
                <input
                  ref={resumeInputRef}
                  id="resume"
                  name="resume"
                  type="file"
                  accept=".txt,.pdf,.docx,.doc"
                  onChange={onResumeSelect}
                  required={!profileState.registered}
                  disabled={!isEditing}
                />
                {file ? (
                  <button className="upload-btn upload-delete-btn" type="button" onClick={removeSelectedResume}>
                    Delete selected file
                  </button>
                ) : null}
              </div>
              {file ? <p className="muted">Selected file: {file.name}</p> : null}
              {!file && profileState.registered ? (
                <p className="muted">Current resume is kept as-is unless you choose a replacement file.</p>
              ) : null}

              <label htmlFor="pdf_password">PDF password (only if your PDF is locked)</label>
              <input
                id="pdf_password"
                name="pdf_password"
                type="password"
                value={form.pdf_password}
                onChange={onChange}
                placeholder="Enter PDF password if required"
                disabled={!isEditing}
              />

              <div className="profile-actions-row">
                {(isEditing || !profileState.registered) && (
                  <button type="submit">{profileState.registered ? "Save changes" : "Register"}</button>
                )}
                {profileState.registered && isEditing ? (
                  <button type="button" className="btn-cancel" onClick={cancelEditing}>
                    Cancel
                  </button>
                ) : null}
              </div>
              <p className={`message ${status.type}`}>{status.message}</p>
            </form>
          </article>
        </section>
      </main>
    </div>
  );
}

import React from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const initialForm = {
  name: "",
  email: "",
  whatsapp_phone: "",
  company_name: "",
  role_title: "",
  hiring_goals: "",
  preferred_skills: "",
  timezone: "",
  budget_notes: "",
};

function formFromProfile(profile, fallbackUser = null) {
  return {
    name: profile?.name || fallbackUser?.name || "",
    email: profile?.client_email || fallbackUser?.email || "",
    whatsapp_phone: profile?.whatsapp_phone || "",
    company_name: profile?.company_name || "",
    role_title: profile?.role_title || "",
    hiring_goals: profile?.hiring_goals || "",
    preferred_skills: Array.isArray(profile?.preferred_skills) ? profile.preferred_skills.join(", ") : "",
    timezone: profile?.timezone || "",
    budget_notes: profile?.budget_notes || "",
  };
}

export default function ClientProfilePage() {
  const backendBase = import.meta.env.DEV ? "http://127.0.0.1:8000" : "";
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [savedForm, setSavedForm] = useState(initialForm);
  const [authState, setAuthState] = useState({ loading: true, user: null });
  const [profileState, setProfileState] = useState({ loading: true, registered: false, profile: null });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isEditing, setIsEditing] = useState(true);

  useEffect(() => {
    async function loadPage() {
      try {
        const authResponse = await fetch(`${backendBase}/auth/me`, { credentials: "include" });
        if (authResponse.status === 401) {
          window.location.href = `${backendBase}/auth/login?next=/ui/client/profile`;
          return;
        }
        const authData = await authResponse.json();
        if (!authResponse.ok || !authData.authenticated) {
          throw new Error("Unable to load user session.");
        }
        const profileResponse = await fetch(`${backendBase}/clients/me`, { credentials: "include" });
        const profileData = await profileResponse.json();
        const hydratedForm = formFromProfile(profileData.profile, authData.user);
        setForm(hydratedForm);
        setSavedForm(hydratedForm);
        setAuthState({ loading: false, user: authData.user });
        setProfileState({
          loading: false,
          registered: Boolean(profileData.registered),
          profile: profileData.profile || null,
        });
        const hasExistingDetails = Boolean(
          hydratedForm.name ||
            hydratedForm.whatsapp_phone ||
            hydratedForm.company_name ||
            hydratedForm.role_title ||
            hydratedForm.hiring_goals ||
            hydratedForm.preferred_skills ||
            hydratedForm.timezone ||
            hydratedForm.budget_notes
        );
        setIsEditing(!hasExistingDetails);
      } catch (error) {
        setStatus({ type: "warning", message: error.message });
        setAuthState({ loading: false, user: null });
        setProfileState({ loading: false, registered: false, profile: null });
      }
    }

    loadPage();
  }, [backendBase]);

  function onChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function startEditing() {
    setStatus({ type: "", message: "" });
    setIsEditing(true);
  }

  function cancelEditing() {
    setForm(savedForm);
    setStatus({ type: "", message: "" });
    setIsEditing(false);
  }

  async function onSubmit(event) {
    event.preventDefault();
    setStatus({ type: "", message: "Saving client profile..." });
    try {
      const response = await fetch(`${backendBase}/clients/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          whatsapp_phone: form.whatsapp_phone,
          company_name: form.company_name,
          role_title: form.role_title,
          hiring_goals: form.hiring_goals,
          preferred_skills: form.preferred_skills
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          timezone: form.timezone,
          budget_notes: form.budget_notes,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Unable to save client profile.");
      }
      const nextForm = formFromProfile(data.profile, authState.user);
      setForm(nextForm);
      setSavedForm(nextForm);
      setProfileState({ loading: false, registered: true, profile: data.profile || null });
      setIsEditing(false);
      setStatus({ type: "success", message: data.message || "Client profile updated successfully." });
    } catch (error) {
      setStatus({ type: "warning", message: error.message });
    }
  }

  const completionChecks = [
    Boolean(form.name),
    Boolean(form.email),
    Boolean(form.whatsapp_phone),
    Boolean(form.company_name),
    Boolean(form.role_title),
    Boolean(form.hiring_goals),
    Boolean(form.preferred_skills),
    Boolean(form.timezone),
  ];
  const completionPercent = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100);
  const hasExistingDetails = Boolean(
    savedForm.name ||
      savedForm.whatsapp_phone ||
      savedForm.company_name ||
      savedForm.role_title ||
      savedForm.hiring_goals ||
      savedForm.preferred_skills ||
      savedForm.timezone ||
      savedForm.budget_notes
  );
  const missingItems = [
    !form.whatsapp_phone ? "Add your phone or WhatsApp number so freelancers can contact you quickly." : null,
    !form.company_name ? "Add your company or brand name so talent knows who they will be working with." : null,
    !form.role_title ? "Add your role so freelancers understand your hiring context." : null,
    !form.hiring_goals ? "Describe your hiring goals and project scope to attract stronger proposals." : null,
    !form.preferred_skills ? "List preferred skills and tools so your profile attracts relevant talent." : null,
    !form.timezone ? "Add your timezone or overlap expectations to reduce coordination friction." : null,
    !form.budget_notes ? "Mention budget or engagement notes so freelancers can respond with the right level of detail." : null,
  ].filter(Boolean);

  if (authState.loading) {
    return (
      <div className="page">
        <main className="container">
          <article className="panel">
            <h1>Loading client profile...</h1>
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
            <a className="text-link" href={`${backendBase}/auth/logout`}>
              Logout
            </a>
          </div>
        </div>

        <section className="layout-grid">
          <aside className="panel">
            <h2>Create a strong client profile</h2>
            <p className="muted">
              {completionPercent === 100
                ? "Your client profile is complete and ready to attract stronger freelancer responses."
                : `Your client profile is ${completionPercent}% complete. Fill the missing details below to complete it to 100%.`}
            </p>
            <div className="completion-widget">
              <div className="completion-ring" style={{ "--progress": `${completionPercent}%` }} aria-label={`Profile ${completionPercent}% complete`}>
                <div className="completion-ring-inner">
                  <strong>{completionPercent}%</strong>
                </div>
              </div>
            </div>
            {missingItems.length ? (
              <ul className="welcome-tips">
                {missingItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </aside>

          <article className="panel card-shadow">
            <div className="client-home-header">
              <div>
                <h1>Client Profile</h1>
                <p className="muted">
                  {missingItems.length
                    ? `These details are still missing. Fill them to complete your client profile to 100%.`
                    : "Your client profile looks complete and ready to help you hire with confidence."}
                </p>
              </div>
            </div>

            {hasExistingDetails ? (
              <p className="muted profile-form-note">
                {isEditing
                  ? "Update any field below and save when you're ready."
                  : "Your saved client profile is shown below. Use Edit profile when you want to make changes."}
              </p>
            ) : null}

            {hasExistingDetails && !isEditing ? (
              <div className="profile-actions-row">
                <button type="button" className="btn-outline" onClick={startEditing}>
                  Edit profile
                </button>
              </div>
            ) : null}

            <form onSubmit={onSubmit}>
              <label htmlFor="client_profile_name">Your name</label>
              <input id="client_profile_name" name="name" value={form.name} onChange={onChange} disabled={!isEditing} />

              <label htmlFor="client_profile_email">Your email</label>
              <input id="client_profile_email" name="email" value={form.email} disabled />

              <label htmlFor="client_profile_whatsapp">WhatsApp number</label>
              <input id="client_profile_whatsapp" name="whatsapp_phone" value={form.whatsapp_phone} onChange={onChange} disabled={!isEditing} />

              <label htmlFor="client_profile_company">Company / brand name</label>
              <input id="client_profile_company" name="company_name" value={form.company_name} onChange={onChange} disabled={!isEditing} />

              <label htmlFor="client_profile_role">Your role</label>
              <input id="client_profile_role" name="role_title" value={form.role_title} onChange={onChange} disabled={!isEditing} placeholder="Founder, Hiring Manager, Product Lead" />

              <label htmlFor="client_profile_goals">Hiring goals / project focus</label>
              <textarea id="client_profile_goals" name="hiring_goals" value={form.hiring_goals} onChange={onChange} rows={5} disabled={!isEditing} />

              <label htmlFor="client_profile_skills">Preferred skills</label>
              <input id="client_profile_skills" name="preferred_skills" value={form.preferred_skills} onChange={onChange} disabled={!isEditing} placeholder="react, fastapi, aws, figma" />

              <label htmlFor="client_profile_timezone">Preferred timezone</label>
              <input id="client_profile_timezone" name="timezone" value={form.timezone} onChange={onChange} disabled={!isEditing} placeholder="IST, GMT+1, overlap with US mornings" />

              <label htmlFor="client_profile_budget">Budget / engagement notes</label>
              <textarea id="client_profile_budget" name="budget_notes" value={form.budget_notes} onChange={onChange} rows={4} disabled={!isEditing} placeholder="Hourly/fixed, duration, budget range, engagement style" />

              {isEditing ? (
                <div className="form-actions">
                  <button type="submit">Save changes</button>
                  {hasExistingDetails ? (
                    <button type="button" className="btn-cancel" onClick={cancelEditing}>
                      Cancel
                    </button>
                  ) : null}
                </div>
              ) : null}
            </form>

            <p className={`message ${status.type}`}>{status.message}</p>
          </article>
        </section>
      </main>
    </div>
  );
}

import React from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function JobsPage() {
  const apiBase = import.meta.env.DEV ? "http://127.0.0.1:8000" : "";
  const [authState, setAuthState] = useState({ loading: true, user: null });
  const [description, setDescription] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [minExperience, setMinExperience] = useState(0);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientWhatsapp, setClientWhatsapp] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [matches, setMatches] = useState([]);
  const [jobId, setJobId] = useState("");
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [scheduleFor, setScheduleFor] = useState(null);
  const [scheduleSlot, setScheduleSlot] = useState({ start: "", end: "" });

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch(`${apiBase}/auth/me`, { credentials: "include" });
        if (response.status === 401) {
          window.location.href = `${apiBase}/auth/login?next=/ui/jobs`;
          return;
        }
        const data = await response.json();
        if (response.ok && data.authenticated && data.user) {
          setAuthState({ loading: false, user: data.user });
          setClientName(data.user.name || "");
          setClientEmail(data.user.email || "");
        } else {
          window.location.href = `${apiBase}/auth/login?next=/ui/jobs`;
        }
      } catch {
        window.location.href = `${apiBase}/auth/login?next=/ui/jobs`;
      }
    }
    loadSession();
  }, [apiBase]);

  async function onSubmit(event) {
    event.preventDefault();
    setStatus({ type: "", message: "Matching candidates..." });
    setMatches([]);
    setJobId("");

    const payload = {
      description,
      required_skills: requiredSkills
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      min_experience_years: Number(minExperience) || 0,
      client_name: clientName.trim(),
      client_email: clientEmail.trim(),
      client_whatsapp: clientWhatsapp.trim(),
    };

    try {
      const response = await fetch(`${apiBase}/post-job`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Job matching failed.");
      }
      setMatches(data.top_matches || []);
      setJobId(data.job_id || "");
      setWhatsappMessage(data.whatsapp_message || "");
      setStatus({ type: "success", message: `Found ${(data.top_matches || []).length} top matches. Share via WhatsApp or schedule interviews.` });
    } catch (error) {
      setStatus({ type: "warning", message: error.message });
    }
  }

  async function copyWhatsAppMessage() {
    if (!whatsappMessage) return;
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setStatus({ type: "success", message: "Message copied! Paste in WhatsApp to send to clients." });
    } catch {
      setStatus({ type: "warning", message: "Could not copy. Share manually." });
    }
  }

  function openWhatsApp() {
    const text = encodeURIComponent(whatsappMessage);
    const phone = clientWhatsapp.replace(/\D/g, "") || "1234567890";
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  }

  async function makeJobLive() {
    if (!jobId) return;
    try {
      const res = await fetch(`${apiBase}/jobs/${jobId}/live`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_live: true }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: "success", message: "Requirement is now live!" });
      } else throw new Error(data.detail || "Failed");
    } catch (e) {
      setStatus({ type: "warning", message: e.message });
    }
  }

  async function scheduleInterview(match) {
    if (!scheduleSlot.start || !scheduleSlot.end) {
      setStatus({ type: "warning", message: "Pick a slot start and end time." });
      return;
    }
    const slotStart = `2025-03-15T${scheduleSlot.start}:00`;
    const slotEnd = `2025-03-15T${scheduleSlot.end}:00`;
    try {
      const res = await fetch(`${apiBase}/interviews/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          job_id: jobId,
          resume_id: match.resume_id,
          client_email: clientEmail || "client@example.com",
          freelancer_email: match.email || "",
          slot_start: slotStart,
          slot_end: slotEnd,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: "success", message: "Interview scheduled!" });
        setScheduleFor(null);
      } else throw new Error(data.detail || data.message || "Failed");
    } catch (e) {
      setStatus({ type: "warning", message: e.message });
    }
  }

  if (authState.loading) {
    return (
      <div className="page">
        <main className="container">
          <article className="panel">
            <h1>Loading...</h1>
          </article>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <main className="container">
        <div className="brand-row">
          <div className="logo">
            <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
              <span>Freelancing</span>AI
            </Link>
          </div>
          <div className="brand-row-links">
            <Link className="text-link" to="/">
              Home
            </Link>
            <small className="muted">Signed in as {authState.user?.name}</small>
            <a className="text-link" href={`${apiBase}/auth/logout`}>
              Logout
            </a>
          </div>
        </div>

        <article className="panel card-shadow">
          <h1>Post a job and match top freelancers</h1>
          <p className="muted">
            Describe your project and instantly receive ranked recommendations based on semantic fit, required skills,
            and experience.
          </p>

          <form onSubmit={onSubmit}>
            <label htmlFor="client_name">Your name</label>
            <input id="client_name" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" />

            <label htmlFor="client_email">Your email</label>
            <input id="client_email" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="you@company.com" />

            <label htmlFor="client_whatsapp">WhatsApp number (to receive match notifications)</label>
            <input id="client_whatsapp" value={clientWhatsapp} onChange={(e) => setClientWhatsapp(e.target.value)} placeholder="+1234567890" />

            <label htmlFor="description">Job description</label>
            <textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              minLength={10}
              required
            />

            <label htmlFor="required-skills">Required skills (comma-separated)</label>
            <input
              id="required-skills"
              value={requiredSkills}
              onChange={(event) => setRequiredSkills(event.target.value)}
              placeholder="react, node, aws"
            />

            <label htmlFor="min-experience">Minimum experience years</label>
            <input
              id="min-experience"
              type="number"
              min={0}
              value={minExperience}
              onChange={(event) => setMinExperience(event.target.value)}
            />

            <button type="submit">Find Best Freelancers</button>
            <p className={`message ${status.type}`}>{status.message}</p>
          </form>

          {matches.length > 0 && (
            <>
              <div className="match-actions">
                {whatsappMessage && (
                  <>
                    <button type="button" className="btn-outline" onClick={copyWhatsAppMessage}>
                      📋 Copy WhatsApp message
                    </button>
                    <button type="button" className="btn-outline" onClick={openWhatsApp}>
                      💬 Open WhatsApp
                    </button>
                  </>
                )}
                {jobId && (
                  <button type="button" className="btn-primary" onClick={makeJobLive}>
                    ✅ Make requirement live
                  </button>
                )}
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Headline</th>
                      <th>Match %</th>
                      <th>Experience</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((item) => (
                      <tr key={item.resume_id}>
                        <td>{item.name}</td>
                        <td>{item.headline}</td>
                        <td><strong>{item.match_percentage ?? Math.round((item.final_score || 0) * 100)}%</strong></td>
                        <td>{item.experience_years}+ yrs</td>
                        <td>
                          <button
                            type="button"
                            className="btn-schedule"
                            onClick={() => setScheduleFor(scheduleFor?.resume_id === item.resume_id ? null : item)}
                          >
                            Schedule interview
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {scheduleFor && (
                <div className="schedule-panel">
                  <h3>Schedule interview with {scheduleFor.name}</h3>
                  <p className="muted">Pick a slot (use one of their availability slots if listed):</p>
                  {(scheduleFor.availability_slots || []).length > 0 && (
                    <ul>
                      {(scheduleFor.availability_slots || []).map((s, i) => (
                        <li key={i}>{s.day} {s.start}–{s.end}</li>
                      ))}
                    </ul>
                  )}
                  <div className="slot-row">
                    <input type="time" value={scheduleSlot.start} onChange={(e) => setScheduleSlot((s) => ({ ...s, start: e.target.value }))} />
                    <input type="time" value={scheduleSlot.end} onChange={(e) => setScheduleSlot((s) => ({ ...s, end: e.target.value }))} />
                    <button type="button" onClick={() => scheduleInterview(scheduleFor)}>Confirm</button>
                    <button type="button" className="btn-cancel" onClick={() => setScheduleFor(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </>
          )}
        </article>
      </main>
    </div>
  );
}

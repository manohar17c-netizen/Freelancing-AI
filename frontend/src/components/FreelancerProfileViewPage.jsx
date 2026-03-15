import React from "react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

export default function FreelancerProfileViewPage() {
  const backendBase = import.meta.env.DEV ? "http://127.0.0.1:8000" : "";
  const { resumeId } = useParams();
  const [state, setState] = useState({ loading: true, profile: null, error: "" });

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch(`${backendBase}/freelancers/${resumeId}`, { credentials: "include" });
        if (response.status === 401) {
          window.location.href = `${backendBase}/auth/login?next=/ui/jobs`;
          return;
        }
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || "Unable to load freelancer profile.");
        }
        setState({ loading: false, profile: data.profile || null, error: "" });
      } catch (error) {
        setState({ loading: false, profile: null, error: error.message });
      }
    }
    loadProfile();
  }, [backendBase, resumeId]);

  if (state.loading) {
    return (
      <div className="page">
        <main className="container">
          <article className="panel">
            <h1>Loading freelancer profile...</h1>
          </article>
        </main>
      </div>
    );
  }

  const profile = state.profile;

  return (
    <div className="page">
      <main className="container">
        <div className="topbar">
          <div className="logo">
            <Link to="/jobs" style={{ textDecoration: "none", color: "inherit" }}>
              <span>Freelancing</span>AI
            </Link>
          </div>
        </div>

        <section className="layout-grid">
          <aside className="panel">
            <h2>Freelancer profile</h2>
            <p className="muted">Review the freelancer details before you accept or reject the request.</p>
            {profile ? (
              <ul>
                <li>Resume ID: {profile.resume_id}</li>
                <li>Email: {profile.email || "Not shared"}</li>
                <li>WhatsApp: {profile.whatsapp_phone || "Not added"}</li>
              </ul>
            ) : null}
          </aside>

          <article className="panel card-shadow">
            {state.error ? <p className="warning">{state.error}</p> : null}
            {profile ? (
              <>
                <h1>{profile.name || "Freelancer"}</h1>
                <p className="muted">{profile.headline || "Freelancer"}</p>
                <div className="job-meta-row">
                  <span className="job-meta">
                    <b>Experience</b>: {profile.experience_years || 0}y {profile.experience_months || 0}m
                  </span>
                  <span className="job-meta">
                    <b>Resume ID</b>: {profile.resume_id}
                  </span>
                </div>
                <p className="muted">{profile.bio || "No bio added yet."}</p>
                {(profile.skills || []).length ? (
                  <div className="job-skills">
                    {profile.skills.map((skill) => (
                      <span key={skill} className="skill-chip">
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : null}
                {(profile.availability_slots || []).length ? (
                  <div className="slots-list">
                    {profile.availability_slots.map((slot, index) => (
                      <div key={`${slot.date}-${slot.start}-${index}`} className="slot-chip">
                        {slot.date} {slot.start}-{slot.end}
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </article>
        </section>
      </main>
    </div>
  );
}

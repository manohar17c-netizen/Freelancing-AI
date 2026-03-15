import React from "react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const TAB_CONTENT = {
  "Find Jobs": [
    "AI-ranked jobs based on your skills and experience.",
    "Smart filters: budget, duration, timezone, and contract type.",
    "One-click proposal templates tuned to each job.",
  ],
  Upskill: [
    "Skill-gap analysis between your profile and top-paying jobs.",
    "Suggested learning tracks (FastAPI, AWS, System Design, React).",
    "Weekly learning goals with completion tracking.",
  ],
  "My Proposals": [
    "Track sent proposals, replies, and interview stages.",
    "A/B test proposal intros and monitor conversion rate.",
    "Follow-up reminders for pending client responses.",
  ],
  "Profile Health": [
    "Profile completeness score with actionable fixes.",
    "Headline and bio recommendations to improve ranking.",
    "Resume quality signals and keyword coverage.",
  ],
  Earnings: [
    "Revenue dashboard by month, client, and project type.",
    "Estimate hourly realization vs quoted rates.",
    "Tax and invoice readiness checklist.",
  ],
};

export default function FreelancerHome() {
  const apiBase = import.meta.env.DEV ? "http://127.0.0.1:8000" : "";
  const [activeTab, setActiveTab] = useState("Find Jobs");
  const [authState, setAuthState] = useState({ loading: true, user: null });

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch(`${apiBase}/auth/me`, { credentials: "include" });
        if (response.status === 401) {
          window.location.href = `${apiBase}/auth/login?next=/ui/freelancer/home`;
          return;
        }
        const data = await response.json();
        if (response.ok && data.authenticated && data.user) {
          setAuthState({ loading: false, user: data.user });
        } else {
          window.location.href = `${apiBase}/auth/login?next=/ui/freelancer/home`;
        }
      } catch {
        window.location.href = `${apiBase}/auth/login?next=/ui/freelancer/home`;
      }
    }
    loadSession();
  }, [apiBase]);

  if (authState.loading) {
    return (
      <div className="page">
        <main className="container">
          <article className="panel">
            <h1>Loading...</h1>
            <p className="muted">Checking your session...</p>
          </article>
        </main>
      </div>
    );
  }

  const user = authState.user;
  const initials = user?.name
    ? user.name
        .trim()
        .split(/\s+/)
        .map((s) => s[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div className="page">
      <main className="container">
        <div className="topbar">
          <div className="logo">
            <span>Freelancing</span>AI
          </div>
          <div className="topbar-actions user-profile-row">
            {user?.picture ? (
              <img src={user.picture} alt="" className="user-avatar" />
            ) : (
              <div className="user-avatar user-avatar-initials" aria-hidden="true">
                {initials}
              </div>
            )}
            <div className="user-profile-block">
              <span className="user-name">{user?.name || "Freelancer"}</span>
              <span className="user-email muted">{user?.email}</span>
              <div className="user-links">
                <Link className="text-link" to="/resume">
                  My profile
                </Link>
                <a className="text-link" href={`${apiBase}/auth/logout`}>
                  Logout
                </a>
              </div>
            </div>
          </div>
        </div>

        <section className="panel card-shadow user-badge-panel">
          <p className="muted">
            You’re logged in as <strong>{user?.name}</strong>. Update your{" "}
            <Link className="text-link" to="/resume">
              profile
            </Link>{" "}
            to get better job matches.
          </p>
        </section>

        <section className="panel card-shadow">
          <h1>Freelancer Home</h1>
          <p className="muted">Your post-registration workspace. Start with jobs, then optimize growth.</p>

          <div className="tabs-row">
            {Object.keys(TAB_CONTENT).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`tab-btn ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <article className="panel tab-content">
            <h2>{activeTab}</h2>
            <ul>
              {TAB_CONTENT[activeTab].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </section>
      </main>
    </div>
  );
}

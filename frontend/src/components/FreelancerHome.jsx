import React from "react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const TAB_CONTENT = {
  "Find Jobs": [],
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
  const [jobsState, setJobsState] = useState({ loading: false, registered: true, jobs: [], error: "" });
  const [jobQuery, setJobQuery] = useState("");

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

  useEffect(() => {
    if (authState.loading) return;
    if (!authState.user) return;

    async function loadRecommendedJobs() {
      setJobsState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const url = new URL(`${apiBase}/jobs/recommended`);
        if (jobQuery.trim()) url.searchParams.set("q", jobQuery.trim());
        const response = await fetch(url.toString(), { credentials: "include" });
        if (response.status === 401) {
          window.location.href = `${apiBase}/auth/login?next=/ui/freelancer/home`;
          return;
        }
        const data = await response.json();
        if (!response.ok) {
          setJobsState({ loading: false, registered: true, jobs: [], error: data?.detail || "Unable to load jobs." });
          return;
        }
        setJobsState({ loading: false, registered: Boolean(data.registered), jobs: data.jobs || [], error: "" });
      } catch {
        setJobsState({ loading: false, registered: true, jobs: [], error: "Network error while loading jobs." });
      }
    }

    // Only load when Find Jobs tab is active (and query changes).
    if (activeTab === "Find Jobs") loadRecommendedJobs();
  }, [apiBase, activeTab, authState.loading, authState.user, jobQuery]);

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
            {activeTab === "Find Jobs" ? (
              <div>
                <div className="jobs-toolbar">
                  <div className="jobs-search">
                    <label htmlFor="jobSearch">Search jobs</label>
                    <input
                      id="jobSearch"
                      value={jobQuery}
                      onChange={(e) => setJobQuery(e.target.value)}
                      placeholder="Search by keyword or required skill (e.g., React, FastAPI)"
                    />
                  </div>
                </div>

                {!jobsState.registered ? (
                  <div className="warning">
                    Complete your profile first to get personalized recommendations.{" "}
                    <Link className="text-link" to="/resume">
                      Create profile
                    </Link>
                    .
                  </div>
                ) : null}

                {jobsState.error ? <div className="warning">{jobsState.error}</div> : null}
                {jobsState.loading ? <p className="muted">Loading recommended jobs...</p> : null}

                {!jobsState.loading && jobsState.jobs?.length === 0 ? (
                  <p className="muted">No live jobs found yet. Ask a client to post a job and make it live.</p>
                ) : null}

                <div className="jobs-list">
                  {(jobsState.jobs || []).map((job) => (
                    <article key={job.job_id} className="job-card">
                      <div className="job-card-top">
                        <div>
                          <div className="job-title-row">
                            <span className="job-title">Job {job.job_id}</span>
                            <span className="job-match-pill">{job.match_percentage}% match</span>
                          </div>
                          <p className="muted job-desc">{job.description}</p>
                        </div>
                      </div>

                      <div className="job-meta-row">
                        <span className="job-meta">
                          <b>Client</b>: {job.client_name || "Client"}
                        </span>
                        <span className="job-meta">
                          <b>Min exp</b>: {job.min_experience_years || 0}+ yrs
                        </span>
                      </div>

                      {Array.isArray(job.required_skills) && job.required_skills.length ? (
                        <div className="job-skills">
                          {job.required_skills.slice(0, 10).map((s) => (
                            <span key={s} className="skill-chip">
                              {s}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="muted">No required skills provided for this job.</p>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <ul>
                {TAB_CONTENT[activeTab].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </article>
        </section>
      </main>
    </div>
  );
}

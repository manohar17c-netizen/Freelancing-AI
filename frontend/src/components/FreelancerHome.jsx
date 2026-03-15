import React from "react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const TAB_CONTENT = {
  "Find Jobs": [],
  Upskill: [],
  "My Proposals": [],
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

function normalizeSkill(value) {
  return String(value || "").trim().toLowerCase();
}

export default function FreelancerHome() {
  const apiBase = import.meta.env.DEV ? "http://127.0.0.1:8000" : "";
  const buildApiUrl = (path) => new URL(path, apiBase || window.location.origin);
  const [activeTab, setActiveTab] = useState("Find Jobs");
  const [authState, setAuthState] = useState({ loading: true, user: null });
  const [jobsState, setJobsState] = useState({ loading: false, registered: true, jobs: [], error: "" });
  const [profileState, setProfileState] = useState({ loading: true, registered: false, profile: null });
  const [proposalsState, setProposalsState] = useState({ loading: false, items: [], error: "" });
  const [jobQuery, setJobQuery] = useState("");
  const [learningSearch, setLearningSearch] = useState("");

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

    async function loadProfile() {
      try {
        const response = await fetch(`${apiBase}/freelancers/me`, { credentials: "include" });
        if (response.status === 401) {
          window.location.href = `${apiBase}/auth/login?next=/ui/freelancer/home`;
          return;
        }
        const data = await response.json();
        if (response.ok && data.registered && data.profile) {
          setProfileState({ loading: false, registered: true, profile: data.profile });
        } else {
          setProfileState({ loading: false, registered: false, profile: null });
        }
      } catch {
        setProfileState({ loading: false, registered: false, profile: null });
      }
    }

    loadProfile();
  }, [apiBase, authState.loading, authState.user]);

  useEffect(() => {
    if (authState.loading) return;
    if (!authState.user) return;

    async function loadRecommendedJobs() {
      setJobsState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const url = buildApiUrl("/jobs/recommended");
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

    // Upskill also depends on the live recommendations dataset.
    if (activeTab === "Find Jobs" || activeTab === "Upskill") loadRecommendedJobs();
  }, [apiBase, activeTab, authState.loading, authState.user, jobQuery]);

  useEffect(() => {
    if (authState.loading) return;
    if (!authState.user) return;
    if (activeTab !== "My Proposals") return;

    async function loadMyProposals() {
      setProposalsState({ loading: true, items: [], error: "" });
      try {
        const response = await fetch(`${apiBase}/applications/me`, { credentials: "include" });
        if (response.status === 401) {
          window.location.href = `${apiBase}/auth/login?next=/ui/freelancer/home`;
          return;
        }
        const data = await response.json();
        if (!response.ok) {
          setProposalsState({ loading: false, items: [], error: data?.detail || "Unable to load proposals." });
          return;
        }
        setProposalsState({ loading: false, items: data.applications || [], error: "" });
      } catch {
        setProposalsState({ loading: false, items: [], error: "Network error while loading proposals." });
      }
    }

    loadMyProposals();
  }, [activeTab, apiBase, authState.loading, authState.user]);

  const user = authState.user;
  const profile = profileState.profile;
  const initials = user?.name
    ? user.name
        .trim()
        .split(/\s+/)
        .map((s) => s[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";
  const completionChecks = [
    Boolean(profile?.name),
    Boolean(profile?.email),
    Boolean(profile?.headline),
    Boolean(profile?.bio),
    Boolean((profile?.skills || []).length),
    Boolean(profile?.whatsapp_phone),
    Boolean((profile?.availability_slots || []).length),
    Boolean((profile?.experience_years || 0) > 0 || (profile?.experience_months || 0) > 0),
  ];
  const completionPercent = Math.round(
    (completionChecks.filter(Boolean).length / completionChecks.length) * 100
  );
  const completionLabel = profileState.registered ? `${completionPercent}% complete` : "0% complete";
  const profileActionLabel = profileState.registered ? "Edit profile" : "Add details";
  const progressStyle = { "--progress": `${profileState.registered ? completionPercent : 0}%` };
  const completionTips = [
    !profile?.headline ? "Add a strong headline so clients instantly understand your role." : null,
    !profile?.bio ? "Write a short bio that shows your experience, niche, and results." : null,
    !(profile?.skills || []).length ? "Add key skills to appear in more relevant searches." : null,
    !profile?.whatsapp_phone ? "Add your WhatsApp number so clients can contact you faster." : null,
    !(profile?.availability_slots || []).length ? "Add availability slots so interviews can be booked quickly." : null,
    !((profile?.experience_years || 0) > 0 || (profile?.experience_months || 0) > 0)
      ? "Add your experience to build trust and improve matching."
      : null,
  ].filter(Boolean);
  const completionMessage = profileState.loading
    ? "Checking your saved profile details."
    : profileState.registered
      ? completionPercent === 100
        ? "Your profile is fully complete and ready to attract stronger client responses."
        : `Your profile is currently ${completionLabel}. Complete it to 100% to improve trust, visibility, and response rate from clients.`
      : "Set up your freelancer profile to start getting matched with the right opportunities.";
  const welcomeMessage = profileState.loading
    ? `Hi ${user?.name || "Freelancer"}, welcome.`
    : completionPercent === 100
      ? `Hi ${user?.name || "Freelancer"}, your profile is in great shape and ready to win attention.`
      : `Hi ${user?.name || "Freelancer"}, let’s make your profile stand out and bring in more replies.`;
  const profileSkills = new Set((profile?.skills || []).map(normalizeSkill).filter(Boolean));
  const missingSkillCounts = (jobsState.jobs || []).reduce((acc, job) => {
    for (const rawSkill of job.required_skills || []) {
      const skill = normalizeSkill(rawSkill);
      if (!skill || profileSkills.has(skill)) continue;
      acc[skill] = (acc[skill] || 0) + 1;
    }
    return acc;
  }, {});
  const topMissingSkills = Object.entries(missingSkillCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  function openYouTubeSearch(skill) {
    const query = String(skill || "").trim();
    if (!query) return;
    const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${query} tutorial`)}`;
    window.open(youtubeUrl, "_blank", "noopener,noreferrer");
  }

  async function applyToJob(job) {
    try {
      const response = await fetch(`${apiBase}/jobs/${job.job_id}/apply`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Could not apply to this job.");
      }
      setJobsState((prev) => ({
        ...prev,
        jobs: (prev.jobs || []).map((item) =>
          item.job_id === job.job_id ? { ...item, has_applied: true } : item
        ),
      }));
      setActiveTab("My Proposals");
    } catch (error) {
      setJobsState((prev) => ({ ...prev, error: error.message }));
    }
  }

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

  return (
    <div className="page">
      <main className="container">
        <div className="topbar">
          <div className="logo">
            <span>Freelancing</span>AI
          </div>
          <div className="topbar-actions user-profile-row">
            <div className="user-menu" tabIndex={0}>
              {user?.picture ? (
                <img src={user.picture} alt={`${user?.name || "Freelancer"} profile`} className="user-avatar" />
              ) : (
                <div className="user-avatar user-avatar-initials" aria-hidden="true">
                  {initials}
                </div>
              )}
              <div className="user-menu-dropdown">
                <Link className="text-link" to="/resume">
                  Profile
                </Link>
                <a className="text-link" href={`${apiBase}/auth/logout`}>
                  Logout
                </a>
              </div>
            </div>
            <div className="user-profile-block">
              <span className="user-name">{user?.name || "Freelancer"}</span>
              <span className="user-email muted">{user?.email}</span>
            </div>
          </div>
        </div>

        <section className="panel card-shadow user-badge-panel">
          <div className="welcome-panel">
            <div>
              <h2>{welcomeMessage}</h2>
              <p className="muted">{completionMessage}</p>
              {!profileState.loading && completionTips.length > 0 ? (
                <ul className="welcome-tips">
                  {completionTips.slice(0, 3).map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="completion-widget">
              <div className="completion-ring" style={progressStyle} aria-label={`Profile ${completionLabel}`}>
                <div className="completion-ring-inner">
                  <strong>{profileState.registered ? completionPercent : 0}%</strong>
                </div>
              </div>
              <Link className="btn-outline completion-action" to="/resume">
                {profileActionLabel}
              </Link>
            </div>
          </div>
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
                      <div className="job-card-actions">
                        <button
                          type="button"
                          className="btn-outline"
                          onClick={() => applyToJob(job)}
                          disabled={Boolean(job.has_applied)}
                        >
                          {job.has_applied ? "Applied" : "Apply"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : activeTab === "Upskill" ? (
              <div className="upskill-grid">
                <section className="upskill-card">
                  <h3>Learn on YouTube</h3>
                  <p className="muted">
                    Search any skill you want to improve and jump straight to YouTube tutorials in one click.
                  </p>
                  <div className="youtube-search-row">
                    <input
                      value={learningSearch}
                      onChange={(e) => setLearningSearch(e.target.value)}
                      placeholder="Search a skill like React, AWS, FastAPI"
                    />
                    <button
                      type="button"
                      className="btn-outline youtube-search-btn"
                      onClick={() => openYouTubeSearch(learningSearch)}
                      disabled={!learningSearch.trim()}
                    >
                      Search on YouTube
                    </button>
                  </div>
                </section>

                <section className="upskill-card">
                  <h3>Suggested learning skills</h3>
                  <p className="muted">
                    Click any skill clients are asking for but missing from your profile, and we’ll open YouTube
                    tutorials for it.
                  </p>
                  {jobsState.loading ? <p className="muted">Analyzing client requirements...</p> : null}
                  {!jobsState.loading && topMissingSkills.length > 0 ? (
                    <div className="upskill-list">
                      {topMissingSkills.map(([skill, count]) => (
                        <button
                          key={skill}
                          type="button"
                          className="upskill-link-card"
                          onClick={() => openYouTubeSearch(skill)}
                        >
                          <strong>{skill}</strong>
                          <p className="muted">
                            Requested in {count} client job{count > 1 ? "s" : ""}, but missing from your profile.
                          </p>
                          <span className="skill-gap-pill">Open on YouTube</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {!jobsState.loading && topMissingSkills.length === 0 ? (
                    <p className="muted">
                      Your current skills already cover the visible client requirements well. Keep polishing your
                      profile and go deeper in one specialized area to stand out more.
                    </p>
                  ) : null}
                </section>
              </div>
            ) : activeTab === "My Proposals" ? (
              <div>
                {proposalsState.loading ? <p className="muted">Loading your proposals...</p> : null}
                {proposalsState.error ? <p className="warning">{proposalsState.error}</p> : null}
                {!proposalsState.loading && proposalsState.items.length === 0 ? (
                  <p className="muted">You have not applied to any jobs yet. Apply from Find Jobs to see them here.</p>
                ) : null}
                <div className="jobs-list proposals-list">
                  {proposalsState.items.map((proposal) => (
                    <article key={proposal.application_id} className="job-card proposal-card">
                      <div className="job-title-row">
                        <span className="job-title">{proposal.client_name || "Client"} request</span>
                        <span className={`proposal-status proposal-status-${proposal.status}`}>{proposal.status}</span>
                      </div>
                      <p className="muted job-desc">{proposal.job_description || "Job description unavailable."}</p>
                      <div className="job-meta-row">
                        <span className="job-meta">
                          <b>Match</b>: {proposal.skill_match_percent || 0}%
                        </span>
                        <span className="job-meta">
                          <b>Required</b>: {(proposal.required_skills || []).length}
                        </span>
                      </div>
                      {(proposal.matched_skills || []).length ? (
                        <div className="job-skills">
                          {proposal.matched_skills.map((skill) => (
                            <span key={skill} className="skill-chip">
                              {skill}
                            </span>
                          ))}
                        </div>
                      ) : null}
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

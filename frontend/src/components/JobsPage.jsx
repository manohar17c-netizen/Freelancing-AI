import React from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function JobsPage() {
  const apiBase = import.meta.env.DEV ? "http://127.0.0.1:8000" : "";
  const buildApiUrl = (path) => new URL(path, apiBase || window.location.origin);
  const [authState, setAuthState] = useState({ loading: true, user: null });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [activeTab, setActiveTab] = useState("Search Freelancers");

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientWhatsapp, setClientWhatsapp] = useState("");
  const [description, setDescription] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [minExperience, setMinExperience] = useState(0);

  const [jobsState, setJobsState] = useState({ loading: true, items: [], error: "" });
  const [requestsState, setRequestsState] = useState({ loading: false, items: [], error: "" });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const [debouncedJobSearch, setDebouncedJobSearch] = useState("");
  const [initialJobsLoaded, setInitialJobsLoaded] = useState(false);
  const [requirementsRefreshing, setRequirementsRefreshing] = useState(false);
  const [hasSavedRequirements, setHasSavedRequirements] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [editForm, setEditForm] = useState({
    description: "",
    requiredSkills: "",
    minExperience: 0,
  });

  const [freelancerFilters, setFreelancerFilters] = useState({
    q: "",
    name: "",
    skill: "",
    minExperience: "",
  });
  const [freelancersState, setFreelancersState] = useState({ loading: false, items: [], error: "" });
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
  const dashboardTabs = [
    "Search Freelancers",
    "My Requirements",
    `Received Requests${requestsState.items.length ? ` (${requestsState.items.length})` : ""}`,
  ];

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedJobSearch(jobSearch.trim());
    }, 250);
    return () => window.clearTimeout(handle);
  }, [jobSearch]);

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

  useEffect(() => {
    if (authState.loading || !authState.user) return;

    async function loadMyJobs() {
      if (initialJobsLoaded) {
        setRequirementsRefreshing(true);
        setJobsState((prev) => ({ ...prev, error: "" }));
      } else {
        setJobsState((prev) => ({ ...prev, loading: true, error: "" }));
      }
      try {
        const url = buildApiUrl("/jobs/mine");
        if (debouncedJobSearch) {
          url.searchParams.set("q", debouncedJobSearch);
        }
        const response = await fetch(url.toString(), { credentials: "include" });
        if (response.status === 401) {
          window.location.href = `${apiBase}/auth/login?next=/ui/jobs`;
          return;
        }
        const data = await response.json();
        if (!response.ok) {
          setJobsState({ loading: false, items: [], error: data?.detail || "Unable to load requirements." });
          return;
        }
        const items = data.jobs || [];
        setJobsState({ loading: false, items, error: "" });
        if (!clientWhatsapp && items[0]?.client_whatsapp) {
          setClientWhatsapp(items[0].client_whatsapp);
        }
        if (!debouncedJobSearch) {
          setHasSavedRequirements(items.length > 0);
          setShowCreateForm(items.length === 0);
        }
        setInitialJobsLoaded(true);
        setRequirementsRefreshing(false);
      } catch {
        setJobsState((prev) => ({
          loading: false,
          items: initialJobsLoaded ? prev.items : [],
          error: "Network error while loading requirements.",
        }));
        setInitialJobsLoaded(true);
        setRequirementsRefreshing(false);
      }
    }

    loadMyJobs();
  }, [apiBase, authState.loading, authState.user, debouncedJobSearch, initialJobsLoaded]);

  useEffect(() => {
    if (authState.loading || !authState.user) return;
    if (jobsState.items.length === 0) return;

    async function loadReceivedRequests() {
      setRequestsState({ loading: true, items: [], error: "" });
      try {
        const response = await fetch(`${apiBase}/applications/received`, { credentials: "include" });
        if (response.status === 401) {
          window.location.href = `${apiBase}/auth/login?next=/ui/jobs`;
          return;
        }
        const data = await response.json();
        if (!response.ok) {
          setRequestsState({ loading: false, items: [], error: data?.detail || "Unable to load received requests." });
          return;
        }
        setRequestsState({ loading: false, items: data.applications || [], error: "" });
      } catch {
        setRequestsState({ loading: false, items: [], error: "Network error while loading received requests." });
      }
    }

    loadReceivedRequests();
  }, [apiBase, authState.loading, authState.user, jobsState.items.length]);

  useEffect(() => {
    if (authState.loading || !authState.user) return;
    if (jobsState.items.length === 0) return;
    if (activeTab !== "Search Freelancers") return;

    async function loadFreelancers() {
      setFreelancersState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const url = buildApiUrl("/freelancers");
        url.searchParams.set("limit", "200");
        if (freelancerFilters.q.trim()) url.searchParams.set("q", freelancerFilters.q.trim());
        if (freelancerFilters.name.trim()) url.searchParams.set("name", freelancerFilters.name.trim());
        if (freelancerFilters.skill.trim()) url.searchParams.set("skill", freelancerFilters.skill.trim());
        if (String(freelancerFilters.minExperience).trim()) {
          url.searchParams.set("min_experience", String(freelancerFilters.minExperience).trim());
        }
        const response = await fetch(url.toString(), { credentials: "include" });
        const data = await response.json();
        if (!response.ok) {
          setFreelancersState({ loading: false, items: [], error: data?.detail || "Unable to load freelancers." });
          return;
        }
        setFreelancersState({ loading: false, items: data.freelancers || [], error: "" });
      } catch {
        setFreelancersState({ loading: false, items: [], error: "Network error while loading freelancers." });
      }
    }

    loadFreelancers();
  }, [activeTab, apiBase, authState.loading, authState.user, freelancerFilters, jobsState.items.length]);

  async function refreshJobs() {
    const response = await fetch(`${apiBase}/jobs/mine`, { credentials: "include" });
    const data = await response.json();
    if (response.ok) {
      const items = data.jobs || [];
      setJobsState({ loading: false, items, error: "" });
      setShowCreateForm(items.length === 0);
      setHasSavedRequirements(items.length > 0);
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    setStatus({ type: "", message: "Saving requirement..." });

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
        throw new Error(data.detail || "Requirement creation failed.");
      }
      setStatus({ type: "success", message: "Requirement saved. You can activate it from My Requirements." });
      setDescription("");
      setRequiredSkills("");
      setMinExperience(0);
      setJobSearch("");
      await refreshJobs();
      setShowCreateForm(false);
      setActiveTab("My Requirements");
    } catch (error) {
      setStatus({ type: "warning", message: error.message });
    }
  }

  async function toggleJobLive(jobId, nextLive) {
    try {
      const response = await fetch(`${apiBase}/jobs/${jobId}/live`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_live: nextLive }),
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Could not update requirement status.");
      }
      setJobsState((prev) => ({
        ...prev,
        items: prev.items.map((item) => (item.job_id === jobId ? { ...item, is_live: nextLive } : item)),
      }));
    } catch (error) {
      setStatus({ type: "warning", message: error.message });
    }
  }

  async function removeJob(jobId) {
    try {
      const response = await fetch(`${apiBase}/jobs/${jobId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Could not delete requirement.");
      }
      setStatus({ type: "success", message: "Requirement deleted." });
      await refreshJobs();
    } catch (error) {
      setStatus({ type: "warning", message: error.message });
    }
  }

  async function updateRequestStatus(applicationId, statusValue) {
    try {
      const response = await fetch(`${apiBase}/applications/${applicationId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: statusValue }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Could not update request.");
      }
      setRequestsState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.application_id === applicationId ? { ...item, status: statusValue } : item
        ),
      }));
    } catch (error) {
      setStatus({ type: "warning", message: error.message });
    }
  }

  function startEditingJob(job) {
    setEditingJob(job);
    setEditForm({
      description: job.description || "",
      requiredSkills: Array.isArray(job.required_skills) ? job.required_skills.join(", ") : "",
      minExperience: job.min_experience_years || 0,
    });
  }

  function closeEditJob() {
    setEditingJob(null);
    setEditForm({ description: "", requiredSkills: "", minExperience: 0 });
  }

  async function saveEditedJob(event) {
    event.preventDefault();
    if (!editingJob) return;
    try {
      const response = await fetch(`${apiBase}/jobs/${editingJob.job_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          description: editForm.description,
          required_skills: editForm.requiredSkills
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          min_experience_years: Number(editForm.minExperience) || 0,
          client_name: clientName.trim(),
          client_email: clientEmail.trim(),
          client_whatsapp: clientWhatsapp.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Could not update requirement.");
      }
      setStatus({ type: "success", message: "Requirement updated." });
      await refreshJobs();
      closeEditJob();
    } catch (error) {
      setStatus({ type: "warning", message: error.message });
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

  if (!initialJobsLoaded && jobsState.loading) {
    return (
      <div className="page">
        <main className="container">
          <article className="panel">
            <h1>Loading client home...</h1>
            <p className="muted">Checking your existing requirements.</p>
          </article>
        </main>
      </div>
    );
  }

  const hasPostedRequirements = hasSavedRequirements || jobsState.items.length > 0;
  const showOnboarding = !hasPostedRequirements && !jobsState.error;

  return (
    <div className="page">
      <main className="container">
        <div className="brand-row">
          <div className="logo">
            <Link to="/jobs" style={{ textDecoration: "none", color: "inherit" }}>
              <span>Freelancing</span>AI
            </Link>
          </div>
          <div className="topbar-actions user-profile-row">
            <div className="user-menu" tabIndex={0}>
              {user?.picture ? (
                <img src={user.picture} alt={`${user?.name || "Client"} profile`} className="user-avatar" />
              ) : (
                <div className="user-avatar user-avatar-initials" aria-hidden="true">
                  {initials}
                </div>
              )}
              <div className="user-menu-dropdown">
                <Link className="text-link" to="/client/profile">
                  Profile
                </Link>
                <a className="text-link" href={`${apiBase}/auth/logout`}>
                  Logout
                </a>
              </div>
            </div>
            <div className="user-profile-block">
              <span className="user-name">{user?.name || "Client"}</span>
              <span className="user-email muted">{user?.email}</span>
            </div>
          </div>
        </div>

        <article className="panel card-shadow">
          <div className="client-home-header">
            <div>
              <h1>{showOnboarding ? "Tell us about your project" : "Home page"}</h1>
              <p className="muted">
                {showOnboarding
                  ? "Fill in your details and the requirement you need so we can set up your first hiring request."
                  : `Welcome ${user?.name || "back"} to your homepage. Search freelancers across the database or manage your active and inactive requirements.`}
              </p>
            </div>
          </div>

          {showOnboarding ? (
            <form onSubmit={onSubmit}>
              <label htmlFor="client_name">Your name</label>
              <input id="client_name" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" />

              <label htmlFor="client_email">Your email</label>
              <input id="client_email" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="you@company.com" />

              <label htmlFor="client_whatsapp">WhatsApp number</label>
              <input id="client_whatsapp" value={clientWhatsapp} onChange={(e) => setClientWhatsapp(e.target.value)} placeholder="+1234567890" />

              <label htmlFor="description">Project / requirement details</label>
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                minLength={10}
                placeholder="Describe the project, the role, outcomes, timeline, and what kind of freelancer you need."
                required
              />

              <label htmlFor="required-skills">Required skills (comma-separated)</label>
              <input
                id="required-skills"
                value={requiredSkills}
                onChange={(event) => setRequiredSkills(event.target.value)}
                placeholder="react, typescript, node, aws"
              />

              <label htmlFor="min-experience">Minimum experience years</label>
              <input
                id="min-experience"
                type="number"
                min={0}
                value={minExperience}
                onChange={(event) => setMinExperience(event.target.value)}
              />

              <button type="submit">Create first requirement</button>
            </form>
          ) : (
            <div>
              {editingJob ? (
                <div className="modal-backdrop" onClick={closeEditJob}>
                  <div className="modal-card" onClick={(event) => event.stopPropagation()}>
                    <div className="job-title-row">
                      <h2>Edit requirement</h2>
                      <button type="button" className="btn-cancel" onClick={closeEditJob}>
                        Close
                      </button>
                    </div>
                    <p className="muted">Requirement ID: {editingJob.job_id}</p>
                    <form onSubmit={saveEditedJob}>
                      <label htmlFor="edit_job_description">Project / requirement details</label>
                      <textarea
                        id="edit_job_description"
                        value={editForm.description}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                        rows={5}
                        required
                      />

                      <label htmlFor="edit_job_skills">Required skills</label>
                      <input
                        id="edit_job_skills"
                        value={editForm.requiredSkills}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, requiredSkills: e.target.value }))}
                        placeholder="react, fastapi, aws"
                      />

                      <label htmlFor="edit_job_experience">Minimum experience years</label>
                      <input
                        id="edit_job_experience"
                        type="number"
                        min={0}
                        value={editForm.minExperience}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, minExperience: e.target.value }))}
                      />

                      <div className="form-actions">
                        <button type="submit">Save changes</button>
                        <button type="button" className="btn-cancel" onClick={closeEditJob}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              ) : null}

              {jobsState.error ? <p className="warning">{jobsState.error}</p> : null}

              <div className="tabs-row">
                {dashboardTabs.map((tab) => (
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

              {activeTab === "Search Freelancers" ? (
                <div>
                  <div className="client-search-grid">
                    <div>
                      <label htmlFor="freelancerSearchQ">Search anything</label>
                      <input
                        id="freelancerSearchQ"
                        value={freelancerFilters.q}
                        onChange={(e) => setFreelancerFilters((prev) => ({ ...prev, q: e.target.value }))}
                        placeholder="Name, headline, skill, bio"
                      />
                    </div>
                    <div>
                      <label htmlFor="freelancerSearchName">Search by name</label>
                      <input
                        id="freelancerSearchName"
                        value={freelancerFilters.name}
                        onChange={(e) => setFreelancerFilters((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Freelancer name"
                      />
                    </div>
                    <div>
                      <label htmlFor="freelancerSearchSkill">Search by skill</label>
                      <input
                        id="freelancerSearchSkill"
                        value={freelancerFilters.skill}
                        onChange={(e) => setFreelancerFilters((prev) => ({ ...prev, skill: e.target.value }))}
                        placeholder="react, fastapi, aws"
                      />
                    </div>
                    <div>
                      <label htmlFor="freelancerSearchExperience">Minimum experience</label>
                      <input
                        id="freelancerSearchExperience"
                        type="number"
                        min={0}
                        value={freelancerFilters.minExperience}
                        onChange={(e) => setFreelancerFilters((prev) => ({ ...prev, minExperience: e.target.value }))}
                        placeholder="Years"
                      />
                    </div>
                  </div>

                  {freelancersState.loading ? <p className="muted">Searching freelancers...</p> : null}
                  {freelancersState.error ? <p className="warning">{freelancersState.error}</p> : null}
                  {!freelancersState.loading && freelancersState.items.length === 0 ? (
                    <p className="muted">No freelancers matched these filters.</p>
                  ) : null}

                  <div className="jobs-list proposals-list">
                    {freelancersState.items.map((freelancer) => (
                      <article key={freelancer.resume_id} className="job-card suggestion-card">
                        <div className="job-title-row">
                          <span className="job-title">{freelancer.name}</span>
                          <span className="proposal-status proposal-status-applied">
                            {freelancer.experience_years || 0}y {freelancer.experience_months || 0}m
                          </span>
                        </div>
                        <p className="muted job-desc">{freelancer.headline || "Freelancer"}</p>
                        <p className="muted">{freelancer.bio || "No bio added yet."}</p>
                        {(freelancer.skills || []).length ? (
                          <div className="job-skills">
                            {freelancer.skills.map((skill) => (
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
              ) : activeTab === "My Requirements" ? (
                <div>
                  {showCreateForm ? (
                    <form onSubmit={onSubmit}>
                      <label htmlFor="client_name_manage">Your name</label>
                      <input id="client_name_manage" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" />

                      <label htmlFor="client_email_manage">Your email</label>
                      <input id="client_email_manage" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="you@company.com" />

                      <label htmlFor="client_whatsapp_manage">WhatsApp number</label>
                      <input id="client_whatsapp_manage" value={clientWhatsapp} onChange={(e) => setClientWhatsapp(e.target.value)} placeholder="+1234567890" />

                      <label htmlFor="description_manage">Project / requirement details</label>
                      <textarea
                        id="description_manage"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        rows={5}
                        minLength={10}
                        placeholder="Describe the project, role, and what kind of freelancer you need."
                        required
                      />

                      <label htmlFor="required-skills_manage">Required skills (comma-separated)</label>
                      <input
                        id="required-skills_manage"
                        value={requiredSkills}
                        onChange={(event) => setRequiredSkills(event.target.value)}
                        placeholder="react, typescript, node, aws"
                      />

                      <label htmlFor="min-experience_manage">Minimum experience years</label>
                      <input
                        id="min-experience_manage"
                        type="number"
                        min={0}
                        value={minExperience}
                        onChange={(event) => setMinExperience(event.target.value)}
                      />
                    </form>
                  ) : null}

                  <div className="panel requirement-action-panel">
                    <div className="toolbar-actions">
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => {
                          if (showCreateForm) {
                            void onSubmit({ preventDefault() {} });
                          } else {
                            setShowCreateForm(true);
                          }
                        }}
                      >
                        Add requirement
                      </button>
                      {showCreateForm ? (
                        <button type="button" className="btn-cancel" onClick={() => setShowCreateForm(false)}>
                          Close
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="jobs-toolbar">
                    <div className="jobs-search">
                      <label htmlFor="clientJobSearch">Search requirements</label>
                      <input
                        id="clientJobSearch"
                        value={jobSearch}
                        onChange={(e) => setJobSearch(e.target.value)}
                        placeholder="Search by skill or position"
                      />
                    </div>
                  </div>

                  {requirementsRefreshing ? <p className="muted">Filtering your requirements...</p> : null}
                  <div className="jobs-list proposals-list">
                    {jobsState.items.map((job) => (
                      <article key={job.job_id} className={`job-card proposal-card ${job.is_live ? "" : "job-card-draft"}`}>
                        <div className="job-title-row">
                          <span className="job-title">{job.description}</span>
                          <label className="live-toggle">
                            <input
                              type="checkbox"
                              checked={Boolean(job.is_live)}
                              onChange={(e) => toggleJobLive(job.job_id, e.target.checked)}
                            />
                            <span className="live-toggle-slider" />
                            <span>{job.is_live ? "Active" : "Inactive"}</span>
                          </label>
                        </div>
                        <div className="job-meta-row">
                          <span className="job-meta">
                            <b>Requirement ID</b>: {job.job_id}
                          </span>
                          <span className="job-meta">
                            <b>Min exp</b>: {job.min_experience_years || 0}+ yrs
                          </span>
                          <span className="job-meta">
                            <b>Required skills</b>: {(job.required_skills || []).length}
                          </span>
                        </div>
                        {(job.required_skills || []).length ? (
                          <div className="job-skills">
                            {job.required_skills.map((skill) => (
                              <span key={skill} className="skill-chip">
                                {skill}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <div className="job-card-actions requirement-card-actions">
                          <button
                            type="button"
                            className="icon-edit-btn"
                            aria-label="Edit requirement"
                            title="Edit requirement"
                            onClick={() => startEditingJob(job)}
                          >
                            <span className="edit-icon" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="icon-delete-btn"
                            aria-label="Delete requirement"
                            title="Delete requirement"
                            onClick={() => removeJob(job.job_id)}
                          >
                            <span className="trash-icon" aria-hidden="true" />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <h2>Received requests</h2>
                  <p className="muted">
                    Review freelancer applications here. Accept or reject after checking how well their profile matches your
                    requirement.
                  </p>
                  {requestsState.loading ? <p className="muted">Loading received requests...</p> : null}
                  {requestsState.error ? <p className="warning">{requestsState.error}</p> : null}
                  {!requestsState.loading && requestsState.items.length === 0 ? (
                    <p className="muted">No freelancer requests yet.</p>
                  ) : null}
                  <div className="jobs-list proposals-list">
                    {requestsState.items.map((item) => (
                      <article key={item.application_id} className="job-card proposal-card">
                        <div className="job-title-row">
                          <Link className="profile-open-btn" to={`/freelancers/${item.resume_id}`}>
                            {item.freelancer_name || "Freelancer"}
                          </Link>
                        </div>
                        <p className="muted job-desc">{item.job_description || "Job description unavailable."}</p>
                        <div className="job-meta-row">
                          <span className="job-meta">
                            <b>Requirement ID</b>: {item.job_id}
                          </span>
                          <span className="job-meta">
                            <b>Headline</b>: {item.headline || "Freelancer"}
                          </span>
                          <span className="job-meta">
                            <b>Skill match</b>: {item.skill_match_percent || 0}%
                          </span>
                        </div>
                        {(item.matched_skills || []).length ? (
                          <div className="job-skills">
                            {item.matched_skills.map((skill) => (
                              <span key={skill} className="skill-chip">
                                {skill}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <Link className="text-link profile-inline-link" to={`/freelancers/${item.resume_id}`}>
                          View profile
                        </Link>
                        <div className="job-card-actions">
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => updateRequestStatus(item.application_id, "accepted")}
                            disabled={item.status === "accepted"}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="btn-cancel"
                            onClick={() => updateRequestStatus(item.application_id, "rejected")}
                            disabled={item.status === "rejected"}
                          >
                            Reject
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <p className={`message ${status.type}`}>{status.message}</p>
        </article>

      </main>
    </div>
  );
}

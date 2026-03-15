import React from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const TIMEZONE_OPTIONS = [
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Singapore",
  "Australia/Sydney",
];

function formatTimeline(years, months, days) {
  const parts = [];
  if (Number(years) > 0) parts.push(`${years} yr${Number(years) === 1 ? "" : "s"}`);
  if (Number(months) > 0) parts.push(`${months} month${Number(months) === 1 ? "" : "s"}`);
  if (Number(days) > 0) parts.push(`${days} day${Number(days) === 1 ? "" : "s"}`);
  return parts.length ? parts.join(" ") : "Not set";
}

function formatAvailabilitySlot(slot) {
  if (!slot || typeof slot !== "object") return "Available slot";
  const datePart = slot.date ? `${slot.date} ` : "";
  const startPart = slot.start || "";
  const endPart = slot.end || "";
  return `${datePart}${startPart}${startPart && endPart ? " - " : ""}${endPart}`.trim();
}

function formatInterviewWindow(start, end) {
  if (!start) return "Interview scheduled";
  const startText = String(start).replace("T", " ");
  const endText = end ? String(end).replace("T", " ") : "";
  return `${startText}${endText ? ` - ${endText}` : ""}`;
}

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
  const [jobTimezone, setJobTimezone] = useState("Asia/Kolkata");
  const [timelineYears, setTimelineYears] = useState(0);
  const [timelineMonths, setTimelineMonths] = useState(0);
  const [timelineDays, setTimelineDays] = useState(0);

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
    timezone: "Asia/Kolkata",
    timelineYears: 0,
    timelineMonths: 0,
    timelineDays: 0,
  });

  const [freelancerFilters, setFreelancerFilters] = useState({
    q: "",
    name: "",
    skill: "",
    minExperience: "",
  });
  const [freelancersState, setFreelancersState] = useState({ loading: false, items: [], error: "" });
  const [scheduleState, setScheduleState] = useState({
    applicationId: "",
    resumeId: "",
    jobId: "",
    freelancerEmail: "",
    slots: [],
    loading: false,
    error: "",
  });
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
      timezone: jobTimezone,
      project_timeline_years: Number(timelineYears) || 0,
      project_timeline_months: Number(timelineMonths) || 0,
      project_timeline_days: Number(timelineDays) || 0,
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
      setJobTimezone("Asia/Kolkata");
      setTimelineYears(0);
      setTimelineMonths(0);
      setTimelineDays(0);
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
      if (statusValue === "accepted") {
        setStatus({ type: "success", message: "Freelancer accepted. You can schedule an interview now." });
      } else {
        setStatus({ type: "success", message: "Request rejected and removed from received requests." });
      }
      setRequestsState((prev) => ({
        ...prev,
        items:
          statusValue === "rejected"
            ? prev.items.filter((item) => item.application_id !== applicationId)
            : prev.items.map((item) =>
                item.application_id === applicationId ? { ...item, status: statusValue } : item
              ),
      }));
      if (statusValue === "rejected" && scheduleState.applicationId === applicationId) {
        setScheduleState({
          applicationId: "",
          resumeId: "",
          jobId: "",
          freelancerEmail: "",
          slots: [],
          loading: false,
          error: "",
        });
      }
    } catch (error) {
      setStatus({ type: "warning", message: error.message });
    }
  }

  async function openSchedulePanel(item) {
    if (scheduleState.applicationId === item.application_id) {
      setScheduleState({
        applicationId: "",
        resumeId: "",
        jobId: "",
        freelancerEmail: "",
        slots: [],
        loading: false,
        error: "",
      });
      return;
    }
    setScheduleState({
      applicationId: item.application_id,
      resumeId: item.resume_id,
      jobId: item.job_id,
      freelancerEmail: item.freelancer_email,
      slots: [],
      loading: true,
      error: "",
    });
    try {
      const response = await fetch(`${apiBase}/freelancers/${item.resume_id}/slots`, { credentials: "include" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Could not load freelancer availability.");
      }
      setScheduleState({
        applicationId: item.application_id,
        resumeId: item.resume_id,
        jobId: item.job_id,
        freelancerEmail: item.freelancer_email,
        slots: data.availability_slots || [],
        loading: false,
        error: "",
      });
    } catch (error) {
      setScheduleState({
        applicationId: item.application_id,
        resumeId: item.resume_id,
        jobId: item.job_id,
        freelancerEmail: item.freelancer_email,
        slots: [],
        loading: false,
        error: error.message,
      });
    }
  }

  async function scheduleInterviewForSlot(slot) {
    if (!scheduleState.applicationId) return;
    const datePrefix = slot?.date ? `${slot.date}T` : "";
    const slotStart = `${datePrefix}${slot?.start || ""}`;
    const slotEnd = `${datePrefix}${slot?.end || ""}`;
    try {
      const response = await fetch(`${apiBase}/interviews/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          job_id: scheduleState.jobId,
          resume_id: scheduleState.resumeId,
          client_email: clientEmail.trim() || user?.email || "",
          freelancer_email: scheduleState.freelancerEmail,
          slot_start: slotStart,
          slot_end: slotEnd,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || data.message || "Could not schedule interview.");
      }
      setStatus({ type: "success", message: "Interview scheduled successfully." });
      setRequestsState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.application_id === scheduleState.applicationId
            ? {
                ...item,
                interview: {
                  slot_start: slotStart,
                  slot_end: slotEnd,
                  meet_link: data.meet_link || "",
                  event_id: data.event_id || "",
                  status: "scheduled",
                },
              }
            : item
        ),
      }));
      setScheduleState({
        applicationId: "",
        resumeId: "",
        jobId: "",
        freelancerEmail: "",
        slots: [],
        loading: false,
        error: "",
      });
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
      timezone: job.timezone || "Asia/Kolkata",
      timelineYears: job.project_timeline_years || 0,
      timelineMonths: job.project_timeline_months || 0,
      timelineDays: job.project_timeline_days || 0,
    });
  }

  function closeEditJob() {
    setEditingJob(null);
    setEditForm({
      description: "",
      requiredSkills: "",
      minExperience: 0,
      timezone: "Asia/Kolkata",
      timelineYears: 0,
      timelineMonths: 0,
      timelineDays: 0,
    });
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
          timezone: editForm.timezone,
          project_timeline_years: Number(editForm.timelineYears) || 0,
          project_timeline_months: Number(editForm.timelineMonths) || 0,
          project_timeline_days: Number(editForm.timelineDays) || 0,
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

              <label htmlFor="job-timezone">Timezone</label>
              <select id="job-timezone" value={jobTimezone} onChange={(event) => setJobTimezone(event.target.value)}>
                {TIMEZONE_OPTIONS.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {timezone}
                  </option>
                ))}
              </select>

              <label>Project timeline</label>
              <div className="timeline-grid">
                <div>
                  <label htmlFor="timeline-years">Years</label>
                  <input
                    id="timeline-years"
                    type="number"
                    min={0}
                    value={timelineYears}
                    onChange={(event) => setTimelineYears(event.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="timeline-months">Months</label>
                  <input
                    id="timeline-months"
                    type="number"
                    min={0}
                    value={timelineMonths}
                    onChange={(event) => setTimelineMonths(event.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="timeline-days">Days</label>
                  <input
                    id="timeline-days"
                    type="number"
                    min={0}
                    value={timelineDays}
                    onChange={(event) => setTimelineDays(event.target.value)}
                  />
                </div>
              </div>

              <button type="submit">Create first requirement</button>
            </form>
          ) : (
            <div>
              {editingJob ? (
                <div className="modal-backdrop" onClick={closeEditJob}>
                  <div className="modal-card" onClick={(event) => event.stopPropagation()}>
                    <div className="job-title-row">
                      <h2>Edit requirement</h2>
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

                      <label htmlFor="edit_job_timezone">Timezone</label>
                      <select
                        id="edit_job_timezone"
                        value={editForm.timezone}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, timezone: e.target.value }))}
                      >
                        {TIMEZONE_OPTIONS.map((timezone) => (
                          <option key={timezone} value={timezone}>
                            {timezone}
                          </option>
                        ))}
                      </select>

                      <label>Project timeline</label>
                      <div className="timeline-grid">
                        <div>
                          <label htmlFor="edit_timeline_years">Years</label>
                          <input
                            id="edit_timeline_years"
                            type="number"
                            min={0}
                            value={editForm.timelineYears}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, timelineYears: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label htmlFor="edit_timeline_months">Months</label>
                          <input
                            id="edit_timeline_months"
                            type="number"
                            min={0}
                            value={editForm.timelineMonths}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, timelineMonths: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label htmlFor="edit_timeline_days">Days</label>
                          <input
                            id="edit_timeline_days"
                            type="number"
                            min={0}
                            value={editForm.timelineDays}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, timelineDays: e.target.value }))}
                          />
                        </div>
                      </div>

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

                      <label htmlFor="job-timezone_manage">Timezone</label>
                      <select id="job-timezone_manage" value={jobTimezone} onChange={(event) => setJobTimezone(event.target.value)}>
                        {TIMEZONE_OPTIONS.map((timezone) => (
                          <option key={timezone} value={timezone}>
                            {timezone}
                          </option>
                        ))}
                      </select>

                      <label>Project timeline</label>
                      <div className="timeline-grid">
                        <div>
                          <label htmlFor="timeline-years_manage">Years</label>
                          <input
                            id="timeline-years_manage"
                            type="number"
                            min={0}
                            value={timelineYears}
                            onChange={(event) => setTimelineYears(event.target.value)}
                          />
                        </div>
                        <div>
                          <label htmlFor="timeline-months_manage">Months</label>
                          <input
                            id="timeline-months_manage"
                            type="number"
                            min={0}
                            value={timelineMonths}
                            onChange={(event) => setTimelineMonths(event.target.value)}
                          />
                        </div>
                        <div>
                          <label htmlFor="timeline-days_manage">Days</label>
                          <input
                            id="timeline-days_manage"
                            type="number"
                            min={0}
                            value={timelineDays}
                            onChange={(event) => setTimelineDays(event.target.value)}
                          />
                        </div>
                      </div>
                    </form>
                  ) : null}

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
                          <span className="job-meta">
                            <b>Timezone</b>: {job.timezone || "Not set"}
                          </span>
                          <span className="job-meta">
                            <b>Timeline</b>: {formatTimeline(job.project_timeline_years, job.project_timeline_months, job.project_timeline_days)}
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
                        <div className="job-card-actions received-request-actions">
                          {item.status === "accepted" ? (
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => openSchedulePanel(item)}
                            >
                              {scheduleState.applicationId === item.application_id ? "Hide schedule" : "Schedule interview"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => updateRequestStatus(item.application_id, "accepted")}
                              disabled={item.status === "accepted"}
                            >
                              Accept
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-cancel"
                            onClick={() => updateRequestStatus(item.application_id, "rejected")}
                            disabled={item.status === "rejected"}
                          >
                            Reject
                          </button>
                        </div>
                        {item.status === "accepted" ? (
                          <p className="muted acceptance-note">
                            Freelancer accepted for this project. Schedule an interview to take the conversation forward.
                          </p>
                        ) : null}
                        {item.interview?.meet_link ? (
                          <div className="scheduled-interview-note">
                            <p className="success proposal-message">
                              Interview scheduled for {formatInterviewWindow(item.interview.slot_start, item.interview.slot_end)}.
                            </p>
                            <a
                              className="text-link"
                              href={item.interview.meet_link}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open Google Meet link
                            </a>
                          </div>
                        ) : null}
                        {scheduleState.applicationId === item.application_id ? (
                          <div className="schedule-panel">
                            <h3>Schedule interview</h3>
                            <p className="muted">Choose one of the freelancer&apos;s availability slots.</p>
                            {scheduleState.loading ? <p className="muted">Loading available slots...</p> : null}
                            {scheduleState.error ? <p className="warning">{scheduleState.error}</p> : null}
                            {!scheduleState.loading && !scheduleState.error && scheduleState.slots.length === 0 ? (
                              <p className="muted">No availability slots found yet for this freelancer.</p>
                            ) : null}
                            {!scheduleState.loading && scheduleState.slots.length > 0 ? (
                              <div className="schedule-slot-list">
                                {scheduleState.slots.map((slot, index) => (
                                  <button
                                    key={`${item.application_id}-${slot.date || "slot"}-${slot.start || index}`}
                                    type="button"
                                    className="btn-outline schedule-slot-btn"
                                    onClick={() => scheduleInterviewForSlot(slot)}
                                  >
                                    {formatAvailabilitySlot(slot)}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
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

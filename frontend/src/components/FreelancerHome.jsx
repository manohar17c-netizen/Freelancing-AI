import React from "react";
import { useState } from "react";

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
  const [activeTab, setActiveTab] = useState("Find Jobs");

  return (
    <div className="page">
      <main className="container">
        <div className="topbar">
          <div className="logo">
            <span>Freelancing</span>AI
          </div>
          <small className="muted">Freelancer workspace</small>
        </div>

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

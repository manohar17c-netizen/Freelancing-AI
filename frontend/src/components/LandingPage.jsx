import React from "react";
import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="page">
      <div className="container">
        <header className="header">
          <div className="logo">
            <span>Freelancing</span>AI
          </div>
        </header>

        <main className="hero">
          <div className="badge">Marketplace makeover • Upwork-inspired</div>
          <h1>Find expert freelancers or your next high-value contract.</h1>
          <p>
            A polished hiring experience built for speed: profile intake, AI ranking, and instant top-match
            recommendations for your project needs.
          </p>
          <div className="actions-grid">
            <a className="action primary" href="/auth/login?next=/ui/resume">
              I&apos;m a Freelancer
            </a>
            <Link className="action" to="/jobs">
              I&apos;m Hiring
            </Link>
          </div>
          <div className="stats-grid">
            <div className="stat-card">
              <b>10x</b>
              <span>Faster talent discovery with AI ranking.</span>
            </div>
            <div className="stat-card">
              <b>Quality-first</b>
              <span>Skill + experience weighted matching.</span>
            </div>
            <div className="stat-card">
              <b>Simple flow</b>
              <span>Upload resume and get discovered quickly.</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

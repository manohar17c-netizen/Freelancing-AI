# Nexcruit — Employee Lifecycle Demo

**An interactive front-end prototype** based on the *AI-Powered Recruitment Intelligence Platform (HRMS-AI)* business plan, IIM Kozhikode EPGP-17 Group C7, submitted 10 November 2026.

> **Demo, not a live recruitment system.** This static website uses fictional applicants, manually authored synthetic skill values and transparent weighted arithmetic. It does not use live AI, parse CVs, contact candidates or make hiring decisions.

## Start the demo

- **Fastest:** open `index.html` in a browser; or
- **Local HTTP server:** from this folder run `python3 -m http.server 8000`, then visit `http://localhost:8000`.
- **Free public hosting:** see [`DEPLOY.md`](DEPLOY.md). Works with Netlify Drop, GitHub Pages or equivalent static hosts; no build step and no API keys.

## Try the employee lifecycle

Select **Quick guided demo** on the landing page for a tip at each stage of the same interactive workspace.

1. Pick **Data Engineering Lead**, **Senior Product Manager**, or **Enterprise Sales Lead**.
2. Enter a fictional company's mission, values and current priorities.
3. Specify the manager's 90-day success criteria and adjust weighted skills.
4. Compare the fictional applicant shortlist, strengths and skill gaps; optionally create another fictional applicant.
5. Inspect a candidate's contextual interview questions and print or save the Executive Candidate Brief.
6. Invite a fictional applicant, book a sample interview and see the booking in the candidate view.
7. Mark the applicant Hired and complete tasks in their onboarding checklist.
8. Carry the role’s 90-day goal into performance check-ins and record sample feedback.

A **Share scenario** button creates a role-specific URL after the site is publicly hosted (it includes no applicant info). A **Reset demo** button restores synthetic defaults.

## Key implementation details

| File | Purpose |
|---|---|
| `index.html` | Public website and eight-stage workspace |
| `styles.css` | Responsive design, accessibility and print formatting |
| `app.js` | Fictional scenarios, scoring, interviewer brief, pipeline, candidate view and interaction |
| `tests/smoke.py` | Browser smoke tests for the entire fictional end-to-end journey |
| `AGENTS.md` | Codex guidance and product constraints |
| `PROJECT_BRIEF.md` | Hand-off to a ChatGPT Project |
| `DEPLOY.md` | Free public publishing steps |

## Run checks

```bash
node --check app.js
# Optional: requires Python Playwright and Chromium
python tests/smoke.py
```

This demo does not make network calls, collect contact information, persist candidate data or provide ATS integrations. Onboarding and performance are later product phases in the source report. This prototype includes sample checklists and check-ins.

### Why HRMS-AI is different

The product's value is **context before CVs**: collect company and hiring-manager success criteria before evaluating candidates, and help every interviewer ask more relevant, candidate-specific questions. Human reviewers make all employment decisions.

### Project ownership and affiliation

Inspired by the Group C7 business plan as an independent educational startup concept. Not a deployed product or official service of IIM Kozhikode.

### Monorepo / Netlify
This app lives in `hrms-ai-demo/` inside `Freelancing-AI`. For Netlify, choose base directory `hrms-ai-demo`, publish directory `.`, and leave the build command blank.

### Alignment with the Group C7 report

- **Sections 3.1 and 5.2** — Organisation context and hiring-manager criteria lead into a weighted rubric, fictional candidate evidence, ranked skill gaps, three interview questions and a printable Executive Candidate Brief. The brief shows how its illustrative score was calculated.
- **Recruitment workflow** — A recruiter controls stage changes and can simulate booking an interview. The candidate view reflects the stage and sample time.
- **Production scope** — Live CV parsing and model inference, digital footprint sourcing, background verification, calendar and notification delivery, and ATS integrations are production capabilities described by the report. The demo uses fictional evidence and browser-session state. It presents rubric evidence for human review and does not assign a hiring recommendation.
- **Employee lifecycle** — The onboarding checklist uses a role skill gap to suggest a training topic. Performance check-ins carry forward the manager’s 90-day goal. The prototype stores these updates in memory. Predictive workforce analytics remain on the roadmap.

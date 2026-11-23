# Instructions for Codex and coding agents — HRMS-AI

## Product purpose
Build a trustworthy, approachable **public startup demonstration** for HRMS-AI (AI-Powered Recruitment Intelligence Platform). The project originated as the IIM Kozhikode EPGP-17 Group C7 Business Plan Project (submitted 10 November 2026). The key proposition is: organisational mission and hiring-manager success criteria inform a role rubric **before** any candidate is evaluated. Explainable skill gaps then lead to candidate-specific interview preparation.

## This repository is a DEMO, not a production recruiting system
- Current system is static HTML/CSS/vanilla JS. `index.html`, `styles.css`, `app.js` are the canonical implementation.
- All seeded applicants are fictional; skill scores are deterministic calculations from synthetic values. No live AI, resume extraction, identity checks, internet lookups, actual scheduling, messaging, or backend persistence.
- Never claim the algorithm measures candidate worth or decides whom to hire. Support a **Human Final Decision** throughout.
- Never process/store/share real candidate PII without a separate security/privacy review, legal basis, consent, appropriate data controls, and human review.
- Distinguish MVP demonstration from planned modules (onboarding, performance, predictive workforce analytics).
- Keep the website **public/product-facing**, not a fundraising/investor pitch. No seed request, ARR projections or financial forecast on the site.

## End-to-end experience to preserve
1. Organisation values, mission, business priorities.
2. Role title, manager's 90-day outcomes, weighted skill criteria.
3. Explainable sample shortlist, evidence map and skill gaps; allow a fictional profile to be created.
4. Interview-specific executive briefing with a printable report.
5. Human-controlled pipeline stage changes.
6. Candidate-facing view that reflects the human update.

## Development standards
- Keep website deployable without a backend, build step or paid account.
- Prioritise keyboard accessibility, mobile layouts, performance and privacy.
- Use only fictional names/data in demos and tests. Include visible simulation disclaimers.
- Do not silently add tracking, external analytics, data storage or network calls.
- `node --check app.js` and `python tests/smoke.py` are the current checks (the browser smoke test requires Playwright and Chromium).
- CSS/JS asset URLs must remain relative for GitHub Pages subpath hosting.
- Add automated tests and documentation when extending a workflow.

## Suggested future iterations
1. Refactor the current state/controller into testable modules, keeping behavior unchanged.
2. Improve accessible dialogs, toasts and keyboard navigation.
3. Add richer fictional sample job and candidate fixtures.
4. If the team wants a genuine MVP later: design multi-tenancy/authentication, recruiter & candidate permissions, secure API, database, actual CV parsing with human review, auditable evidence/rubrics and structured model evaluations. Do not misrepresent these as implemented before they exist.
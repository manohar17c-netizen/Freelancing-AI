# Nexcruit product pilot

From the repository root, run:

```sh
NEXCRUIT_DB=/tmp/nexcruit-product.sqlite3 python3 nexcruit-product/server.py
```

Open http://127.0.0.1:8766/. The guided demo runs in the browser using fictional data.
The product workspace at `/product/` creates accounts and stores each user's
application records, hiring stages, onboarding progress, and latest performance
check-in in SQLite. Use internal references and synthetic records for this pilot.

## Package the pilot

```sh
docker build -f nexcruit-product/Dockerfile -t nexcruit-pilot .
docker run --rm -p 127.0.0.1:8766:8766 -v nexcruit-data:/data nexcruit-pilot
```

Run this single-instance pilot behind a TLS reverse proxy and mount a persistent
volume at `/data`. Set `NEXCRUIT_HTTPS=1` when serving it over HTTPS. The static
Netlify deploy cannot run this process or persist its SQLite database. Public
production operation needs an application server, authentication rate limits,
account recovery, backup and restore, and organisation-level permissions.

## Role workflow

Create separate test accounts for a job seeker, an interviewee, an interviewer,
and a hiring expert. The hiring expert publishes a job. Job seekers and
interviewees can apply and see their own application status. The hiring expert
assigns a registered interviewer and enters the proposed interview time. The
candidate confirms the time in the workspace, and the assigned interviewer
records feedback. The hiring expert records the final decision and manages
onboarding and the latest check-in for hired applicants.

Workspace invitations and confirmations are stored in the application. Email,
calendar invitations, and video meetings require integrations. Pilot users
choose their role on registration. A production tenant must provision staff
roles and enforce organisation membership before enabling public registration.

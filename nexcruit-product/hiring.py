"""Role-scoped public job listings and interview workflow."""

from sqlite3 import Row

SCHEMA = """
CREATE TABLE IF NOT EXISTS user_roles(username TEXT PRIMARY KEY, role TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS jobs(
    id INTEGER PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS applications(
    id INTEGER PRIMARY KEY, job INTEGER NOT NULL, candidate TEXT NOT NULL,
    statement TEXT NOT NULL, stage TEXT NOT NULL DEFAULT 'Applied',
    interviewer TEXT, slot TEXT, accepted INTEGER NOT NULL DEFAULT 0,
    feedback TEXT, UNIQUE(job, candidate)
);
"""
ROLES = ("job seeker", "interviewee", "interviewer", "hiring expert")


def field(data, key, limit):
    value = data.get(key, "")
    if not isinstance(value, str) or not 0 < len(value.strip()) <= limit:
        raise ValueError()
    return value.strip()


def hiring_action(db, owner, endpoint, data):
    role_row = db.execute("SELECT role FROM user_roles WHERE username=?", (owner,)).fetchone()
    role = role_row[0] if role_row else "hiring expert"
    job_id = data.get("job")
    application_id = data.get("id")
    if endpoint == "publish" and role == "hiring expert":
        db.execute("INSERT INTO jobs(owner,title,description) VALUES(?,?,?)",
                   (owner, field(data, "title", 120), field(data, "description", 2000)))
    elif endpoint == "apply" and role in ("job seeker", "interviewee"):
        if not db.execute("SELECT 1 FROM jobs WHERE id=?", (job_id,)).fetchone():
            return 404, {"error": "Job unavailable."}, None
        db.execute("INSERT INTO applications(job,candidate,statement) VALUES(?,?,?)",
                   (job_id, owner, field(data, "statement", 1000)))
    elif endpoint == "invite" and role == "hiring expert":
        interviewer = field(data, "interviewer", 64).lower()
        if not db.execute("SELECT 1 FROM user_roles WHERE username=? AND role='interviewer'", (interviewer,)).fetchone():
            return 400, {"error": "Enter a registered interviewer username."}, None
        updated = db.execute("""
            UPDATE applications SET stage='Interview', interviewer=?, slot=?, accepted=0, feedback=NULL
            WHERE id=? AND stage IN ('Applied','Interview') AND job IN (SELECT id FROM jobs WHERE owner=?)
            """, (interviewer, field(data, "slot", 100), application_id, owner))
        if not updated.rowcount:
            return 404, {"error": "Application unavailable for scheduling."}, None
    elif endpoint == "accept" and role in ("job seeker", "interviewee"):
        updated = db.execute("""
            UPDATE applications SET accepted=1 WHERE id=? AND candidate=? AND stage='Interview'
            """, (application_id, owner))
        if not updated.rowcount:
            return 404, {"error": "Invitation unavailable."}, None
    elif endpoint == "feedback" and role == "interviewer":
        updated = db.execute("""
            UPDATE applications SET feedback=? WHERE id=? AND interviewer=? AND stage='Interview' AND accepted=1
            """, (field(data, "feedback", 2000), application_id, owner))
        if not updated.rowcount:
            return 404, {"error": "Confirmed interview unavailable."}, None
    elif endpoint == "decide" and role == "hiring expert":
        stage = data.get("stage")
        if stage not in ("Hired", "Closed"):
            raise ValueError()
        updated = db.execute("""
            UPDATE applications SET stage=? WHERE id=? AND stage IN ('Applied','Interview')
            AND job IN (SELECT id FROM jobs WHERE owner=?)
            """, (stage, application_id, owner))
        if not updated.rowcount:
            return 404, {"error": "Application unavailable for decision."}, None
        if stage == "Hired":
            db.execute("""
                INSERT INTO records(owner,role,reference,stage)
                SELECT j.owner,j.title,'application-' || a.id,'Hired'
                FROM applications a JOIN jobs j ON j.id=a.job WHERE a.id=?
                """, (application_id,))
    elif endpoint != "hiring":
        return 403, {"error": "Your role cannot perform this action."}, None

    db.row_factory = Row
    jobs = [dict(row) for row in db.execute("SELECT id,title,description FROM jobs ORDER BY id DESC")]
    conditions = {
        "hiring expert": "j.owner=?",
        "interviewer": "a.interviewer=?",
        "job seeker": "a.candidate=?",
        "interviewee": "a.candidate=?",
    }
    applications = [dict(row) for row in db.execute("""
        SELECT a.id,j.title,a.candidate,a.statement,a.stage,a.interviewer,a.slot,a.accepted,a.feedback
        FROM applications a JOIN jobs j ON j.id=a.job WHERE """ + conditions[role] + " ORDER BY a.id DESC", (owner,))]
    if role in ("job seeker", "interviewee"):
        for application in applications:
            application.pop("feedback")
    return 200, {"role": role, "jobs": jobs, "applications": applications}, None

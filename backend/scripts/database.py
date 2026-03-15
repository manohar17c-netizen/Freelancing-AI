from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, List

ROOT_DIR = Path(__file__).resolve().parents[2]
DB_DIR = ROOT_DIR / "backend" / "data"
DB_PATH = DB_DIR / "freelancing_ai.db"


def _get_connection() -> sqlite3.Connection:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with _get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS freelancers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                resume_id TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                email TEXT NOT NULL DEFAULT '',
                headline TEXT NOT NULL DEFAULT 'Freelancer',
                bio TEXT NOT NULL DEFAULT '',
                experience_years INTEGER NOT NULL DEFAULT 0,
                experience_months INTEGER NOT NULL DEFAULT 0,
                skills_json TEXT NOT NULL DEFAULT '[]',
                resume_text TEXT NOT NULL,
                embedding_json TEXT NOT NULL DEFAULT '[]',
                availability_slots_json TEXT NOT NULL DEFAULT '[]',
                whatsapp_phone TEXT NOT NULL DEFAULT '',
                profile_live INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        try:
            connection.execute("ALTER TABLE freelancers ADD COLUMN experience_months INTEGER NOT NULL DEFAULT 0")
        except sqlite3.OperationalError:
            pass
        for col, col_type in [
            ("availability_slots_json", "TEXT NOT NULL DEFAULT '[]'"),
            ("whatsapp_phone", "TEXT NOT NULL DEFAULT ''"),
            ("profile_live", "INTEGER NOT NULL DEFAULT 1"),
        ]:
            try:
                connection.execute(f"ALTER TABLE freelancers ADD COLUMN {col.split()[0]} {col_type}")
            except sqlite3.OperationalError:
                pass
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id TEXT NOT NULL UNIQUE,
                client_name TEXT NOT NULL,
                client_email TEXT NOT NULL DEFAULT '',
                client_whatsapp TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL,
                required_skills_json TEXT NOT NULL DEFAULT '[]',
                min_experience_years INTEGER NOT NULL DEFAULT 0,
                timezone TEXT NOT NULL DEFAULT '',
                project_timeline_years INTEGER NOT NULL DEFAULT 0,
                project_timeline_months INTEGER NOT NULL DEFAULT 0,
                project_timeline_days INTEGER NOT NULL DEFAULT 0,
                is_live INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        for col, col_type in [
            ("timezone", "TEXT NOT NULL DEFAULT ''"),
            ("project_timeline_years", "INTEGER NOT NULL DEFAULT 0"),
            ("project_timeline_months", "INTEGER NOT NULL DEFAULT 0"),
            ("project_timeline_days", "INTEGER NOT NULL DEFAULT 0"),
        ]:
            try:
                connection.execute(f"ALTER TABLE jobs ADD COLUMN {col} {col_type}")
            except sqlite3.OperationalError:
                pass
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS client_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_email TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL DEFAULT '',
                whatsapp_phone TEXT NOT NULL DEFAULT '',
                company_name TEXT NOT NULL DEFAULT '',
                role_title TEXT NOT NULL DEFAULT '',
                hiring_goals TEXT NOT NULL DEFAULT '',
                preferred_skills_json TEXT NOT NULL DEFAULT '[]',
                timezone TEXT NOT NULL DEFAULT '',
                budget_notes TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS interviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id TEXT NOT NULL,
                resume_id TEXT NOT NULL,
                client_email TEXT NOT NULL,
                freelancer_email TEXT NOT NULL,
                slot_start TEXT NOT NULL,
                slot_end TEXT NOT NULL,
                meet_link TEXT NOT NULL DEFAULT '',
                event_id TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'scheduled',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(job_id, resume_id, slot_start)
            )
            """
        )
        for col, col_type in [
            ("meet_link", "TEXT NOT NULL DEFAULT ''"),
            ("event_id", "TEXT NOT NULL DEFAULT ''"),
        ]:
            try:
                connection.execute(f"ALTER TABLE interviews ADD COLUMN {col} {col_type}")
            except sqlite3.OperationalError:
                pass
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_id TEXT NOT NULL UNIQUE,
                job_id TEXT NOT NULL,
                resume_id TEXT NOT NULL,
                client_email TEXT NOT NULL,
                freelancer_email TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'applied',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(job_id, resume_id)
            )
            """
        )
        connection.commit()


def upsert_freelancer_record(
    *,
    resume_id: str,
    name: str,
    email: str,
    headline: str,
    bio: str,
    experience_years: int,
    experience_months: int,
    skills: List[str],
    resume_text: str,
    embedding: List[float],
    availability_slots: List[dict] | None = None,
    whatsapp_phone: str = "",
    profile_live: bool = True,
) -> None:
    slots = availability_slots or []
    with _get_connection() as connection:
        connection.execute(
            """
            INSERT INTO freelancers (
                resume_id, name, email, headline, bio, experience_years,
                experience_months,
                skills_json, resume_text, embedding_json,
                availability_slots_json, whatsapp_phone, profile_live
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(resume_id) DO UPDATE SET
                name=excluded.name,
                email=excluded.email,
                headline=excluded.headline,
                bio=excluded.bio,
                experience_years=excluded.experience_years,
                experience_months=excluded.experience_months,
                skills_json=excluded.skills_json,
                resume_text=excluded.resume_text,
                embedding_json=excluded.embedding_json,
                availability_slots_json=excluded.availability_slots_json,
                whatsapp_phone=excluded.whatsapp_phone,
                profile_live=excluded.profile_live,
                updated_at=datetime('now')
            """,
            (
                resume_id,
                name,
                email,
                headline,
                bio,
                max(experience_years, 0),
                max(min(experience_months, 11), 0),
                json.dumps(skills),
                resume_text,
                json.dumps(embedding),
                json.dumps(slots),
                whatsapp_phone or "",
                1 if profile_live else 0,
            ),
        )
        connection.commit()


def load_freelancer_records() -> List[Dict[str, Any]]:
    with _get_connection() as connection:
        try:
            rows = connection.execute(
                """
                SELECT resume_id, name, email, headline, bio, experience_years, experience_months,
                       skills_json, resume_text, embedding_json,
                       COALESCE(availability_slots_json, '[]') as availability_slots_json,
                       COALESCE(whatsapp_phone, '') as whatsapp_phone,
                       COALESCE(profile_live, 1) as profile_live
                FROM freelancers
                ORDER BY created_at ASC
                """
            ).fetchall()
        except sqlite3.OperationalError:
            rows = connection.execute(
                """
                SELECT resume_id, name, email, headline, bio, experience_years, experience_months,
                       skills_json, resume_text, embedding_json
                FROM freelancers
                ORDER BY created_at ASC
                """
            ).fetchall()

    records: List[Dict[str, Any]] = []
    for row in rows:
        row_d = {k: row[k] for k in row.keys()} if hasattr(row, "keys") else dict(enumerate(row))
        try:
            skills = json.loads(row_d.get("skills_json") or "[]")
        except json.JSONDecodeError:
            skills = []
        try:
            embedding = json.loads(row_d.get("embedding_json") or "[]")
        except json.JSONDecodeError:
            embedding = []
        try:
            slots = json.loads(row_d.get("availability_slots_json", "[]") or "[]")
        except (json.JSONDecodeError, TypeError):
            slots = []
        if not isinstance(slots, list):
            slots = []

        records.append(
            {
                "resume_id": row_d["resume_id"],
                "name": row_d["name"],
                "email": row_d["email"],
                "headline": row_d["headline"],
                "bio": row_d["bio"],
                "experience_years": int(row_d.get("experience_years", 0) or 0),
                "experience_months": int(row_d.get("experience_months", 0) or 0),
                "skills": skills if isinstance(skills, list) else [],
                "resume_text": row_d["resume_text"],
                "embedding": embedding if isinstance(embedding, list) else [],
                "availability_slots": slots,
                "whatsapp_phone": str(row_d.get("whatsapp_phone", "") or ""),
                "profile_live": bool(row_d.get("profile_live", 1)),
            }
        )
    return records


def list_freelancer_profiles(limit: int = 100) -> List[Dict[str, Any]]:
    safe_limit = max(1, min(limit, 1000))
    with _get_connection() as connection:
        try:
            rows = connection.execute(
                """
                SELECT resume_id, name, email, headline, bio, experience_years, experience_months,
                       skills_json, availability_slots_json, profile_live, created_at, updated_at
                FROM freelancers
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (safe_limit,),
            ).fetchall()
        except sqlite3.OperationalError:
            rows = connection.execute(
                """
                SELECT resume_id, name, email, headline, bio, experience_years, experience_months, skills_json, created_at, updated_at
                FROM freelancers
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (safe_limit,),
            ).fetchall()

    profiles: List[Dict[str, Any]] = []
    for row in rows:
        row_d = {k: row[k] for k in row.keys()} if hasattr(row, "keys") else {}
        try:
            skills = json.loads(row_d.get("skills_json") or "[]")
        except json.JSONDecodeError:
            skills = []
        try:
            slots = json.loads(row_d.get("availability_slots_json") or "[]")
        except (json.JSONDecodeError, TypeError):
            slots = []
        profiles.append(
            {
                "resume_id": row_d["resume_id"],
                "name": row_d["name"],
                "email": row_d["email"],
                "headline": row_d["headline"],
                "bio": row_d["bio"],
                "experience_years": int(row_d.get("experience_years", 0) or 0),
                "experience_months": int(row_d.get("experience_months", 0) or 0),
                "skills": skills if isinstance(skills, list) else [],
                "availability_slots": slots if isinstance(slots, list) else [],
                "profile_live": bool(row_d.get("profile_live", 1)),
                "created_at": row_d.get("created_at", ""),
                "updated_at": row_d.get("updated_at", ""),
            }
        )
    return profiles


def get_freelancer_by_email(email: str) -> Dict[str, Any] | None:
    if not email:
        return None
    normalized = email.strip().lower()
    with _get_connection() as connection:
        row = connection.execute(
            """
            SELECT resume_id, name, email, headline, bio, experience_years, experience_months,
                   skills_json, resume_text, embedding_json,
                   COALESCE(availability_slots_json, '[]') as availability_slots_json,
                   COALESCE(whatsapp_phone, '') as whatsapp_phone,
                   COALESCE(profile_live, 1) as profile_live
            FROM freelancers
            WHERE lower(trim(email)) = ?
            LIMIT 1
            """,
            (normalized,),
        ).fetchone()
    if not row:
        return None
    row_d = {k: row[k] for k in row.keys()} if hasattr(row, "keys") else {}
    try:
        skills = json.loads(row_d.get("skills_json") or "[]")
    except json.JSONDecodeError:
        skills = []
    try:
        embedding = json.loads(row_d.get("embedding_json") or "[]")
    except json.JSONDecodeError:
        embedding = []
    try:
        slots = json.loads(row_d.get("availability_slots_json") or "[]")
    except (json.JSONDecodeError, TypeError):
        slots = []

    return {
        "resume_id": row_d.get("resume_id", ""),
        "name": row_d.get("name", ""),
        "email": row_d.get("email", ""),
        "headline": row_d.get("headline", ""),
        "bio": row_d.get("bio", ""),
        "experience_years": int(row_d.get("experience_years", 0) or 0),
        "experience_months": int(row_d.get("experience_months", 0) or 0),
        "skills": skills if isinstance(skills, list) else [],
        "resume_text": row_d.get("resume_text", ""),
        "embedding": embedding if isinstance(embedding, list) else [],
        "availability_slots": slots if isinstance(slots, list) else [],
        "whatsapp_phone": str(row_d.get("whatsapp_phone", "") or ""),
        "profile_live": bool(row_d.get("profile_live", 1)),
    }


def get_freelancer_by_name(name: str) -> Dict[str, Any] | None:
    normalized = str(name or "").strip().lower()
    if not normalized:
        return None
    with _get_connection() as connection:
        row = connection.execute(
            """
            SELECT resume_id, name, email, headline, bio, experience_years, experience_months,
                   skills_json, resume_text, embedding_json,
                   COALESCE(availability_slots_json, '[]') as availability_slots_json,
                   COALESCE(whatsapp_phone, '') as whatsapp_phone,
                   COALESCE(profile_live, 1) as profile_live
            FROM freelancers
            WHERE lower(trim(name)) = ?
            ORDER BY updated_at DESC, created_at DESC
            LIMIT 1
            """,
            (normalized,),
        ).fetchone()
    if not row:
        return None
    row_d = {k: row[k] for k in row.keys()} if hasattr(row, "keys") else {}
    try:
        skills = json.loads(row_d.get("skills_json") or "[]")
    except json.JSONDecodeError:
        skills = []
    try:
        embedding = json.loads(row_d.get("embedding_json") or "[]")
    except json.JSONDecodeError:
        embedding = []
    try:
        slots = json.loads(row_d.get("availability_slots_json") or "[]")
    except (json.JSONDecodeError, TypeError):
        slots = []

    return {
        "resume_id": row_d.get("resume_id", ""),
        "name": row_d.get("name", ""),
        "email": row_d.get("email", ""),
        "headline": row_d.get("headline", ""),
        "bio": row_d.get("bio", ""),
        "experience_years": int(row_d.get("experience_years", 0) or 0),
        "experience_months": int(row_d.get("experience_months", 0) or 0),
        "skills": skills if isinstance(skills, list) else [],
        "resume_text": row_d.get("resume_text", ""),
        "embedding": embedding if isinstance(embedding, list) else [],
        "availability_slots": slots if isinstance(slots, list) else [],
        "whatsapp_phone": str(row_d.get("whatsapp_phone", "") or ""),
        "profile_live": bool(row_d.get("profile_live", 1)),
    }


def list_jobs(limit: int = 50, q: str = "", live_only: bool = True) -> List[Dict[str, Any]]:
    safe_limit = max(1, min(limit, 200))
    query = (q or "").strip().lower()
    with _get_connection() as connection:
        sql = """
            SELECT job_id, client_name, client_email, client_whatsapp, description,
                   required_skills_json, min_experience_years, timezone,
                   project_timeline_years, project_timeline_months, project_timeline_days,
                   is_live, created_at, updated_at
            FROM jobs
        """
        where = []
        params: list[Any] = []
        if live_only:
            where.append("is_live = 1")
        if query:
            where.append("(lower(description) LIKE ? OR lower(required_skills_json) LIKE ?)")
            like = f"%{query}%"
            params.extend([like, like])
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY created_at DESC LIMIT ?"
        params.append(safe_limit)
        rows = connection.execute(sql, tuple(params)).fetchall()

    jobs: List[Dict[str, Any]] = []
    for row in rows:
        row_d = {k: row[k] for k in row.keys()} if hasattr(row, "keys") else {}
        try:
            required_skills = json.loads(row_d.get("required_skills_json") or "[]")
        except json.JSONDecodeError:
            required_skills = []
        jobs.append(
            {
                "job_id": row_d.get("job_id", ""),
                "client_name": row_d.get("client_name", ""),
                "client_email": row_d.get("client_email", ""),
                "client_whatsapp": row_d.get("client_whatsapp", ""),
                "description": row_d.get("description", ""),
                "required_skills": required_skills if isinstance(required_skills, list) else [],
                "min_experience_years": int(row_d.get("min_experience_years", 0) or 0),
                "timezone": row_d.get("timezone", ""),
                "project_timeline_years": int(row_d.get("project_timeline_years", 0) or 0),
                "project_timeline_months": int(row_d.get("project_timeline_months", 0) or 0),
                "project_timeline_days": int(row_d.get("project_timeline_days", 0) or 0),
                "is_live": bool(row_d.get("is_live", 0)),
                "created_at": row_d.get("created_at", ""),
                "updated_at": row_d.get("updated_at", ""),
            }
        )
    return jobs


def list_jobs_for_client(client_email: str, client_name: str = "", limit: int = 100, q: str = "") -> List[Dict[str, Any]]:
    normalized = str(client_email or "").strip().lower()
    normalized_name = str(client_name or "").strip().lower()
    if not normalized:
        normalized = ""
    safe_limit = max(1, min(limit, 200))
    query = (q or "").strip().lower()

    def _fetch(sql: str, params: list[Any]) -> List[Dict[str, Any]]:
        with _get_connection() as connection:
            rows = connection.execute(sql, tuple(params)).fetchall()

        jobs: List[Dict[str, Any]] = []
        for row in rows:
            row_d = {k: row[k] for k in row.keys()} if hasattr(row, "keys") else {}
            try:
                required_skills = json.loads(row_d.get("required_skills_json") or "[]")
            except json.JSONDecodeError:
                required_skills = []
            jobs.append(
                {
                    "job_id": row_d.get("job_id", ""),
                    "client_name": row_d.get("client_name", ""),
                    "client_email": row_d.get("client_email", ""),
                    "client_whatsapp": row_d.get("client_whatsapp", ""),
                    "description": row_d.get("description", ""),
                    "required_skills": required_skills if isinstance(required_skills, list) else [],
                    "min_experience_years": int(row_d.get("min_experience_years", 0) or 0),
                    "timezone": row_d.get("timezone", ""),
                    "project_timeline_years": int(row_d.get("project_timeline_years", 0) or 0),
                    "project_timeline_months": int(row_d.get("project_timeline_months", 0) or 0),
                    "project_timeline_days": int(row_d.get("project_timeline_days", 0) or 0),
                    "is_live": bool(row_d.get("is_live", 0)),
                    "created_at": row_d.get("created_at", ""),
                    "updated_at": row_d.get("updated_at", ""),
                }
            )
        return jobs

    base_sql = """
        SELECT job_id, client_name, client_email, client_whatsapp, description,
               required_skills_json, min_experience_years, timezone,
               project_timeline_years, project_timeline_months, project_timeline_days,
               is_live, created_at, updated_at
        FROM jobs
        WHERE {where_clause}
    """

    params: list[Any] = []
    where_clause = ""
    if normalized:
        where_clause = "lower(trim(client_email)) = ?"
        params.append(normalized)
    elif normalized_name:
        where_clause = "lower(trim(client_name)) = ?"
        params.append(normalized_name)
    else:
        return []

    if query:
        where_clause += " AND (lower(description) LIKE ? OR lower(required_skills_json) LIKE ?)"
        like = f"%{query}%"
        params.extend([like, like])

    sql = base_sql.format(where_clause=where_clause) + " ORDER BY created_at DESC LIMIT ?"
    params.append(safe_limit)
    jobs = _fetch(sql, params)

    if jobs or not normalized_name or not normalized:
        return jobs

    fallback_params: list[Any] = [normalized_name]
    fallback_where = "lower(trim(client_name)) = ?"
    if query:
        fallback_where += " AND (lower(description) LIKE ? OR lower(required_skills_json) LIKE ?)"
        like = f"%{query}%"
        fallback_params.extend([like, like])
    fallback_sql = base_sql.format(where_clause=fallback_where) + " ORDER BY created_at DESC LIMIT ?"
    fallback_params.append(safe_limit)
    return _fetch(fallback_sql, fallback_params)


def create_job(
    *,
    job_id: str,
    client_name: str,
    client_email: str = "",
    client_whatsapp: str = "",
    description: str,
    required_skills: List[str],
    min_experience_years: int = 0,
    timezone: str = "",
    project_timeline_years: int = 0,
    project_timeline_months: int = 0,
    project_timeline_days: int = 0,
    is_live: bool = False,
) -> None:
    with _get_connection() as connection:
        connection.execute(
            """
            INSERT INTO jobs (
                job_id, client_name, client_email, client_whatsapp, description,
                required_skills_json, min_experience_years, timezone,
                project_timeline_years, project_timeline_months, project_timeline_days, is_live
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(job_id) DO UPDATE SET
                client_name=excluded.client_name,
                client_email=excluded.client_email,
                client_whatsapp=excluded.client_whatsapp,
                description=excluded.description,
                required_skills_json=excluded.required_skills_json,
                min_experience_years=excluded.min_experience_years,
                timezone=excluded.timezone,
                project_timeline_years=excluded.project_timeline_years,
                project_timeline_months=excluded.project_timeline_months,
                project_timeline_days=excluded.project_timeline_days,
                is_live=excluded.is_live,
                updated_at=datetime('now')
            """,
            (
                job_id,
                client_name,
                client_email,
                client_whatsapp,
                description,
                json.dumps(required_skills),
                min_experience_years,
                timezone,
                max(project_timeline_years, 0),
                max(project_timeline_months, 0),
                max(project_timeline_days, 0),
                1 if is_live else 0,
            ),
        )
        connection.commit()


def upsert_client_profile(
    *,
    client_email: str,
    name: str = "",
    whatsapp_phone: str = "",
    company_name: str = "",
    role_title: str = "",
    hiring_goals: str = "",
    preferred_skills: List[str] | None = None,
    timezone: str = "",
    budget_notes: str = "",
) -> None:
    normalized = str(client_email or "").strip().lower()
    normalized_name = str(name or "").strip().lower()
    if not normalized and not normalized_name:
        return
    with _get_connection() as connection:
        existing = None
        if normalized:
            existing = connection.execute(
                """
                SELECT id, client_email
                FROM client_profiles
                WHERE client_email = ?
                LIMIT 1
                """,
                (normalized,),
            ).fetchone()
        if existing is None and normalized_name:
            existing = connection.execute(
                """
                SELECT id, client_email
                FROM client_profiles
                WHERE lower(trim(name)) = ?
                ORDER BY updated_at DESC, created_at DESC
                LIMIT 1
                """,
                (normalized_name,),
            ).fetchone()

        payload = (
            normalized or (existing["client_email"] if existing else ""),
            name,
            whatsapp_phone,
            company_name,
            role_title,
            hiring_goals,
            json.dumps(preferred_skills or []),
            timezone,
            budget_notes,
        )

        if existing is not None:
            connection.execute(
                """
                UPDATE client_profiles
                SET client_email = ?,
                    name = ?,
                    whatsapp_phone = ?,
                    company_name = ?,
                    role_title = ?,
                    hiring_goals = ?,
                    preferred_skills_json = ?,
                    timezone = ?,
                    budget_notes = ?,
                    updated_at = datetime('now')
                WHERE id = ?
                """,
                (*payload, existing["id"]),
            )
        else:
            connection.execute(
                """
                INSERT INTO client_profiles (
                    client_email, name, whatsapp_phone, company_name, role_title,
                    hiring_goals, preferred_skills_json, timezone, budget_notes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                payload,
            )
        connection.commit()


def get_client_profile(client_email: str) -> Dict[str, Any] | None:
    normalized = str(client_email or "").strip().lower()
    if not normalized:
        return None
    with _get_connection() as connection:
        row = connection.execute(
            """
            SELECT client_email, name, whatsapp_phone, company_name, role_title,
                   hiring_goals, preferred_skills_json, timezone, budget_notes,
                   created_at, updated_at
            FROM client_profiles
            WHERE client_email = ?
            LIMIT 1
            """,
            (normalized,),
        ).fetchone()
    if not row:
        return None
    row_d = {k: row[k] for k in row.keys()} if hasattr(row, "keys") else {}
    try:
        preferred_skills = json.loads(row_d.get("preferred_skills_json") or "[]")
    except json.JSONDecodeError:
        preferred_skills = []
    return {
        "client_email": row_d.get("client_email", ""),
        "name": row_d.get("name", ""),
        "whatsapp_phone": row_d.get("whatsapp_phone", ""),
        "company_name": row_d.get("company_name", ""),
        "role_title": row_d.get("role_title", ""),
        "hiring_goals": row_d.get("hiring_goals", ""),
        "preferred_skills": preferred_skills if isinstance(preferred_skills, list) else [],
        "timezone": row_d.get("timezone", ""),
        "budget_notes": row_d.get("budget_notes", ""),
        "created_at": row_d.get("created_at", ""),
        "updated_at": row_d.get("updated_at", ""),
    }


def get_client_profile_by_name(name: str) -> Dict[str, Any] | None:
    normalized = str(name or "").strip().lower()
    if not normalized:
        return None
    with _get_connection() as connection:
        row = connection.execute(
            """
            SELECT client_email, name, whatsapp_phone, company_name, role_title,
                   hiring_goals, preferred_skills_json, timezone, budget_notes,
                   created_at, updated_at
            FROM client_profiles
            WHERE lower(trim(name)) = ?
            ORDER BY updated_at DESC, created_at DESC
            LIMIT 1
            """,
            (normalized,),
        ).fetchone()
    if not row:
        return None
    row_d = {k: row[k] for k in row.keys()} if hasattr(row, "keys") else {}
    try:
        preferred_skills = json.loads(row_d.get("preferred_skills_json") or "[]")
    except json.JSONDecodeError:
        preferred_skills = []
    return {
        "client_email": row_d.get("client_email", ""),
        "name": row_d.get("name", ""),
        "whatsapp_phone": row_d.get("whatsapp_phone", ""),
        "company_name": row_d.get("company_name", ""),
        "role_title": row_d.get("role_title", ""),
        "hiring_goals": row_d.get("hiring_goals", ""),
        "preferred_skills": preferred_skills if isinstance(preferred_skills, list) else [],
        "timezone": row_d.get("timezone", ""),
        "budget_notes": row_d.get("budget_notes", ""),
        "created_at": row_d.get("created_at", ""),
        "updated_at": row_d.get("updated_at", ""),
    }


def set_job_live(job_id: str, is_live: bool) -> bool:
    with _get_connection() as connection:
        cur = connection.execute("UPDATE jobs SET is_live=?, updated_at=datetime('now') WHERE job_id=?", (1 if is_live else 0, job_id))
        connection.commit()
        return cur.rowcount > 0


def delete_job(job_id: str, client_email: str) -> bool:
    normalized = str(client_email or "").strip().lower()
    if not normalized:
        return False
    with _get_connection() as connection:
        cur = connection.execute(
            "DELETE FROM jobs WHERE job_id=? AND lower(trim(client_email))=?",
            (job_id, normalized),
        )
        connection.commit()
        return cur.rowcount > 0


def delete_applications_for_job(job_id: str) -> None:
    with _get_connection() as connection:
        connection.execute("DELETE FROM applications WHERE job_id = ?", (job_id,))
        connection.execute("DELETE FROM interviews WHERE job_id = ?", (job_id,))
        connection.commit()


def get_job(job_id: str) -> Dict[str, Any] | None:
    with _get_connection() as connection:
        row = connection.execute("SELECT * FROM jobs WHERE job_id=?", (job_id,)).fetchone()
    if not row:
        return None
    row_d = {k: row[k] for k in row.keys()} if hasattr(row, "keys") else {}
    try:
        skills = json.loads(row_d.get("required_skills_json") or "[]")
    except json.JSONDecodeError:
        skills = []
    return {
        "job_id": row_d["job_id"],
        "client_name": row_d["client_name"],
        "client_email": row_d.get("client_email", ""),
        "client_whatsapp": row_d.get("client_whatsapp", ""),
        "description": row_d["description"],
        "required_skills": skills,
        "min_experience_years": int(row_d.get("min_experience_years", 0) or 0),
        "timezone": row_d.get("timezone", ""),
        "project_timeline_years": int(row_d.get("project_timeline_years", 0) or 0),
        "project_timeline_months": int(row_d.get("project_timeline_months", 0) or 0),
        "project_timeline_days": int(row_d.get("project_timeline_days", 0) or 0),
        "is_live": bool(row_d.get("is_live", 0)),
        "created_at": row_d.get("created_at", ""),
        "updated_at": row_d.get("updated_at", ""),
    }


def schedule_interview(
    job_id: str,
    resume_id: str,
    client_email: str,
    freelancer_email: str,
    slot_start: str,
    slot_end: str,
    meet_link: str = "",
    event_id: str = "",
) -> bool:
    with _get_connection() as connection:
        try:
            connection.execute(
                """
                INSERT INTO interviews (
                    job_id, resume_id, client_email, freelancer_email,
                    slot_start, slot_end, meet_link, event_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (job_id, resume_id, client_email, freelancer_email, slot_start, slot_end, meet_link, event_id),
            )
            connection.commit()
            return True
        except sqlite3.IntegrityError:
            return False


def get_interview(job_id: str, resume_id: str) -> Dict[str, Any] | None:
    with _get_connection() as connection:
        row = connection.execute(
            """
            SELECT job_id, resume_id, client_email, freelancer_email, slot_start, slot_end,
                   COALESCE(meet_link, '') AS meet_link,
                   COALESCE(event_id, '') AS event_id,
                   status, created_at
            FROM interviews
            WHERE job_id = ? AND resume_id = ?
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (job_id, resume_id),
        ).fetchone()
    if not row:
        return None
    return {
        "job_id": row["job_id"],
        "resume_id": row["resume_id"],
        "client_email": row["client_email"],
        "freelancer_email": row["freelancer_email"],
        "slot_start": row["slot_start"],
        "slot_end": row["slot_end"],
        "meet_link": row["meet_link"],
        "event_id": row["event_id"],
        "status": row["status"],
        "created_at": row["created_at"],
    }


def get_freelancer_by_resume_id(resume_id: str) -> Dict[str, Any] | None:
    profiles = list_freelancer_profiles(limit=1000)
    for p in profiles:
        if p["resume_id"] == resume_id:
            return p
    return None


def create_application(
    *,
    application_id: str,
    job_id: str,
    resume_id: str,
    client_email: str,
    freelancer_email: str,
) -> bool:
    with _get_connection() as connection:
        try:
            connection.execute(
                """
                INSERT INTO applications (application_id, job_id, resume_id, client_email, freelancer_email, status)
                VALUES (?, ?, ?, ?, ?, 'applied')
                """,
                (application_id, job_id, resume_id, client_email, freelancer_email),
            )
            connection.commit()
            return True
        except sqlite3.IntegrityError:
            return False


def update_application_status(application_id: str, status: str) -> bool:
    with _get_connection() as connection:
        cur = connection.execute(
            """
            UPDATE applications
            SET status=?, updated_at=datetime('now')
            WHERE application_id=?
            """,
            (status, application_id),
        )
        connection.commit()
        return cur.rowcount > 0


def list_applications_for_freelancer(freelancer_email: str) -> List[Dict[str, Any]]:
    normalized = str(freelancer_email or "").strip().lower()
    if not normalized:
        return []
    with _get_connection() as connection:
        rows = connection.execute(
            """
            SELECT application_id, job_id, resume_id, client_email, freelancer_email, status, created_at, updated_at
            FROM applications
            WHERE lower(trim(freelancer_email)) = ?
            ORDER BY created_at DESC
            """,
            (normalized,),
        ).fetchall()
    return [
        {
            "application_id": row["application_id"],
            "job_id": row["job_id"],
            "resume_id": row["resume_id"],
            "client_email": row["client_email"],
            "freelancer_email": row["freelancer_email"],
            "status": row["status"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]


def list_applications_for_client(client_email: str) -> List[Dict[str, Any]]:
    normalized = str(client_email or "").strip().lower()
    if not normalized:
        return []
    with _get_connection() as connection:
        rows = connection.execute(
            """
            SELECT application_id, job_id, resume_id, client_email, freelancer_email, status, created_at, updated_at
            FROM applications
            WHERE lower(trim(client_email)) = ?
            ORDER BY created_at DESC
            """,
            (normalized,),
        ).fetchall()
    return [
        {
            "application_id": row["application_id"],
            "job_id": row["job_id"],
            "resume_id": row["resume_id"],
            "client_email": row["client_email"],
            "freelancer_email": row["freelancer_email"],
            "status": row["status"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]

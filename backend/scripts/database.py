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
                is_live INTEGER NOT NULL DEFAULT 0,
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
                status TEXT NOT NULL DEFAULT 'scheduled',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(job_id, resume_id, slot_start)
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


def list_jobs(limit: int = 50, q: str = "", live_only: bool = True) -> List[Dict[str, Any]]:
    safe_limit = max(1, min(limit, 200))
    query = (q or "").strip().lower()
    with _get_connection() as connection:
        sql = """
            SELECT job_id, client_name, client_email, client_whatsapp, description,
                   required_skills_json, min_experience_years, is_live, created_at, updated_at
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
                "is_live": bool(row_d.get("is_live", 0)),
                "created_at": row_d.get("created_at", ""),
                "updated_at": row_d.get("updated_at", ""),
            }
        )
    return jobs


def create_job(
    *,
    job_id: str,
    client_name: str,
    client_email: str = "",
    client_whatsapp: str = "",
    description: str,
    required_skills: List[str],
    min_experience_years: int = 0,
    is_live: bool = False,
) -> None:
    with _get_connection() as connection:
        connection.execute(
            """
            INSERT INTO jobs (job_id, client_name, client_email, client_whatsapp, description, required_skills_json, min_experience_years, is_live)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(job_id) DO UPDATE SET
                client_name=excluded.client_name,
                client_email=excluded.client_email,
                client_whatsapp=excluded.client_whatsapp,
                description=excluded.description,
                required_skills_json=excluded.required_skills_json,
                min_experience_years=excluded.min_experience_years,
                is_live=excluded.is_live,
                updated_at=datetime('now')
            """,
            (job_id, client_name, client_email, client_whatsapp, description, json.dumps(required_skills), min_experience_years, 1 if is_live else 0),
        )
        connection.commit()


def set_job_live(job_id: str, is_live: bool) -> bool:
    with _get_connection() as connection:
        cur = connection.execute("UPDATE jobs SET is_live=?, updated_at=datetime('now') WHERE job_id=?", (1 if is_live else 0, job_id))
        connection.commit()
        return cur.rowcount > 0


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
        "is_live": bool(row_d.get("is_live", 0)),
        "created_at": row_d.get("created_at", ""),
        "updated_at": row_d.get("updated_at", ""),
    }


def schedule_interview(job_id: str, resume_id: str, client_email: str, freelancer_email: str, slot_start: str, slot_end: str) -> bool:
    with _get_connection() as connection:
        try:
            connection.execute(
                """
                INSERT INTO interviews (job_id, resume_id, client_email, freelancer_email, slot_start, slot_end)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (job_id, resume_id, client_email, freelancer_email, slot_start, slot_end),
            )
            connection.commit()
            return True
        except sqlite3.IntegrityError:
            return False


def get_freelancer_by_resume_id(resume_id: str) -> Dict[str, Any] | None:
    profiles = list_freelancer_profiles(limit=1000)
    for p in profiles:
        if p["resume_id"] == resume_id:
            return p
    return None

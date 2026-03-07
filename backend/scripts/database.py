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
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        try:
            connection.execute("ALTER TABLE freelancers ADD COLUMN experience_months INTEGER NOT NULL DEFAULT 0")
        except sqlite3.OperationalError:
            # Column already exists for upgraded databases.
            pass
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
) -> None:
    with _get_connection() as connection:
        connection.execute(
            """
            INSERT INTO freelancers (
                resume_id, name, email, headline, bio, experience_years,
                experience_months,
                skills_json, resume_text, embedding_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            ),
        )
        connection.commit()


def load_freelancer_records() -> List[Dict[str, Any]]:
    with _get_connection() as connection:
        rows = connection.execute(
            """
            SELECT resume_id, name, email, headline, bio, experience_years, experience_months, skills_json, resume_text, embedding_json
            FROM freelancers
            ORDER BY created_at ASC
            """
        ).fetchall()

    records: List[Dict[str, Any]] = []
    for row in rows:
        try:
            skills = json.loads(row["skills_json"]) if row["skills_json"] else []
        except json.JSONDecodeError:
            skills = []
        try:
            embedding = json.loads(row["embedding_json"]) if row["embedding_json"] else []
        except json.JSONDecodeError:
            embedding = []

        records.append(
            {
                "resume_id": row["resume_id"],
                "name": row["name"],
                "email": row["email"],
                "headline": row["headline"],
                "bio": row["bio"],
                "experience_years": int(row["experience_years"] or 0),
                "experience_months": int(row["experience_months"] or 0),
                "skills": skills if isinstance(skills, list) else [],
                "resume_text": row["resume_text"],
                "embedding": embedding if isinstance(embedding, list) else [],
            }
        )
    return records


def list_freelancer_profiles(limit: int = 100) -> List[Dict[str, Any]]:
    safe_limit = max(1, min(limit, 1000))
    with _get_connection() as connection:
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
        try:
            skills = json.loads(row["skills_json"]) if row["skills_json"] else []
        except json.JSONDecodeError:
            skills = []

        profiles.append(
            {
                "resume_id": row["resume_id"],
                "name": row["name"],
                "email": row["email"],
                "headline": row["headline"],
                "bio": row["bio"],
                "experience_years": int(row["experience_years"] or 0),
                "experience_months": int(row["experience_months"] or 0),
                "skills": skills if isinstance(skills, list) else [],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
        )
    return profiles

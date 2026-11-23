"""Run the Nexcruit pilot and guided demo on a single origin."""
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from hiring import ROLES, SCHEMA, hiring_action

ROOT = Path(__file__).resolve().parent
DB = os.environ.get("NEXCRUIT_DB", str(ROOT / "workspace.sqlite3"))
STAGES = ("Applied", "Interview", "Hired", "Closed")
SESSION_AGE = 8 * 60 * 60


def digest(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 600_000)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT.parent / "hrms-ai-demo"), **kwargs)

    def do_GET(self):
        if self.path == "/product/":
            return self.send_file(ROOT / "index.html", "text/html; charset=utf-8")
        if self.path == "/product/app.js":
            return self.send_file(ROOT / "app.js", "text/javascript; charset=utf-8")
        if self.path in ("/product/api/records", "/product/api/hiring"):
            return self.api()
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/product/api/"):
            return self.api()
        self.send_error(404)

    def send_file(self, path, content_type):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.end_headers()
        self.wfile.write(path.read_bytes())

    def reply(self, status, data, cookie=None):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        if cookie is not None:
            secure = "; Secure" if os.environ.get("NEXCRUIT_HTTPS") == "1" else ""
            age = SESSION_AGE if cookie else 0
            self.send_header("Set-Cookie", f"nexcruit={cookie}; Path=/product/; HttpOnly; SameSite=Strict; Max-Age={age}{secure}")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def api(self):
        try:
            if self.command == "POST":
                if self.headers.get_content_type() != "application/json":
                    return self.reply(415, {"error": "Send JSON."})
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 8192:
                    return self.reply(413, {"error": "Invalid request size."})
                data = json.loads(self.rfile.read(length))
                if not isinstance(data, dict):
                    raise ValueError()
            else:
                data = {}
            with sqlite3.connect(DB) as db:
                status, result, cookie = self.action(db, data)
            return self.reply(status, result, cookie)
        except (AttributeError, TypeError, ValueError):
            return self.reply(400, {"error": "Check the submitted fields."})
        except sqlite3.IntegrityError:
            return self.reply(409, {"error": "That record already exists."})

    def action(self, db, data):
        endpoint = self.path.rsplit("/", 1)[-1]
        if endpoint in ("register", "login"):
            name = data.get("username", "").strip().lower()
            password = data.get("password", "")
            if not (3 <= len(name) <= 64 and name.isascii() and name.isalnum() and 12 <= len(password) <= 128):
                raise ValueError()
            if endpoint == "register":
                role = data.get("role", "job seeker")
                if role not in ROLES:
                    raise ValueError()
                salt = secrets.token_bytes(16)
                db.execute("INSERT INTO users VALUES (?, ?, ?)", (name, salt, digest(password, salt)))
                db.execute("INSERT INTO user_roles VALUES (?, ?)", (name, role))
            else:
                row = db.execute("SELECT salt, digest FROM users WHERE name=?", (name,)).fetchone()
                salt = row[0] if row else bytes(16)
                candidate = digest(password, salt)
                if not row or not hmac.compare_digest(candidate, row[1]):
                    return 401, {"error": "Invalid credentials."}, None
            token = secrets.token_urlsafe(32)
            db.execute("DELETE FROM sessions WHERE expires <= unixepoch()")
            db.execute("INSERT INTO sessions VALUES (?, ?, unixepoch() + ?)",
                       (hashlib.sha256(token.encode()).hexdigest(), name, SESSION_AGE))
            return 200, {"username": name}, token

        cookies = SimpleCookie(self.headers.get("Cookie", ""))
        token = cookies["nexcruit"].value if "nexcruit" in cookies else ""
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        row = db.execute("SELECT username FROM sessions WHERE token=? AND expires>unixepoch()", (token_hash,)).fetchone()
        if not row:
            return 401, {"error": "Sign in to continue."}, None
        owner = row[0]
        if endpoint == "logout":
            db.execute("DELETE FROM sessions WHERE token=?", (token_hash,))
            return 200, {}, ""
        if endpoint in ("hiring", "publish", "apply", "invite", "accept", "feedback", "decide"):
            return hiring_action(db, owner, endpoint, data)
        role = db.execute("SELECT role FROM user_roles WHERE username=?", (owner,)).fetchone()
        if role and role[0] != "hiring expert":
            return 403, {"error": "Employee records are available to hiring experts."}, None
        if endpoint == "create":
            role = data.get("role", "").strip()
            reference = data.get("reference", "").strip()
            if not role or len(role) > 120 or not reference or len(reference) > 32:
                raise ValueError()
            db.execute("INSERT INTO records(owner, role, reference) VALUES (?, ?, ?)", (owner, role, reference))
        elif endpoint == "update":
            stage = data.get("stage")
            onboarding = data.get("onboarding")
            checkin = data.get("checkin", "").strip()
            if stage not in STAGES or type(onboarding) is not bool or len(checkin) > 600:
                raise ValueError()
            if stage != "Hired":
                onboarding, checkin = False, ""
            updated = db.execute(
                "UPDATE records SET stage=?, onboarding=?, checkin=? WHERE id=? AND owner=?",
                (stage, onboarding, checkin, data.get("id"), owner))
            if not updated.rowcount:
                return 404, {"error": "Record unavailable."}, None
        elif endpoint != "records":
            return 404, {"error": "Unknown endpoint."}, None
        db.row_factory = sqlite3.Row
        records = db.execute(
            "SELECT id, role, reference, stage, onboarding, checkin FROM records WHERE owner=? ORDER BY id DESC", (owner,))
        return 200, {"username": owner, "records": [dict(record) for record in records]}, None


if __name__ == "__main__":
    with sqlite3.connect(DB) as database:
        database.executescript(SCHEMA)
        database.executescript("""
        CREATE TABLE IF NOT EXISTS users(name TEXT PRIMARY KEY, salt BLOB, digest BLOB);
        CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, username TEXT, expires INTEGER);
        CREATE TABLE IF NOT EXISTS records(
            id INTEGER PRIMARY KEY, owner TEXT, role TEXT, reference TEXT,
            stage TEXT DEFAULT 'Applied', onboarding INTEGER DEFAULT 0, checkin TEXT DEFAULT '',
            UNIQUE(owner, reference)
        );
        """)
    ThreadingHTTPServer((os.environ.get("HOST", "127.0.0.1"), int(os.environ.get("PORT", "8766"))), Handler).serve_forever()

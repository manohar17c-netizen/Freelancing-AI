from __future__ import annotations

import os
import secrets
import urllib.parse
from typing import Dict, Optional

from fastapi import APIRouter, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse

AUTH_COOKIE = "freelancing_auth"

auth_router = APIRouter(prefix="/auth", tags=["auth"])

_user_sessions: Dict[str, Dict[str, str]] = {}
_pending_oauth_states: Dict[str, Dict[str, str]] = {}


def get_authenticated_user(request: Request) -> Optional[Dict[str, str]]:
    token = request.cookies.get(AUTH_COOKIE)
    if not token:
        return None
    return _user_sessions.get(token)


def _build_login_page(next_url: str) -> str:
    safe_next = urllib.parse.quote(next_url, safe="/")
    return f"""
    <!DOCTYPE html>
    <html lang=\"en\">
    <head>
      <meta charset=\"UTF-8\" />
      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
      <title>Developer Login</title>
      <style>
        body {{ font-family: Inter, system-ui, sans-serif; margin:0; min-height:100vh; display:grid; place-items:center; background:#020617; color:#f8fafc; }}
        main {{ width:min(560px,92vw); background:#1e293b; border:1px solid #334155; border-radius:14px; padding:1.5rem; }}
        h1 {{ margin-top:0; }}
        p {{ color:#cbd5e1; }}
        .actions {{ display:grid; gap:0.8rem; margin-top:1rem; }}
        a {{ text-decoration:none; text-align:center; padding:0.8rem; border-radius:10px; font-weight:700; color:#082f49; background:linear-gradient(110deg, #0891b2, #22d3ee); }}
      </style>
    </head>
    <body>
      <main>
        <h1>Sign in as a developer</h1>
        <p>Use Google or Apple to continue. Once signed in, you will be redirected to resume upload.</p>
        <div class=\"actions\">
          <a href=\"/auth/start/google?next={safe_next}\">Continue with Google</a>
          <a href=\"/auth/start/apple?next={safe_next}\">Continue with Apple</a>
        </div>
      </main>
    </body>
    </html>
    """


def _build_mock_provider_page(provider: str, next_url: str) -> str:
    safe_next = urllib.parse.quote(next_url, safe="/")
    pretty = provider.capitalize()
    return f"""
    <!DOCTYPE html>
    <html lang=\"en\">
    <head>
      <meta charset=\"UTF-8\" />
      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
      <title>{pretty} Login</title>
      <style>
        body {{ font-family: Inter, system-ui, sans-serif; margin:0; min-height:100vh; display:grid; place-items:center; background:#020617; color:#f8fafc; }}
        main {{ width:min(560px,92vw); background:#1e293b; border:1px solid #334155; border-radius:14px; padding:1.5rem; }}
        input {{ width:100%; margin-bottom:0.8rem; border-radius:8px; padding:0.65rem; background:#334155; border:1px solid #475569; color:#f8fafc; box-sizing:border-box; }}
        button {{ width:100%; padding:0.8rem; border:none; border-radius:10px; font-weight:700; cursor:pointer; color:#082f49; background:linear-gradient(110deg,#0891b2,#22d3ee); }}
      </style>
    </head>
    <body>
      <main>
        <h1>{pretty} Sign-in (Local Mock)</h1>
        <p>No OAuth keys configured, so this local consent screen simulates provider authentication.</p>
        <form method=\"post\" action=\"/auth/mock-consent/{provider}?next={safe_next}\">
          <input name=\"name\" placeholder=\"Your full name\" required />
          <input name=\"email\" type=\"email\" placeholder=\"you@example.com\" required />
          <button type=\"submit\">Complete sign-in</button>
        </form>
      </main>
    </body>
    </html>
    """


@auth_router.get("/login", response_class=HTMLResponse)
def login_page(next: str = "/ui/resume") -> str:
    return _build_login_page(next)


@auth_router.get("/start/{provider}")
def start_login(provider: str, next: str = "/ui/resume"):
    provider = provider.lower()
    if provider not in {"google", "apple"}:
        raise HTTPException(status_code=404, detail="Provider not supported")

    state = secrets.token_urlsafe(16)
    _pending_oauth_states[state] = {"provider": provider, "next": next}

    if provider == "google" and os.getenv("GOOGLE_CLIENT_ID"):
        params = {
            "client_id": os.environ["GOOGLE_CLIENT_ID"],
            "redirect_uri": os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/callback/google"),
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
        }
        return RedirectResponse("https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params))

    if provider == "apple" and os.getenv("APPLE_CLIENT_ID"):
        params = {
            "client_id": os.environ["APPLE_CLIENT_ID"],
            "redirect_uri": os.getenv("APPLE_REDIRECT_URI", "http://localhost:8000/auth/callback/apple"),
            "response_type": "code",
            "scope": "name email",
            "response_mode": "query",
            "state": state,
        }
        return RedirectResponse("https://appleid.apple.com/auth/authorize?" + urllib.parse.urlencode(params))

    return RedirectResponse(f"/auth/mock-consent/{provider}?next={urllib.parse.quote(next, safe='/')}")


@auth_router.get("/mock-consent/{provider}", response_class=HTMLResponse)
def mock_consent_page(provider: str, next: str = "/ui/resume") -> str:
    provider = provider.lower()
    if provider not in {"google", "apple"}:
        raise HTTPException(status_code=404, detail="Provider not supported")
    return _build_mock_provider_page(provider, next)


@auth_router.post("/mock-consent/{provider}")
def mock_consent_submit(
    provider: str,
    name: str = Form(...),
    email: str = Form(...),
    next: str = "/ui/resume",
):
    provider = provider.lower()
    if provider not in {"google", "apple"}:
        raise HTTPException(status_code=404, detail="Provider not supported")

    session_token = secrets.token_urlsafe(24)
    _user_sessions[session_token] = {"name": name, "email": email, "provider": provider}

    response = RedirectResponse(next, status_code=302)
    response.set_cookie(AUTH_COOKIE, session_token, httponly=True, samesite="lax")
    return response


@auth_router.get("/callback/{provider}")
def oauth_callback(provider: str, state: str = "", email: str = "", name: str = ""):
    provider = provider.lower()
    pending = _pending_oauth_states.pop(state, None)
    if provider not in {"google", "apple"} or not pending:
        raise HTTPException(status_code=400, detail="Invalid OAuth callback")

    session_token = secrets.token_urlsafe(24)
    _user_sessions[session_token] = {
        "name": name or f"{provider.title()} User",
        "email": email or f"user@{provider}.login",
        "provider": provider,
    }

    response = RedirectResponse(pending["next"], status_code=302)
    response.set_cookie(AUTH_COOKIE, session_token, httponly=True, samesite="lax")
    return response

from __future__ import annotations

import json
import os
import secrets
import urllib.parse
import urllib.request
from typing import Dict, Optional

from fastapi import APIRouter, HTTPException, Request
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


def _auth_theme_styles() -> str:
    return """
      <style>
        :root {
          --bg:#f8f5ff;
          --surface:#ffffff;
          --surface-soft:#f5f0ff;
          --text:#1e1534;
          --muted:#6b5a8e;
          --brand:#6d28d9;
          --brand-strong:#5b21b6;
          --warning:#b45309;
          --border:#ddcdfb;
        }
        * { box-sizing:border-box; }
        body {
          margin:0;
          min-height:100vh;
          font-family: Inter, system-ui, sans-serif;
          background:
            radial-gradient(circle at 0% 0%, #efe7ff 0, transparent 40%),
            radial-gradient(circle at 100% 100%, #ffe8d6 0, transparent 35%),
            var(--bg);
          color:var(--text);
          display:grid;
          place-items:center;
          padding:1rem;
        }
        .card {
          width:min(700px, 96vw);
          background:var(--surface);
          border:1px solid var(--border);
          border-radius:18px;
          padding:1.4rem;
          box-shadow:0 14px 26px rgba(109,40,217,.11);
        }
        .brand { font-size:1.08rem; font-weight:800; margin:0 0 .5rem; }
        .brand span { color:var(--brand); }
        p { color:var(--muted); line-height:1.55; }
        .actions { display:grid; gap:.75rem; margin-top:1rem; }
        .btn {
          text-decoration:none;
          text-align:center;
          border-radius:12px;
          font-weight:800;
          padding:.82rem;
          border:1px solid var(--border);
          color:var(--text);
          background:var(--surface-soft);
        }
        .btn.primary {
          background:linear-gradient(100deg,var(--brand),var(--brand-strong));
          border-color:transparent;
          color:#fff;
        }
        .meta { font-size:.88rem; color:var(--muted); }
        .warn { color:var(--warning); font-weight:700; }
      </style>
    """


def _google_oauth_configured() -> bool:
    return bool(os.getenv("GOOGLE_CLIENT_ID") and os.getenv("GOOGLE_CLIENT_SECRET"))


def _google_redirect_uri(request: Request) -> str:
    configured = os.getenv("GOOGLE_REDIRECT_URI")
    if configured:
        return configured
    return str(request.url_for("oauth_callback", provider="google"))


def _build_login_page(next_url: str) -> str:
    safe_next = urllib.parse.quote(next_url, safe="/")
    return f"""
    <!DOCTYPE html>
    <html lang=\"en\">
    <head>
      <meta charset=\"UTF-8\" />
      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
      <title>Developer Login</title>
      {_auth_theme_styles()}
    </head>
    <body>
      <main class=\"card\">
        <div class=\"brand\"><span>Freelancing</span>AI</div>
        <h1>Sign in as a freelancer</h1>
        <p>Continue with your Google account. You will be redirected to Google and returned to resume onboarding.</p>
        <div class=\"actions\">
          <a class=\"btn primary\" href=\"/auth/start/google?next={safe_next}\">Continue with Google</a>
        </div>
        <p class=\"meta\">If login fails, open <code>/auth/config</code> and verify your OAuth setup.</p>
      </main>
    </body>
    </html>
    """


def _build_error_page(message: str) -> str:
    return f"""
    <!DOCTYPE html>
    <html lang=\"en\">
    <head>
      <meta charset=\"UTF-8\" />
      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
      <title>Authentication Error</title>
      {_auth_theme_styles()}
    </head>
    <body>
      <main class=\"card\">
        <div class=\"brand\"><span>Freelancing</span>AI</div>
        <h1>Authentication issue</h1>
        <p class=\"warn\">{message}</p>
        <div class=\"actions">
          <a class=\"btn primary\" href=\"/auth/login\">Try again</a>
          <a class=\"btn\" href=\"/auth/config\">Open OAuth Config Check</a>
        </div>
      </main>
    </body>
    </html>
    """


def _exchange_google_code_for_token(code: str, redirect_uri: str) -> Dict[str, str]:
    payload = urllib.parse.urlencode(
        {
            "code": code,
            "client_id": os.environ["GOOGLE_CLIENT_ID"],
            "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=12) as response:
        return json.loads(response.read().decode("utf-8"))


def _fetch_google_user_info(access_token: str) -> Dict[str, str]:
    req = urllib.request.Request(
        "https://openidconnect.googleapis.com/v1/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    with urllib.request.urlopen(req, timeout=12) as response:
        return json.loads(response.read().decode("utf-8"))


@auth_router.get("/config")
def oauth_config_check(request: Request) -> Dict[str, str | bool]:
    return {
        "google_client_id_configured": bool(os.getenv("GOOGLE_CLIENT_ID")),
        "google_client_secret_configured": bool(os.getenv("GOOGLE_CLIENT_SECRET")),
        "google_oauth_ready": _google_oauth_configured(),
        "google_redirect_uri_in_use": _google_redirect_uri(request),
        "required_google_console_redirect_uri": _google_redirect_uri(request),
    }


@auth_router.get("/login", response_class=HTMLResponse)
def login_page(next: str = "/ui/resume") -> str:
    return _build_login_page(next)


@auth_router.get("/start/{provider}")
def start_login(provider: str, request: Request, next: str = "/ui/resume"):
    provider = provider.lower()
    if provider != "google":
        raise HTTPException(status_code=404, detail="Provider not supported")

    if not _google_oauth_configured():
        return HTMLResponse(
            _build_error_page("Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."),
            status_code=503,
        )

    state = secrets.token_urlsafe(16)
    redirect_uri = _google_redirect_uri(request)
    _pending_oauth_states[state] = {"provider": provider, "next": next, "redirect_uri": redirect_uri}

    params = {
        "client_id": os.environ["GOOGLE_CLIENT_ID"],
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "include_granted_scopes": "true",
    }
    return RedirectResponse("https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params))


@auth_router.get("/callback/{provider}", response_class=HTMLResponse)
def oauth_callback(provider: str, state: str = "", code: str = "", error: str = ""):
    provider = provider.lower()
    pending = _pending_oauth_states.pop(state, None)
    if provider != "google" or not pending:
        raise HTTPException(status_code=400, detail="Invalid OAuth callback")

    if error:
        return HTMLResponse(_build_error_page(f"Provider returned error: {error}"), status_code=400)

    if not _google_oauth_configured():
        return HTMLResponse(
            _build_error_page("Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."),
            status_code=503,
        )

    if not code:
        return HTMLResponse(_build_error_page("Missing authorization code from Google callback."), status_code=400)

    try:
        token_payload = _exchange_google_code_for_token(code, pending["redirect_uri"])
        access_token = token_payload.get("access_token", "")
        if not access_token:
            return HTMLResponse(_build_error_page("Google token exchange failed: no access token."), status_code=400)
        profile = _fetch_google_user_info(access_token)
        resolved_name = profile.get("name", "Google User")
        resolved_email = profile.get("email", "user@google.login")
    except Exception as exc:  # pragma: no cover
        return HTMLResponse(_build_error_page(f"Google sign-in failed: {exc}"), status_code=400)

    session_token = secrets.token_urlsafe(24)
    _user_sessions[session_token] = {"name": resolved_name, "email": resolved_email, "provider": provider}

    response = RedirectResponse(pending["next"], status_code=302)
    response.set_cookie(AUTH_COOKIE, session_token, httponly=True, samesite="lax")
    return response


@auth_router.get("/logout")
def logout() -> RedirectResponse:
    response = RedirectResponse("/ui", status_code=302)
    response.delete_cookie(AUTH_COOKIE)
    return response

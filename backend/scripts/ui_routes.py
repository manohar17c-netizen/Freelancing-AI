from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse, HTMLResponse

ui_router = APIRouter(tags=["ui"])

ROOT_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIST_DIR = ROOT_DIR / "frontend" / "dist"


def _missing_build_response() -> HTMLResponse:
    return HTMLResponse(
        """
        <!DOCTYPE html>
        <html lang="en">
          <head><meta charset="UTF-8"><title>Frontend Build Missing</title></head>
          <body style="font-family:sans-serif;padding:2rem">
            <h1>React frontend is not built</h1>
            <p>Run these commands from <code>frontend/</code>:</p>
            <pre>npm install
npm run build</pre>
            <p>Then restart the backend server.</p>
          </body>
        </html>
        """,
        status_code=503,
    )


def _frontend_response(path: str = ""):
    if not FRONTEND_DIST_DIR.exists():
        return _missing_build_response()

    safe_path = Path(path.strip("/"))
    candidate = (FRONTEND_DIST_DIR / safe_path).resolve()
    if str(candidate).startswith(str(FRONTEND_DIST_DIR.resolve())) and candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(FRONTEND_DIST_DIR / "index.html")


@ui_router.get("/ui", response_class=HTMLResponse)
def serve_ui_root():
    return _frontend_response()


@ui_router.get("/ui/{path:path}")
def serve_ui_path(path: str):
    return _frontend_response(path)

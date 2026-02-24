#!/usr/bin/env bash

# Re-run with bash if invoked via sh.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

OS_NAME="$(uname -s 2>/dev/null || echo unknown)"
if [[ "$OS_NAME" == MINGW* || "$OS_NAME" == MSYS* || "$OS_NAME" == CYGWIN* ]]; then
  IS_WINDOWS=1
else
  IS_WINDOWS=0
fi

if [[ "$IS_WINDOWS" -eq 1 ]]; then
  PYTHON_BIN="${PYTHON_BIN:-python}"
  VENV_PYTHON=".venv/Scripts/python.exe"
  LOG_FILE="${TEMP:-/tmp}/freelancing_ai_uvicorn.log"
else
  PYTHON_BIN="${PYTHON_BIN:-python3}"
  VENV_PYTHON=".venv/bin/python"
  LOG_FILE="/tmp/freelancing_ai_uvicorn.log"
fi

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "Error: $PYTHON_BIN not found. Install Python 3.10+ first."
  exit 1
fi

"$PYTHON_BIN" -m venv .venv --system-site-packages

"$VENV_PYTHON" -m pip install --upgrade pip || true
"$VENV_PYTHON" -m pip install fastapi uvicorn python-multipart requests || true
"$VENV_PYTHON" -m pip install sentence-transformers || true

"$VENV_PYTHON" - <<'PY'
import importlib.util
required = ["fastapi", "uvicorn", "multipart", "requests"]
missing = [pkg for pkg in required if importlib.util.find_spec(pkg) is None]
if missing:
    raise SystemExit(f"Missing required packages in venv: {missing}")
PY

"$VENV_PYTHON" -m uvicorn main:app --host 127.0.0.1 --port 8000 > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

cleanup() {
  if kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

healthy=0
for _ in {1..30}; do
  if curl -sf http://127.0.0.1:8000/ >/dev/null; then
    healthy=1
    break
  fi
  sleep 1
done

if [[ "$healthy" -ne 1 ]]; then
  echo "Server failed to start. Check log: $LOG_FILE"
  exit 1
fi

"$VENV_PYTHON" scripts/test_api.py

echo ""
echo "Setup + run + API test completed successfully."
if [[ "$IS_WINDOWS" -eq 1 ]]; then
  echo "To run manually later:"
  echo "  .venv\\Scripts\\activate"
  echo "  .venv\\Scripts\\python -m uvicorn main:app --reload --port 8000"
else
  echo "To run manually later:"
  echo "  source .venv/bin/activate"
  echo "  uvicorn main:app --reload --port 8000"
fi

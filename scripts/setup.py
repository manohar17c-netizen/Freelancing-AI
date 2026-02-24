from __future__ import annotations

import importlib.util
import os
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

ROOT_DIR = Path(__file__).resolve().parents[1]
VENV_DIR = ROOT_DIR / ".venv"
IS_WINDOWS = os.name == "nt"
PYTHON_BIN = os.environ.get("PYTHON_BIN", "python" if IS_WINDOWS else "python3")


def run(cmd: list[str], check: bool = True) -> int:
    print("+", " ".join(cmd))
    result = subprocess.run(cmd, cwd=ROOT_DIR)
    if check and result.returncode != 0:
        raise SystemExit(result.returncode)
    return result.returncode


def wait_for_health(url: str, retries: int = 30, delay_s: int = 1) -> bool:
    for _ in range(retries):
        try:
            with urlopen(url, timeout=2) as response:
                if response.status == 200:
                    return True
        except URLError:
            time.sleep(delay_s)
    return False


def find_missing_packages() -> list[str]:
    required = ["fastapi", "uvicorn", "multipart", "requests"]
    return [pkg for pkg in required if importlib.util.find_spec(pkg) is None]


def main() -> None:
    run([PYTHON_BIN, "--version"])
    run([PYTHON_BIN, "-m", "venv", str(VENV_DIR), "--system-site-packages"])

    venv_python = VENV_DIR / ("Scripts/python.exe" if IS_WINDOWS else "bin/python")

    run([str(venv_python), "-m", "pip", "install", "--upgrade", "pip"], check=False)
    run([str(venv_python), "-m", "pip", "install", "fastapi", "uvicorn", "python-multipart", "requests"], check=False)
    run([str(venv_python), "-m", "pip", "install", "sentence-transformers"], check=False)

    missing = find_missing_packages()
    if missing:
        raise SystemExit(f"Missing required packages: {missing}. Install them manually in this environment.")

    log_file = Path(tempfile.gettempdir()) / "freelancing_ai_uvicorn.log"
    with log_file.open("w", encoding="utf-8") as log:
        process = subprocess.Popen(
            [str(venv_python), "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"],
            cwd=ROOT_DIR,
            stdout=log,
            stderr=log,
        )

    try:
        if not wait_for_health("http://127.0.0.1:8000/"):
            raise SystemExit(f"Server failed to start. Check log: {log_file}")

        run([str(venv_python), "scripts/test_api.py"])

        print("\nSetup + run + API test completed successfully.")
        if IS_WINDOWS:
            print("To run manually later:")
            print("  .venv\\Scripts\\Activate.ps1")
            print("  uvicorn main:app --reload --port 8000")
        else:
            print("To run manually later:")
            print("  source .venv/bin/activate")
            print("  uvicorn main:app --reload --port 8000")
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()


if __name__ == "__main__":
    main()

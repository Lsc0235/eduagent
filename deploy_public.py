#!/usr/bin/env python3
"""
EduAgent Public Deploy
Backend(8001) + Frontend(5173) via single ngrok tunnel
Backend serves frontend dist files directly.
"""
import subprocess
import sys
import time
import os
import threading
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = Path(__file__).parent
BACKEND = ROOT / "eduagent" / "backend"
FRONTEND = ROOT / "eduagent" / "frontend"
DIST = FRONTEND / "dist"
PYTHON = sys.executable

print("=" * 50)
print("  EduAgent Public Deploy")
print("=" * 50)

# ---- Step 1: Build frontend ----
print("\n[1/3] Building frontend ...")
import shutil
npm = shutil.which("npm") or shutil.which("npm.cmd")
if npm:
    # Always rebuild to include latest changes
    subprocess.run([npm, "run", "build"], cwd=str(FRONTEND), check=True)
    print("      Frontend built.")
else:
    print("      [WARN] npm not found, skipping build.")

# ---- Step 2: Start backend (serves API + frontend static files) ----
print("\n[2/3] Starting backend on port 8001 ...")

# Make sure main.py has static file serving
main_py = BACKEND / "app" / "main.py"
main_content = main_py.read_text(encoding="utf-8")

# Check if static serving is already added
if "FRONTEND_DIST" not in main_content:
    # Add static file serving at the end of main.py
    static_code = '''


# ===== Static file serving for public deployment =====
import os as _os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

_FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"
if _FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=str(_FRONTEND_DIST / "assets")), name="static-assets")

    @app.get("/")
    async def _serve_index():
        return FileResponse(str(_FRONTEND_DIST / "index.html"))

    @app.get("/{full_path:path}")
    async def _serve_spa(full_path: str):
        fp = _FRONTEND_DIST / full_path
        if fp.is_file():
            return FileResponse(str(fp))
        return FileResponse(str(_FRONTEND_DIST / "index.html"))
'''
    main_content += static_code
    main_py.write_text(main_content, encoding="utf-8")
    print("      Added static file serving to main.py")
else:
    print("      Static serving already configured.")

backend_proc = subprocess.Popen(
    [PYTHON, "-m", "uvicorn", "app.main:app",
     "--host", "0.0.0.0", "--port", "8001"],
    cwd=str(BACKEND),
    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
)
print("      Backend started (pid: %d)" % backend_proc.pid)
time.sleep(5)

# ---- Step 3: Start ngrok on port 8001 only ----
print("\n[3/3] Starting ngrok tunnel ...")
try:
    from pyngrok import ngrok

    ngrok.set_auth_token("3FDFhVCxS9DE88NFw9liOTlkWs8_4BpJNCRAUuESUxiQDmjS4")

    tunnel = ngrok.connect(8001, "http")
    url = tunnel.public_url

    print()
    print("=" * 50)
    print("  PUBLIC URL (share this):")
    print("  %s" % url)
    print()
    print("  LOCAL URL:")
    print("  http://127.0.0.1:8001")
    print("=" * 50)
    print()
    print("  Send the PUBLIC URL to anyone.")
    print("  Press Ctrl+C to stop.")
    print()

    while True:
        time.sleep(1)

except KeyboardInterrupt:
    print("\nStopping ...")
    ngrok.kill()
    backend_proc.terminate()
    print("All services stopped.")
except Exception as e:
    print("\n[ERROR] %s" % str(e))
    backend_proc.terminate()
    input("Press Enter to exit ...")

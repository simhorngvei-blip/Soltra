@echo off
REM ─────────────────────────────────────────────────────────────
REM  Soltra — Start All Local Services (Windows)
REM  Run this file by double-clicking it or running it in a terminal.
REM  It opens 3 separate terminal windows for each service.
REM ─────────────────────────────────────────────────────────────

echo Starting Soltra Local Services...
echo.

REM ── 1. SaaS (Next.js) ────────────────────────────────────────
echo [1/3] Starting SaaS on http://localhost:3000 ...
start "Soltra SaaS" cmd /k "cd /d %~dp0software\soltra-saas && npm run dev"

REM ── 2. Dashboard (Vite) ──────────────────────────────────────
echo [2/3] Starting Dashboard on http://localhost:5174 ...
start "Soltra Dashboard" cmd /k "cd /d %~dp0software\soltra-dashboard && npm run dev"

REM ── 3. TTS (Python FastAPI) ──────────────────────────────────
echo [3/3] Starting TTS Server on http://localhost:8099 ...
start "Soltra TTS" cmd /k "cd /d %~dp0software\soltra-tts && python server.py"

echo.
echo ✅ All services starting!
echo.
echo    SaaS:       http://localhost:3000
echo    Dashboard:  http://localhost:5174
echo    TTS Server: http://localhost:8099
echo.
echo Close the individual terminal windows to stop each service.
pause

# ============================================================
#  Soltra — Local Stack Launcher
#  Double-click this file (or run in PowerShell) to start
#  the entire Soltra development environment with one command.
#
#  What this starts:
#    [1] Supabase local stack   → http://localhost:54323 (Studio)
#    [2] Next.js SaaS           → http://localhost:3000
#    [3] Vite Dashboard         → http://localhost:5174
#    [4] Vite HUD               → http://localhost:5173  (optional)
#    [5] Python TTS server      → http://localhost:8099
#
#  Requirements (one-time install — see SETUP.md):
#    - Node.js 18+  (nodejs.org)
#    - Python 3.10+ (python.org)
#    - Supabase CLI  (npm install -g supabase)
#    - Docker Desktop (running — needed for Supabase local)
# ============================================================

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot  # D:\Soltra

# ─── Colour helpers ────────────────────────────────────────────────────────────
function Write-Header {
  Write-Host ""
  Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
  Write-Host "  ║         SOLTRA LOCAL STACK LAUNCHER          ║" -ForegroundColor Cyan
  Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor Cyan
  Write-Host ""
}

function Write-Step($n, $label) {
  Write-Host "  [$n] $label" -ForegroundColor Yellow
}

function Write-OK($msg) {
  Write-Host "      ✓ $msg" -ForegroundColor Green
}

function Write-Warn($msg) {
  Write-Host "      ⚠ $msg" -ForegroundColor DarkYellow
}

function Write-Fail($msg) {
  Write-Host "      ✗ $msg" -ForegroundColor Red
}

# ─── Prerequisite checks ───────────────────────────────────────────────────────
function Test-Command($cmd) {
  return (Get-Command $cmd -ErrorAction SilentlyContinue) -ne $null
}

Write-Header

Write-Host "  Checking prerequisites..." -ForegroundColor Gray

if (-not (Test-Command "node")) {
  Write-Fail "Node.js is not installed. Download from: https://nodejs.org"
  Read-Host "  Press Enter to exit"
  exit 1
}
Write-OK "Node.js $(node --version)"

if (-not (Test-Command "python")) {
  Write-Fail "Python is not installed. Download from: https://python.org"
  Read-Host "  Press Enter to exit"
  exit 1
}
Write-OK "Python $(python --version)"

# Check Docker for Supabase local
$dockerRunning = $false
if (Test-Command "docker") {
  try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -eq 0) { $dockerRunning = $true }
  } catch {}
}

if (-not $dockerRunning) {
  Write-Warn "Docker is not running. Supabase local stack will be SKIPPED."
  Write-Host "        Start Docker Desktop if you want a local Supabase." -ForegroundColor Gray
}

# ─── Paths ────────────────────────────────────────────────────────────────────
$SAAS_DIR      = Join-Path $ROOT "software\soltra-saas"
$DASH_DIR      = Join-Path $ROOT "software\soltra-dashboard"
$HUD_DIR       = Join-Path $ROOT "software\soltra-hud"
$TTS_DIR       = Join-Path $ROOT "software\soltra-tts"

# ─── Detect Python venv ────────────────────────────────────────────────────────
# Looks for a venv in soltra-tts/.venv or soltra-tts/venv (both are common names)
$venvPython = $null
$venvPaths = @(
  (Join-Path $TTS_DIR ".venv\Scripts\python.exe"),
  (Join-Path $TTS_DIR "venv\Scripts\python.exe"),
  (Join-Path $ROOT "software\soltra-tts\.venv\Scripts\python.exe")
)
foreach ($p in $venvPaths) {
  if (Test-Path $p) { $venvPython = $p; break }
}

if (-not $venvPython) {
  Write-Warn "No Python venv found in soltra-tts. Will use system Python."
  Write-Host "        To create one: cd software\soltra-tts && python -m venv .venv" -ForegroundColor Gray
  Write-Host "        Then: .venv\Scripts\pip install -r requirements.txt" -ForegroundColor Gray
  $venvPython = "python"
}

# ─── Install npm dependencies if node_modules is missing ──────────────────────
Write-Host ""
Write-Host "  Checking npm dependencies..." -ForegroundColor Gray

foreach ($dir in @($SAAS_DIR, $DASH_DIR, $HUD_DIR)) {
  $modDir = Join-Path $dir "node_modules"
  $pkgFile = Join-Path $dir "package.json"
  if ((Test-Path $pkgFile) -and (-not (Test-Path $modDir))) {
    $name = Split-Path $dir -Leaf
    Write-Warn "$name: node_modules missing — running npm install..."
    Push-Location $dir
    npm install --silent
    Pop-Location
    Write-OK "$name dependencies installed"
  }
}

# ─── Launch services in separate windows ──────────────────────────────────────
Write-Host ""
Write-Host "  Starting services..." -ForegroundColor Gray
Write-Host ""

$jobs = @()

# [1] Supabase local
if ($dockerRunning) {
  Write-Step 1 "Supabase local stack"
  $supabaseCmd = "cd `"$SAAS_DIR`" && npx supabase start"
  $jobs += Start-Process powershell -ArgumentList "-NoExit", "-Command", $supabaseCmd `
    -WindowStyle Normal -PassThru
  Write-OK "Starting... (may take 60s on first run — Docker pulls images)"
} else {
  Write-Step 1 "Supabase local [SKIPPED — Docker not running]"
}

Start-Sleep -Milliseconds 500

# [2] Next.js SaaS
Write-Step 2 "Next.js SaaS → http://localhost:3000"
$saasCmd = "cd `"$SAAS_DIR`" && npm run dev"
$jobs += Start-Process powershell -ArgumentList "-NoExit", "-Command", $saasCmd `
  -WindowStyle Normal -PassThru
Write-OK "Launching soltra-saas on port 3000"

Start-Sleep -Milliseconds 300

# [3] Vite Dashboard
Write-Step 3 "Vite Dashboard → http://localhost:5174"
$dashCmd = "cd `"$DASH_DIR`" && npm run dev"
$jobs += Start-Process powershell -ArgumentList "-NoExit", "-Command", $dashCmd `
  -WindowStyle Normal -PassThru
Write-OK "Launching soltra-dashboard on port 5174"

Start-Sleep -Milliseconds 300

# [4] Vite HUD (optional — skip if directory doesn't exist)
if (Test-Path (Join-Path $HUD_DIR "package.json")) {
  Write-Step 4 "Vite HUD → http://localhost:5173"
  $hudCmd = "cd `"$HUD_DIR`" && npm run dev"
  $jobs += Start-Process powershell -ArgumentList "-NoExit", "-Command", $hudCmd `
    -WindowStyle Normal -PassThru
  Write-OK "Launching soltra-hud on port 5173"
} else {
  Write-Step 4 "Vite HUD [SKIPPED — package.json not found]"
}

Start-Sleep -Milliseconds 300

# [5] Python TTS server
Write-Step 5 "TTS Server → http://localhost:8099"

# Verify Kokoro model exists
$kokoroModel = Join-Path $TTS_DIR "kokoro-v1.0.onnx"
$kokoroVoices = Join-Path $TTS_DIR "voices.json"
if (-not (Test-Path $kokoroModel) -or -not (Test-Path $kokoroVoices)) {
  Write-Warn "Kokoro model files missing in software\soltra-tts\"
  Write-Host "        Expected: kokoro-v1.0.onnx and voices.json" -ForegroundColor Gray
  Write-Host "        Download from: https://github.com/thewh1teagle/kokoro-onnx/releases" -ForegroundColor Gray
}

$ttsCmd = "cd `"$TTS_DIR`" && `"$venvPython`" server.py"
$jobs += Start-Process powershell -ArgumentList "-NoExit", "-Command", $ttsCmd `
  -WindowStyle Normal -PassThru
Write-OK "Launching TTS server (Kokoro + Chatterbox) on port 8099"

# ─── Wait for services to come up then print summary ─────────────────────────
Write-Host ""
Write-Host "  Waiting for services to start..." -ForegroundColor Gray
Start-Sleep -Seconds 8

# ─── Service health checks ────────────────────────────────────────────────────
function Test-Http($url) {
  try {
    $resp = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    return $resp.StatusCode -lt 400
  } catch {
    return $false
  }
}

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║              SOLTRA LOCAL STACK — RUNNING               ║" -ForegroundColor Cyan
Write-Host "  ╠══════════════════════════════════════════════════════════╣" -ForegroundColor Cyan

$services = @(
  @{ name = "SaaS (Next.js)     "; url = "http://localhost:3000" },
  @{ name = "Dashboard (Vite)   "; url = "http://localhost:5174" },
  @{ name = "HUD (Vite)         "; url = "http://localhost:5173" },
  @{ name = "TTS Server         "; url = "http://localhost:8099/health" },
  @{ name = "Supabase Studio    "; url = "http://localhost:54323" }
)

foreach ($svc in $services) {
  $isUp = Test-Http $svc.url
  $statusIcon = if ($isUp) { "✓" } else { "○" }
  $statusColor = if ($isUp) { "Green" } else { "DarkGray" }
  $note = if (-not $isUp) { " (still starting)" } else { "" }
  Write-Host "  ║  $statusIcon  $($svc.name)  $($svc.url)$note" -ForegroundColor $statusColor
}

Write-Host "  ╠══════════════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "  ║  Press Ctrl+C in any service window to stop it          ║" -ForegroundColor Gray
Write-Host "  ║  Close ALL windows to stop the full stack               ║" -ForegroundColor Gray
Write-Host "  ╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Keep this window open as a status dashboard
Write-Host "  This window monitors the stack. Re-checking in 30s..." -ForegroundColor Gray
Write-Host "  (Close this window to exit the launcher)" -ForegroundColor Gray
Write-Host ""

# ─── Live status loop ─────────────────────────────────────────────────────────
while ($true) {
  Start-Sleep -Seconds 30
  $anyDown = $false
  foreach ($svc in $services) {
    $isUp = Test-Http $svc.url
    if (-not $isUp) {
      $anyDown = $true
      Write-Warn "$($svc.name.Trim()) appears offline: $($svc.url)"
    }
  }
  if (-not $anyDown) {
    Write-Host "  [$(Get-Date -Format 'HH:mm:ss')] All services healthy ✓" -ForegroundColor Green
  }
}

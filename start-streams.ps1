# ============================================================
# SOLTRA — Stream Startup Script
# Starts: CV backend (Flask :5000) + Proxy (:8080) + ngrok tunnel
# Run this before testing CV / Raw Stream or using TTS/Ollama.
# ============================================================

Write-Host "=== SOLTRA Stream Startup ===" -ForegroundColor Cyan

# 1. Kill any stale processes on port 5000 or 8080
$stale5000 = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
if ($stale5000) {
    Write-Host "[1/4] Killing stale process on port 5000..." -ForegroundColor Yellow
    $stale5000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
}

$stale8080 = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
if ($stale8080) {
    Write-Host "[1/4] Killing stale proxy on port 8080..." -ForegroundColor Yellow
    $stale8080 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
}
Write-Host "[1/4] Ports 5000 and 8080 are free." -ForegroundColor Green

# 2. Start CV backend in a new window
Write-Host "[2/4] Starting CV backend (Flask on :5000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'd:\Soltra\software\soltra-cv'; Write-Host '=== CV BACKEND ===' -ForegroundColor Cyan; python app.py"

Start-Sleep -Seconds 3

# 3. Start Proxy in a new window
Write-Host "[3/4] Starting Soltra Proxy (Node on :8080)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'd:\Soltra\software\soltra-proxy'; Write-Host '=== SOLTRA PROXY ===' -ForegroundColor Cyan; npm start"

Start-Sleep -Seconds 3

# 4. Check if ngrok is already running, start if not
$ngrokUp = $null
try { $ngrokUp = (Invoke-RestMethod http://localhost:4040/api/tunnels -ErrorAction Stop).tunnels } catch {}

if ($ngrokUp) {
    $url = $ngrokUp[0].public_url
    Write-Host "[4/4] ngrok already running: $url" -ForegroundColor Green
} else {
    Write-Host "[4/4] Starting ngrok tunnel on :8080..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "ngrok http --url=urology-hungry-grappling.ngrok-free.dev 8080"
    Start-Sleep -Seconds 4
    try {
        $url = (Invoke-RestMethod http://localhost:4040/api/tunnels).tunnels[0].public_url
        Write-Host "      Tunnel: $url" -ForegroundColor Green
    } catch {
        Write-Host "      Could not read ngrok URL yet - check the ngrok window." -ForegroundColor Yellow
    }
}

# 5. Summary
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " CV Backend : http://localhost:5000  " -ForegroundColor White
Write-Host " Proxy      : http://localhost:8080  " -ForegroundColor White
Write-Host " ngrok      : $url" -ForegroundColor White
Write-Host " Dashboard  : https://soltra-saas.vercel.app/dashboard/homeowner" -ForegroundColor White
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "All done. Proxy is routing Ngrok to CV, TTS, and Ollama." -ForegroundColor Green

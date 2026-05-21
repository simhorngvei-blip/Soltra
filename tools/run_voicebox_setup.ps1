$ErrorActionPreference = "Stop"

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "          PROJECT SOLTRA - Voicebox Backend Setup       " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

cd D:\voicebox

if (Test-Path "backend\venv310") {
    Write-Host "Removing partial virtual environment..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "backend\venv310" -ErrorAction SilentlyContinue
}

Write-Host "Creating Python 3.10 virtual environment..." -ForegroundColor Green
py -3.10 -m venv backend\venv310
$python = "backend\venv310\Scripts\python.exe"
$pip = "backend\venv310\Scripts\pip.exe"

Write-Host "Upgrading pip..." -ForegroundColor Green
& $python -m pip install --upgrade pip

Write-Host ""
Write-Host "Downloading PyTorch (CUDA 12.1)... This is a ~2.5GB download." -ForegroundColor Yellow
Write-Host "Do not close this window! Progress will be shown below." -ForegroundColor Yellow
Write-Host "-------------------------------------------------------"

# Using python -m pip is more robust on Windows than calling pip.exe directly
& $python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121 --default-timeout=1000

Write-Host ""
Write-Host "Installing Voicebox requirements..." -ForegroundColor Green
& $python -m pip install -r backend\requirements.txt --default-timeout=1000

Write-Host ""
Write-Host "Installing local submodules..." -ForegroundColor Green
& $python -m pip install --no-deps chatterbox-tts
& $python -m pip install --no-deps hume-tada
& $python -m pip install git+https://github.com/QwenLM/Qwen3-TTS.git
& $python -m pip install pyinstaller ruff pytest pytest-asyncio

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "Setup Complete! You can now start the optimized server:" -ForegroundColor Cyan
Write-Host "cd D:\voicebox" -ForegroundColor White
Write-Host "backend\venv310\Scripts\python.exe -m uvicorn backend.main:app --port 17493 --data-dir `"C:\Users\reine\AppData\Roaming\sh.voicebox.app`"" -ForegroundColor White
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""
Read-Host -Prompt "Press Enter to exit"

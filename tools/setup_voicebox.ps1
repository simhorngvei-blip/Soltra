$ErrorActionPreference = "Stop"
cd D:\voicebox
if (Test-Path "backend\venv310") { Remove-Item -Recurse -Force "backend\venv310" -ErrorAction SilentlyContinue }
Write-Host "Creating Python 3.10 virtual environment..."
py -3.10 -m venv backend\venv310
$python = "backend\venv310\Scripts\python.exe"
& $python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

Write-Host "Installing requirements..."
& $python -m pip install -r backend\requirements.txt

Write-Host "Installing submodules..."
& $python -m pip install --no-deps chatterbox-tts
& $python -m pip install --no-deps hume-tada
& $python -m pip install git+https://github.com/QwenLM/Qwen3-TTS.git
& $python -m pip install pyinstaller ruff pytest pytest-asyncio -q

Write-Host "Done!"

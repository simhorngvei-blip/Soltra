@echo off
:: Soltra Local Stack — Double-click to start all services
:: This wrapper allows start-local.ps1 to run without changing
:: your system's PowerShell execution policy.
PowerShell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1"
pause

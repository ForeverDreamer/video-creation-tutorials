@echo off
:: WSL 2 Requirements Checker Launcher (Auto Language Detection)
:: Double-click to run - UAC prompt will appear automatically

:: Check for admin rights and self-elevate if needed
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -Command "Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0Check-WSL2-Requirements.ps1\" -Pause' -Verb RunAs"
    exit /b
)

:: Already admin, run directly in PowerShell window
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Check-WSL2-Requirements.ps1" -Pause

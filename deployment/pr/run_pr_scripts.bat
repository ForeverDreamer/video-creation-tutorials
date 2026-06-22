@echo off
:: PR Script Runner - Launch Premiere Pro and execute ExtendScript
:: PR 脚本执行器 - 启动 Premiere Pro 并执行 ExtendScript 脚本
:: Double-click to run / 双击运行

:: Set UTF-8 encoding for Chinese display / 设置UTF-8编码支持中文显示
chcp 65001 >nul

:: Save script directory before potential UAC changes working dir
:: 保存脚本目录（UAC提升后工作目录会变为System32）
set "SCRIPT_DIR=%~dp0"

:: Prefer PowerShell 7 (pwsh), fallback to PowerShell 5 (powershell)
:: 优先使用 PowerShell 7 (pwsh)，回退到 PowerShell 5 (powershell)
where pwsh >nul 2>&1
if %errorlevel% equ 0 (
    set "PS_EXE=pwsh"
) else (
    set "PS_EXE=powershell"
)

:: Run PowerShell script / 运行PowerShell脚本
%PS_EXE% -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%run_pr_scripts.ps1"

:: Catch any errors / 捕获错误，防止窗口闪退
if %errorlevel% neq 0 (
    echo.
    echo Script exited with error code: %errorlevel%
    echo.
    pause
)

@echo off
:: WSL Configuration Recommendation Tool Launcher
:: WSL 配置推荐工具启动器
:: Double-click to run / 双击运行

:: Set UTF-8 encoding for Chinese display / 设置UTF-8编码支持中文显示
chcp 65001 >nul

:: Note: Admin rights NOT required for this script / 此脚本不需要管理员权限
:: It only reads hardware info and copies config file / 只读取硬件信息和复制配置文件

:: Run PowerShell script with execution policy bypass / 绕过执行策略运行PowerShell脚本
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Recommend-WSL-Config.ps1" -Pause

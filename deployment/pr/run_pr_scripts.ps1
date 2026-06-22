<#
.SYNOPSIS
    Execute ExtendScript (.jsx) in Premiere Pro via command line.
    通过命令行在 Premiere Pro 中执行 ExtendScript (.jsx) 脚本。

.DESCRIPTION
    Premiere Pro does not have a "File > Scripts > Run Script File" menu like After Effects.
    This script uses the "/C es.processFile" command line method to execute ExtendScript.
    Premiere Pro 没有像 After Effects 那样的"文件 > 脚本 > 运行脚本文件"菜单。
    此脚本使用 "/C es.processFile" 命令行方式执行 ExtendScript。

    Features / 功能:
    - Auto-detect Premiere Pro installation path / 自动检测 PR 安装路径
    - Check/create extendscriptprqe.txt enable file / 检查/创建脚本执行启用文件
    - Warn if PR is already running / PR 已运行时警告
    - Execute any .jsx script in the same directory / 执行同目录下的任意 .jsx 脚本
    - Auto language detection (Chinese / English) / 自动语言检测（中文/英文）
#>

# ============================================
# User Configuration - 用户配置
# ============================================
$SCRIPT_NAME = "export_clips.jsx"  # Script to execute - 要执行的脚本文件名

# ============================================
# i18n - Auto language detection / 自动语言检测
# ============================================

# Detect system language: Chinese → zh, everything else → en
# 检测系统语言：中文系统 → zh，其它语言 → en
$script:Lang = if ((Get-Culture).Name -like 'zh-*') { 'zh' } else { 'en' }

# Message dictionary / 消息字典
$script:Messages = @{
    # ---- Header ----
    'header.title'                = @{ zh = ' PR 脚本执行器'; en = ' PR Script Runner' }
    # ---- Step 1: Find PR ----
    'step1.title'                 = @{ zh = '[1/4] 正在检测 Premiere Pro 安装路径...'; en = '[1/4] Detecting Premiere Pro installation...' }
    'step1.not_found'             = @{ zh = "[ERROR] 未在 'C:\Program Files\Adobe\' 下找到 Premiere Pro"; en = "[ERROR] Premiere Pro not found in 'C:\Program Files\Adobe\'" }
    # ---- Step 2: extendscriptprqe.txt ----
    'step2.title'                 = @{ zh = '[2/4] 正在检查 ExtendScript 启用文件...'; en = '[2/4] Checking ExtendScript enable file...' }
    'step2.exists'                = @{ zh = '[OK] extendscriptprqe.txt 已存在。'; en = '[OK] extendscriptprqe.txt exists.' }
    'step2.not_found'             = @{ zh = '[INFO] extendscriptprqe.txt 不存在，正在创建...'; en = '[INFO] extendscriptprqe.txt not found, creating...' }
    'enable.created'              = @{ zh = '     已启用 ExtendScript 命令行执行。'; en = '     ExtendScript command line execution enabled.' }
    'enable.requesting_admin'     = @{ zh = '[INFO] 正在请求管理员权限...'; en = '[INFO] Requesting administrator privileges...' }
    'enable.uac_cancelled'        = @{ zh = '[ERROR] 文件未创建（可能取消了权限请求）。'; en = '[ERROR] File was not created (UAC may have been cancelled).' }
    'enable.cannot_create'        = @{ zh = '[ERROR] 无法创建该文件，这是命令行脚本执行的必要条件。'; en = '[ERROR] Cannot create file. It is required for command line script execution.' }
    'enable.manual_hint'          = @{ zh = '  请手动在以下位置创建空文件：'; en = '  You can manually create an empty file at:' }
    # ---- Step 3: PR process check ----
    'step3.title'                 = @{ zh = '[3/4] 正在检查是否有运行中的 Premiere Pro...'; en = '[3/4] Checking for running Premiere Pro instances...' }
    'step3.already_running'       = @{ zh = '[WARNING] Premiere Pro 已在运行！'; en = '[WARNING] Premiere Pro is already running!' }
    'step3.c_explanation'         = @{ zh = '  /C 仅在启动新实例时生效，PR 已运行时命令会被忽略。'; en = '  /C only works when launching a NEW PR instance.' }
    'step3.close_prompt'          = @{ zh = '  现在关闭 Premiere Pro 吗？（未保存的修改会丢失！）'; en = '  Close Premiere Pro now? (unsaved changes will be lost!)' }
    'step3.close_yn'              = @{ zh = '  [Y] 关闭并继续 / [N] 取消  (Y/N)'; en = '  [Y] Close and continue / [N] Cancel  (Y/N)' }
    'step3.closing'               = @{ zh = '  正在关闭 Premiere Pro...'; en = '  Closing Premiere Pro...' }
    'step3.close_failed'          = @{ zh = '[ERROR] 无法关闭 Premiere Pro，请手动关闭。'; en = '[ERROR] Failed to close Premiere Pro. Please close it manually.' }
    'step3.closed'                = @{ zh = '[OK] Premiere Pro 已关闭。'; en = '[OK] Premiere Pro closed.' }
    'step3.cancelled'             = @{ zh = '  已取消。请手动关闭 PR 后重试。'; en = '  Cancelled. Please close PR manually and try again.' }
    'step3.no_instance'           = @{ zh = '[OK] 未发现运行中的 Premiere Pro 实例。'; en = '[OK] No running Premiere Pro instance found.' }
    # ---- Step 4: Locate script ----
    'step4.title'                 = @{ zh = '[4/4] 正在定位脚本文件...'; en = '[4/4] Locating script file...' }
    'step4.config_not_found'      = @{ zh = '[ERROR] config.jsx 未找到：'; en = '[ERROR] config.jsx not found:' }
    'step4.config_required'       = @{ zh = '        所有 PR 脚本都需要 config.jsx 在同一目录下。'; en = '        All PR scripts require config.jsx in the same directory.' }
    'step4.script_not_found'      = @{ zh = '[ERROR] 脚本未找到：'; en = '[ERROR] Script not found:' }
    'step4.available_scripts'     = @{ zh = '  当前目录下可用的脚本：'; en = '  Available scripts in this directory:' }
    'step4.edit_hint'             = @{ zh = "  编辑 run_pr_scripts.ps1 顶部的 `$SCRIPT_NAME 可更改目标脚本。"; en = "  Edit `$SCRIPT_NAME at the top of run_pr_scripts.ps1 to change the target script." }
    # ---- Launch ----
    'launch.title'                = @{ zh = ' 正在启动 Premiere Pro...'; en = ' Launching Premiere Pro...' }
    'launch.command'              = @{ zh = '执行命令:'; en = 'Command:' }
    'launch.started'              = @{ zh = '[OK] Premiere Pro 正在启动并执行脚本：'; en = '[OK] Premiere Pro is starting with script: ' }
    'launch.wait'                 = @{ zh = '  请等待 PR 完全加载，脚本会自动运行。'; en = '  Please wait for PR to fully load. The script will run automatically.' }
    'launch.check_window'         = @{ zh = '  请查看 PR 窗口获取执行结果。'; en = '  Check the PR window for execution results.' }
    # ---- Common ----
    'press_enter_exit'            = @{ zh = '按回车退出'; en = 'Press Enter to exit' }
    'press_enter_close'           = @{ zh = '按回车关闭此窗口'; en = 'Press Enter to close this window' }
}

function Get-Msg {
    <#
    .SYNOPSIS
        Get localized message by key. / 根据 key 获取本地化消息。
    #>
    param([string]$Key)
    $entry = $script:Messages[$Key]
    if ($entry) { return $entry[$script:Lang] }
    return $Key
}

# ============================================
# Main Logic - 主逻辑
# ============================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Find-PremiereProPath {
    <#
    .SYNOPSIS
        Auto-detect Premiere Pro installation path.
        自动检测 Premiere Pro 安装路径。
    #>
    $searchPath = "C:\Program Files\Adobe\Adobe Premiere Pro *"
    $prDirs = Get-Item $searchPath -ErrorAction SilentlyContinue | Sort-Object Name -Descending

    if (-not $prDirs) {
        return $null
    }

    # Use the latest version / 使用最新版本
    $prDir = $prDirs[0]
    $exePath = Join-Path $prDir.FullName "Adobe Premiere Pro.exe"

    if (Test-Path $exePath) {
        return @{
            Directory = $prDir.FullName
            ExePath = $exePath
            Version = $prDir.Name
        }
    }

    return $null
}

function Test-ExtendScriptEnabled {
    <#
    .SYNOPSIS
        Check if extendscriptprqe.txt exists (required for command line script execution).
        检查 extendscriptprqe.txt 是否存在（命令行脚本执行的必要条件）。
    #>
    param([string]$PrDirectory)

    $enableFile = Join-Path $PrDirectory "extendscriptprqe.txt"
    return Test-Path $enableFile
}

function Enable-ExtendScript {
    <#
    .SYNOPSIS
        Create extendscriptprqe.txt in PR installation directory.
        在 PR 安装目录下创建 extendscriptprqe.txt。
    #>
    param([string]$PrDirectory)

    $enableFile = Join-Path $PrDirectory "extendscriptprqe.txt"

    try {
        # Try to create the file directly / 尝试直接创建文件
        New-Item -Path $enableFile -ItemType File -Force -ErrorAction Stop | Out-Null
        Write-Host "[OK] Created: $enableFile" -ForegroundColor Green
        Write-Host (Get-Msg 'enable.created') -ForegroundColor Green
        return $true
    }
    catch {
        # Direct creation failed, try UAC elevation / 直接创建失败，尝试 UAC 提权
        Write-Host (Get-Msg 'enable.requesting_admin') -ForegroundColor Yellow

        try {
            # Launch elevated process to create just this one file / 提权创建单个文件
            Start-Process -FilePath powershell -ArgumentList "-Command", "New-Item -Path '$enableFile' -ItemType File -Force" -Verb RunAs -Wait -ErrorAction Stop

            # Verify file was created / 验证文件已创建
            if (Test-Path $enableFile) {
                Write-Host "[OK] Created: $enableFile" -ForegroundColor Green
                Write-Host (Get-Msg 'enable.created') -ForegroundColor Green
                return $true
            }
            else {
                Write-Host (Get-Msg 'enable.uac_cancelled') -ForegroundColor Red
                return $false
            }
        }
        catch {
            # UAC was declined or other error / 用户拒绝提权或其他错误
            Write-Host (Get-Msg 'enable.cannot_create') -ForegroundColor Red
            Write-Host ""
            Write-Host (Get-Msg 'enable.manual_hint') -ForegroundColor Yellow
            Write-Host "  $enableFile" -ForegroundColor White
            return $false
        }
    }
}

function Main {
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host (Get-Msg 'header.title') -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""

    # Step 1: Find Premiere Pro / 第一步：查找 Premiere Pro
    Write-Host (Get-Msg 'step1.title') -ForegroundColor Cyan

    $pr = Find-PremiereProPath
    if (-not $pr) {
        Write-Host (Get-Msg 'step1.not_found') -ForegroundColor Red
        Write-Host ""
        Read-Host (Get-Msg 'press_enter_exit')
        exit 1
    }

    Write-Host "[OK] Found: $($pr.Version)" -ForegroundColor Green
    Write-Host "     Path: $($pr.ExePath)" -ForegroundColor Gray
    Write-Host ""

    # Step 2: Check extendscriptprqe.txt / 第二步：检查脚本执行启用文件
    Write-Host (Get-Msg 'step2.title') -ForegroundColor Cyan

    if (Test-ExtendScriptEnabled -PrDirectory $pr.Directory) {
        Write-Host (Get-Msg 'step2.exists') -ForegroundColor Green
    }
    else {
        Write-Host (Get-Msg 'step2.not_found') -ForegroundColor Yellow

        if (-not (Enable-ExtendScript -PrDirectory $pr.Directory)) {
            Write-Host ""
            Read-Host (Get-Msg 'press_enter_exit')
            exit 1
        }
    }
    Write-Host ""

    # Step 3: Check if PR is already running / 第三步：检查 PR 是否正在运行
    Write-Host (Get-Msg 'step3.title') -ForegroundColor Cyan

    $prProcess = Get-Process -Name "Adobe Premiere Pro" -ErrorAction SilentlyContinue
    if ($prProcess) {
        Write-Host (Get-Msg 'step3.already_running') -ForegroundColor Yellow
        Write-Host ""
        Write-Host (Get-Msg 'step3.c_explanation') -ForegroundColor Yellow
        Write-Host ""
        Write-Host (Get-Msg 'step3.close_prompt') -ForegroundColor Cyan
        Write-Host ""
        $answer = Read-Host (Get-Msg 'step3.close_yn')

        if ($answer -match '^[Yy]') {
            Write-Host ""
            Write-Host (Get-Msg 'step3.closing') -ForegroundColor Yellow
            Stop-Process -Name "Adobe Premiere Pro" -Force -ErrorAction SilentlyContinue

            # Wait for process to fully exit / 等待进程完全退出
            $maxWait = 30  # 15 seconds max
            for ($i = 0; $i -lt $maxWait; $i++) {
                Start-Sleep -Milliseconds 500
                $prProcess = Get-Process -Name "Adobe Premiere Pro" -ErrorAction SilentlyContinue
                if (-not $prProcess) { break }
            }

            $prProcess = Get-Process -Name "Adobe Premiere Pro" -ErrorAction SilentlyContinue
            if ($prProcess) {
                Write-Host (Get-Msg 'step3.close_failed') -ForegroundColor Red
                Write-Host ""
                Read-Host (Get-Msg 'press_enter_exit')
                exit 1
            }
            Write-Host (Get-Msg 'step3.closed') -ForegroundColor Green
        }
        else {
            Write-Host ""
            Write-Host (Get-Msg 'step3.cancelled') -ForegroundColor Yellow
            Write-Host ""
            Read-Host (Get-Msg 'press_enter_exit')
            exit 0
        }
    }
    else {
        Write-Host (Get-Msg 'step3.no_instance') -ForegroundColor Green
    }
    Write-Host ""

    # Step 4: Locate and execute script / 第四步：定位并执行脚本
    Write-Host (Get-Msg 'step4.title') -ForegroundColor Cyan

    $scriptPath = Join-Path $ScriptDir $SCRIPT_NAME
    $configPath = Join-Path $ScriptDir "config.jsx"

    # Verify config.jsx exists / 验证 config.jsx 存在
    if (-not (Test-Path $configPath)) {
        Write-Host "$(Get-Msg 'step4.config_not_found') $configPath" -ForegroundColor Red
        Write-Host (Get-Msg 'step4.config_required') -ForegroundColor Red
        Write-Host ""
        Read-Host (Get-Msg 'press_enter_exit')
        exit 1
    }

    # Verify target script exists / 验证目标脚本存在
    if (-not (Test-Path $scriptPath)) {
        Write-Host "$(Get-Msg 'step4.script_not_found') $scriptPath" -ForegroundColor Red
        Write-Host ""
        Write-Host (Get-Msg 'step4.available_scripts') -ForegroundColor Yellow
        Get-ChildItem -Path $ScriptDir -Filter "*.jsx" | Where-Object { $_.Name -ne "config.jsx" } | ForEach-Object {
            Write-Host "    - $($_.Name)" -ForegroundColor White
        }
        Write-Host ""
        Write-Host (Get-Msg 'step4.edit_hint') -ForegroundColor Cyan
        Write-Host ""
        Read-Host (Get-Msg 'press_enter_exit')
        exit 1
    }

    Write-Host "[OK] Script: $SCRIPT_NAME" -ForegroundColor Green
    Write-Host "     Path: $scriptPath" -ForegroundColor Gray
    Write-Host ""

    # Execute / 执行
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host (Get-Msg 'launch.title') -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""

    # Build argument string / 构建参数字符串
    # Correct syntax: /C es.processFile "path" (no parentheses!)
    # 正确语法：/C es.processFile "路径"（不要括号！）
    $arguments = '/C es.processFile "' + $scriptPath + '"'
    $command = "`"$($pr.ExePath)`" $arguments"
    Write-Host "$(Get-Msg 'launch.command')" -ForegroundColor Gray
    Write-Host "  $command" -ForegroundColor White
    Write-Host ""

    # Launch PR with script / 启动 PR 并执行脚本
    Start-Process -FilePath $pr.ExePath -ArgumentList $arguments

    Write-Host "$(Get-Msg 'launch.started')$SCRIPT_NAME" -ForegroundColor Green
    Write-Host ""
    Write-Host (Get-Msg 'launch.wait') -ForegroundColor Cyan
    Write-Host (Get-Msg 'launch.check_window') -ForegroundColor Cyan
    Write-Host ""
    Read-Host (Get-Msg 'press_enter_close')
}

# Run main function / 执行主函数
Main

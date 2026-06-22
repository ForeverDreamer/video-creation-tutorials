<#
.SYNOPSIS
    WSL Configuration Recommendation Tool / WSL 配置推荐工具
.DESCRIPTION
    Automatically detects system hardware and recommends optimal .wslconfig settings.
    根据系统硬件自动推荐最优的 .wslconfig 配置。
.PARAMETER Lang
    Language for output: 'en' (English) or 'zh' (Chinese). Default: auto-detect
    输出语言：'en'（英文）或 'zh'（中文）。默认：自动检测
.PARAMETER Pause
    Keep window open after completion
    完成后保持窗口打开
.PARAMETER AutoApply
    Automatically apply recommended config without asking
    自动应用推荐配置，不询问
.EXAMPLE
    .\Recommend-WSL-Config.ps1
    .\Recommend-WSL-Config.ps1 -Lang zh
    .\Recommend-WSL-Config.ps1 -AutoApply
.NOTES
    Author: Claude Code
    Version: 1.0.2
    Last Updated: 2026-01-30

    KNOWN ISSUE 1 - Windows Terminal CJK Centering Bug:
    Windows Terminal has a bug where centered CJK text displays duplicated
    characters (e.g., "配置" becomes "配配置置").
    Workaround: Banner title/subtitle use English to avoid this bug.

    KNOWN ISSUE 2 - CJK Text Alignment:
    PowerShell's PadRight() counts characters, not display width.
    CJK characters are 2 columns wide in monospace fonts but counted as 1.
    Workaround: Use Get-DisplayWidth() + Get-PaddedString() for alignment.

    已知问题1 - Windows Terminal 中文居中Bug：
    Windows Terminal对居中中文有渲染bug，会重复显示字符。
    解决方案：横幅标题使用英文。

    已知问题2 - 中文对齐问题：
    PowerShell的PadRight()按字符数计算，中文字符显示宽度为2但算作1。
    解决方案：使用Get-DisplayWidth() + Get-PaddedString()进行对齐。
#>

param(
    [Parameter(Mandatory = $false)]
    [ValidateSet('zh', 'en')]
    [string]$Lang = '',

    [Parameter(Mandatory = $false)]
    [switch]$Pause,

    [Parameter(Mandatory = $false)]
    [switch]$AutoApply
)

# Auto-detect language if not specified / 如果未指定则自动检测语言
if (-not $Lang) {
    $culture = (Get-Culture).Name
    $Lang = if ($culture -match '^zh') { 'zh' } else { 'en' }
}

# ============================================================
# i18n Messages / 国际化消息
# ============================================================
$Messages = @{
    zh = @{
        # NOTE: Title/Subtitle use English to avoid Windows Terminal CJK centering bug
        # 注意：标题使用英文以避免Windows Terminal中文居中渲染bug（字符重复显示）
        Title              = "WSL Configuration Recommendation Tool"
        Subtitle           = "Automatically recommend optimal config based on system hardware"

        SectionSystem      = "系统硬件信息"
        SectionRecommend   = "推荐配置"
        SectionApply       = "应用配置"
        SectionSummary     = "操作结果"

        LabelPhysicalMem   = "物理内存"
        LabelCPUCores      = "CPU 核心数"
        LabelLogicalProcs  = "逻辑处理器"
        LabelDetectedTier  = "检测到的配置档位"

        Tier8GB            = "8GB 档 (轻量模式)"
        Tier16GB           = "16GB 档 (日常开发)"
        Tier32GB           = "32GB 档 (高性能开发)"
        Tier64GB           = "64GB 档 (AI/ML 训练)"

        LabelWSLMemory     = "WSL 内存"
        LabelWSLCPU        = "WSL 处理器"
        LabelSwap          = "Swap 空间"
        LabelMemReclaim    = "内存回收模式"
        LabelAllocRatio    = "资源分配比例"

        ConfigFileFound    = "配置文件已找到"
        ConfigFileNotFound = "配置文件未找到"
        ConfigFilePath     = "配置文件路径"
        TargetPath         = "目标路径"

        AskApply           = "是否应用推荐配置？"
        AskRestart         = "是否重启 WSL 使配置生效？"
        PromptYN           = "(Y/N)"

        Applying           = "正在应用配置..."
        ApplySuccess       = "配置已成功应用！"
        ApplyFailed        = "配置应用失败"
        RestartingWSL      = "正在关闭 WSL..."
        RestartSuccess     = "WSL 已关闭，下次打开时将使用新配置"
        RestartFailed      = "WSL 关闭失败"

        SkippedApply       = "已跳过配置应用"
        SkippedRestart     = "已跳过 WSL 重启"

        NoteCustom         = "如需自定义，可直接编辑配置文件"
        NoteRestart        = "修改配置后必须执行 'wsl --shutdown' 才能生效"
        NoteVerify         = "重新打开 Ubuntu，执行 'free -h' 验证配置"

        ErrorGetInfo       = "获取系统信息时出错"
        Completed          = "推荐完成"
        Timestamp          = "执行时间"
        PressAnyKey        = "按任意键关闭此窗口..."
    }
    en = @{
        Title              = "WSL Configuration Recommendation Tool"
        Subtitle           = "Automatically recommend optimal config based on system hardware"

        SectionSystem      = "System Hardware Information"
        SectionRecommend   = "Recommended Configuration"
        SectionApply       = "Apply Configuration"
        SectionSummary     = "Operation Result"

        LabelPhysicalMem   = "Physical Memory"
        LabelCPUCores      = "CPU Cores"
        LabelLogicalProcs  = "Logical Processors"
        LabelDetectedTier  = "Detected Config Tier"

        Tier8GB            = "8GB Tier (Lightweight Mode)"
        Tier16GB           = "16GB Tier (Daily Development)"
        Tier32GB           = "32GB Tier (High Performance)"
        Tier64GB           = "64GB Tier (AI/ML Training)"

        LabelWSLMemory     = "WSL Memory"
        LabelWSLCPU        = "WSL Processors"
        LabelSwap          = "Swap Space"
        LabelMemReclaim    = "Memory Reclaim Mode"
        LabelAllocRatio    = "Allocation Ratio"

        ConfigFileFound    = "Config file found"
        ConfigFileNotFound = "Config file not found"
        ConfigFilePath     = "Config file path"
        TargetPath         = "Target path"

        AskApply           = "Apply recommended configuration?"
        AskRestart         = "Restart WSL to apply changes?"
        PromptYN           = "(Y/N)"

        Applying           = "Applying configuration..."
        ApplySuccess       = "Configuration applied successfully!"
        ApplyFailed        = "Failed to apply configuration"
        RestartingWSL      = "Shutting down WSL..."
        RestartSuccess     = "WSL shutdown complete. New config will be used on next start."
        RestartFailed      = "Failed to shutdown WSL"

        SkippedApply       = "Configuration apply skipped"
        SkippedRestart     = "WSL restart skipped"

        NoteCustom         = "For customization, edit the config file directly"
        NoteRestart        = "Must run 'wsl --shutdown' after modifying config"
        NoteVerify         = "Reopen Ubuntu, run 'free -h' to verify config"

        ErrorGetInfo       = "Error retrieving system information"
        Completed          = "Recommendation complete"
        Timestamp          = "Execution time"
        PressAnyKey        = "Press any key to close this window..."
    }
}

# Select language messages / 选择语言消息
$Msg = $Messages[$Lang]

# 获取脚本目录（在脚本级别定义）- Get script directory (defined at script level)
$Script:ScriptDirectory = $PSScriptRoot
if (-not $Script:ScriptDirectory) {
    $Script:ScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
}

# ============================================================
# Helper Functions / 辅助函数
# ============================================================

# ---- CJK Text Alignment Fix / 中文对齐修复 ----
# PITFALL: PowerShell's PadRight() counts characters, not display width.
#          CJK characters display as 2 columns in monospace fonts,
#          but PadRight() counts them as 1, causing misalignment.
# SOLUTION: Use Get-DisplayWidth() + Get-PaddedString() instead of PadRight().
#
# 陷阱：PowerShell的PadRight()按字符数计算，不考虑显示宽度。
#       中文字符在等宽字体中显示为2列宽，但PadRight()算作1，导致对齐错位。
# 解决：使用Get-DisplayWidth() + Get-PaddedString()代替PadRight()。
#
# Example / 示例:
#   "物理内存".Length = 4, but displays as 8 columns wide
#   "CPU Cores".Length = 9, displays as 9 columns wide
#   PadRight(20) gives wrong alignment; Get-PaddedString -TargetWidth 20 is correct.

# Calculate display width (CJK characters count as 2) / 计算显示宽度（中文字符算2）
function Get-DisplayWidth {
    param([string]$Text)
    $width = 0
    foreach ($char in $Text.ToCharArray()) {
        $code = [int]$char
        # CJK character ranges / 中日韩字符范围
        if (($code -ge 0x4E00 -and $code -le 0x9FFF) -or   # CJK Unified Ideographs
            ($code -ge 0x3000 -and $code -le 0x303F) -or   # CJK Punctuation
            ($code -ge 0xFF00 -and $code -le 0xFFEF)) {    # Fullwidth Forms
            $width += 2
        } else {
            $width += 1
        }
    }
    return $width
}

# Pad string to target display width / 填充字符串到目标显示宽度
function Get-PaddedString {
    param([string]$Text, [int]$TargetWidth)
    $currentWidth = Get-DisplayWidth -Text $Text
    $padding = [math]::Max(0, $TargetWidth - $currentWidth)
    return $Text + (" " * $padding)
}

# Write centered banner text / 输出居中横幅文本
# WARNING: Do NOT pass CJK (Chinese/Japanese/Korean) text to this function!
# Windows Terminal has a rendering bug that duplicates centered CJK characters.
# 警告：不要传入中文文本！Windows Terminal对居中中文有渲染bug会重复显示字符。
function Write-Banner {
    param([string]$Text, [string]$Color = "Cyan")
    $width = 65
    $line = "=" * $width
    $padding = [math]::Max(0, ($width - $Text.Length) / 2)
    $paddedText = (" " * [math]::Floor($padding)) + $Text

    Write-Host ""
    Write-Host $line -ForegroundColor $Color
    Write-Host $paddedText -ForegroundColor $Color
    Write-Host $line -ForegroundColor $Color
}

function Write-Section {
    param([string]$Title)
    $titleWidth = Get-DisplayWidth -Text $Title
    Write-Host ""
    Write-Host "  [$Title]" -ForegroundColor Yellow
    Write-Host ("  " + "-" * ($titleWidth + 2)) -ForegroundColor DarkGray
}

function Write-InfoItem {
    param(
        [string]$Label,
        [string]$Value,
        [string]$Status = "info",  # pass, fail, warn, info
        [string]$Extra = ""
    )

    $icon = switch ($Status) {
        "pass" { "[OK]"; $color = "Green" }
        "fail" { "[X]"; $color = "Red" }
        "warn" { "[!]"; $color = "Yellow" }
        default { "[i]"; $color = "Cyan" }
    }

    $labelPadded = Get-PaddedString -Text $Label -TargetWidth 20
    Write-Host "    $icon " -ForegroundColor $color -NoNewline
    Write-Host "$labelPadded : " -ForegroundColor White -NoNewline
    Write-Host $Value -ForegroundColor $color -NoNewline

    if ($Extra) {
        Write-Host "  ($Extra)" -ForegroundColor DarkGray
    } else {
        Write-Host ""
    }
}

function Write-Tip {
    param([string]$Text, [string]$Type = "info")

    $icon = switch ($Type) {
        "warn"  { ">>"; $color = "Yellow" }
        "error" { "!!"; $color = "Red" }
        "success" { "->"; $color = "Green" }
        default { "->"; $color = "DarkCyan" }
    }

    Write-Host "    $icon $Text" -ForegroundColor $color
}

function Get-UserConfirmation {
    param([string]$Prompt)

    Write-Host ""
    Write-Host "    $Prompt $($Msg.PromptYN) " -ForegroundColor Cyan -NoNewline
    $response = Read-Host
    return ($response -match '^[Yy]')
}

# ============================================================
# Configuration Logic / 配置逻辑
# ============================================================

function Get-ConfigTier {
    param([int]$MemoryGB)

    if ($MemoryGB -le 8) { return "8gb" }
    elseif ($MemoryGB -le 16) { return "16gb" }
    elseif ($MemoryGB -le 32) { return "32gb" }
    else { return "64gb" }
}

function Get-TierName {
    param([string]$Tier)

    switch ($Tier) {
        "8gb"  { return $Msg.Tier8GB }
        "16gb" { return $Msg.Tier16GB }
        "32gb" { return $Msg.Tier32GB }
        "64gb" { return $Msg.Tier64GB }
    }
}

function Get-RecommendedMemory {
    param([int]$MemoryGB)

    # 动态计算推荐内存 - Calculate recommended memory dynamically
    # 策略: 为Windows保留足够内存，WSL获得剩余部分
    # Strategy: Reserve enough for Windows, WSL gets the rest

    if ($MemoryGB -le 8) {
        # 8GB及以下: 50%给WSL - 8GB or less: 50% to WSL
        return [math]::Floor($MemoryGB * 0.5)
    } elseif ($MemoryGB -le 16) {
        # 9-16GB: 保留5GB给Windows - Reserve 5GB for Windows
        return [math]::Max($MemoryGB - 5, 4)
    } elseif ($MemoryGB -le 32) {
        # 17-32GB: 保留6GB给Windows - Reserve 6GB for Windows
        return [math]::Max($MemoryGB - 6, 8)
    } else {
        # 32GB以上: 保留8GB给Windows - 32GB+: Reserve 8GB for Windows
        return [math]::Max($MemoryGB - 8, 16)
    }
}

function Get-RecommendedCPU {
    param(
        [int]$MemoryGB,
        [int]$LogicalProcs
    )

    # 基于实际硬件计算CPU推荐值 - Calculate CPU based on actual hardware
    # 微软官方默认：不限制CPU，WSL可使用所有逻辑处理器
    # Microsoft default: No CPU limit, WSL can use all logical processors

    # CPU限制：保留约15%给Windows（平衡策略）
    # CPU limit: Reserve ~15% for Windows (balanced approach)
    $cpuBasedAlloc = [math]::Floor($LogicalProcs * 0.85)

    # 确保不超过实际逻辑处理器数
    # Ensure not exceeding actual logical processors
    $recommended = [math]::Min($cpuBasedAlloc, $LogicalProcs)

    # 至少分配2核 - Allocate at least 2 cores
    return [math]::Max($recommended, 2)
}

function Get-RecommendedSwap {
    param([int]$MemoryGB)

    # 动态计算Swap大小 - Calculate swap size dynamically
    # 策略: 约为WSL内存的25-35%
    # Strategy: About 25-35% of WSL memory

    if ($MemoryGB -le 8) {
        return 2
    } elseif ($MemoryGB -le 16) {
        return 4
    } elseif ($MemoryGB -le 32) {
        return 10
    } else {
        return 20
    }
}

function Get-RecommendedReclaim {
    param([int]$MemoryGB)

    # 内存较小时使用更激进的回收策略 - Use more aggressive reclaim for smaller memory
    if ($MemoryGB -le 8) {
        return "dropCache"
    } else {
        return "gradual"
    }
}

function New-WslConfigContent {
    param(
        [int]$Memory,
        [int]$Processors,
        [int]$Swap,
        [int]$PhysicalMemory,
        [int]$PhysicalCores,
        [int]$LogicalProcs
    )

    # 从脚本执行目录读取模板配置 - Read template config from script directory
    $templatePath = Join-Path $Script:ScriptDirectory ".wslconfig.template"

    if (-not (Test-Path $templatePath)) {
        # 模板不存在时报错 - Error if template not found
        Write-Host ""
        Write-Host "    [!] Template not found: $templatePath" -ForegroundColor Red
        Write-Host "    [!] 模板文件未找到: $templatePath" -ForegroundColor Red
        Write-Host ""
        return $null
    }

    # 读取模板 - Read template
    $content = Get-Content -Path $templatePath -Raw -Encoding UTF8

    # 计算动态值 - Calculate dynamic values
    $reservedMem = $PhysicalMemory - $Memory
    $reservedCPU = $LogicalProcs - $Processors
    $memRatio = [math]::Round(($Memory / $PhysicalMemory) * 100)

    # 替换所有占位符 - Replace all placeholders
    $content = $content -replace '\{\{MEMORY\}\}', $Memory
    $content = $content -replace '\{\{PROCESSORS\}\}', $Processors
    $content = $content -replace '\{\{SWAP\}\}', $Swap
    $content = $content -replace '\{\{PHYSICAL_MEMORY\}\}', $PhysicalMemory
    $content = $content -replace '\{\{PHYSICAL_CORES\}\}', $PhysicalCores
    $content = $content -replace '\{\{LOGICAL_PROCS\}\}', $LogicalProcs
    $content = $content -replace '\{\{RESERVED_MEM\}\}', $reservedMem
    $content = $content -replace '\{\{RESERVED_CPU\}\}', $reservedCPU
    $content = $content -replace '\{\{MEM_RATIO\}\}', $memRatio

    return $content
}

# ============================================================
# Main Logic / 主逻辑
# ============================================================

# Print banner / 打印横幅
Write-Banner -Text $Msg.Title -Color "Green"
Write-Host "  $($Msg.Subtitle)" -ForegroundColor DarkGray

# ============================================================
# Section 1: System Hardware / 第1节：系统硬件
# ============================================================
Write-Section -Title $Msg.SectionSystem

try {
    $computerInfo = Get-ComputerInfo -ErrorAction Stop
    $cpuInfo = Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1

    # Physical Memory / 物理内存
    $memoryGB = [math]::Round($computerInfo.CsTotalPhysicalMemory / 1GB)
    Write-InfoItem -Label $Msg.LabelPhysicalMem -Value "${memoryGB}GB" -Status "info"

    # CPU Cores / CPU 核心数
    $cpuCores = if ($cpuInfo) { $cpuInfo.NumberOfCores } else { (Get-CimInstance Win32_ComputerSystem).NumberOfProcessors }
    Write-InfoItem -Label $Msg.LabelCPUCores -Value $cpuCores -Status "info"

    # Logical Processors / 逻辑处理器
    $logicalProcs = if ($cpuInfo) { $cpuInfo.NumberOfLogicalProcessors } else { [Environment]::ProcessorCount }
    Write-InfoItem -Label $Msg.LabelLogicalProcs -Value $logicalProcs -Status "info"

    # Determine tier / 确定配置档位
    $tier = Get-ConfigTier -MemoryGB $memoryGB
    $tierName = Get-TierName -Tier $tier

    Write-Host ""
    Write-Host "    " -NoNewline
    Write-Host "[OK] $($Msg.LabelDetectedTier): " -ForegroundColor Green -NoNewline
    Write-Host $tierName -ForegroundColor White -BackgroundColor DarkGreen

} catch {
    Write-Host "    $($Msg.ErrorGetInfo): $_" -ForegroundColor Red
    if ($Pause) {
        Write-Host ""
        Write-Host $Msg.PressAnyKey -ForegroundColor Cyan
        $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    }
    exit 1
}

# ============================================================
# Section 2: Recommended Configuration / 第2节：推荐配置
# ============================================================
Write-Section -Title $Msg.SectionRecommend

# 动态计算所有推荐值 - Calculate all recommended values dynamically
$recMemory = Get-RecommendedMemory -MemoryGB $memoryGB
$recCPU = Get-RecommendedCPU -MemoryGB $memoryGB -LogicalProcs $logicalProcs
$recSwap = Get-RecommendedSwap -MemoryGB $memoryGB

# 计算分配比例 - Calculate allocation ratio
$memoryRatio = [math]::Round(($recMemory / $memoryGB) * 100)
$cpuRatio = [math]::Round(($recCPU / $logicalProcs) * 100)
$allocRatio = "$memoryRatio% / $cpuRatio%"

Write-InfoItem -Label $Msg.LabelWSLMemory -Value "${recMemory}GB" -Status "pass"
Write-InfoItem -Label $Msg.LabelWSLCPU -Value $recCPU -Status "pass"
Write-InfoItem -Label $Msg.LabelSwap -Value "${recSwap}GB" -Status "pass"
Write-InfoItem -Label $Msg.LabelAllocRatio -Value "$allocRatio (Mem/CPU)" -Status "info"

# 生成配置内容 - Generate config content
$configContent = New-WslConfigContent -Memory $recMemory -Processors $recCPU -Swap $recSwap -PhysicalMemory $memoryGB -PhysicalCores $cpuCores -LogicalProcs $logicalProcs

# 检查模板是否加载成功 - Check if template loaded successfully
if (-not $configContent) {
    Write-Host "    Please ensure .wslconfig template exists in script directory." -ForegroundColor Yellow
    Write-Host "    请确保脚本目录中存在 .wslconfig 模板文件。" -ForegroundColor Yellow
    if ($Pause) {
        Write-Host ""
        Write-Host $Msg.PressAnyKey -ForegroundColor Cyan
        $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    }
    exit 1
}

$targetPath = Join-Path $env:USERPROFILE ".wslconfig"

Write-Host ""
Write-InfoItem -Label $Msg.TargetPath -Value $targetPath -Status "info"

# ============================================================
# Section 3: Apply Configuration / 第3节：应用配置
# ============================================================
Write-Section -Title $Msg.SectionApply

$applySuccess = $false
$restartSuccess = $false

# Ask to apply or auto-apply / 询问是否应用或自动应用
$shouldApply = $AutoApply -or (Get-UserConfirmation -Prompt $Msg.AskApply)

if ($shouldApply) {
    Write-Host ""
    Write-Tip -Text $Msg.Applying -Type "info"

    try {
        # 动态写入配置文件 - Write config file dynamically
        $configContent | Out-File -FilePath $targetPath -Encoding UTF8 -Force
        Write-Tip -Text $Msg.ApplySuccess -Type "success"
        $applySuccess = $true

        # Ask to restart WSL / 询问是否重启 WSL
        $shouldRestart = $AutoApply -or (Get-UserConfirmation -Prompt $Msg.AskRestart)

        if ($shouldRestart) {
            Write-Host ""
            Write-Tip -Text $Msg.RestartingWSL -Type "info"

            try {
                wsl --shutdown 2>$null
                Start-Sleep -Seconds 2
                Write-Tip -Text $Msg.RestartSuccess -Type "success"
                $restartSuccess = $true
            } catch {
                Write-Tip -Text "$($Msg.RestartFailed): $_" -Type "error"
            }
        } else {
            Write-Tip -Text $Msg.SkippedRestart -Type "warn"
        }

    } catch {
        Write-Tip -Text "$($Msg.ApplyFailed): $_" -Type "error"
    }
} else {
    Write-Tip -Text $Msg.SkippedApply -Type "warn"
}

# ============================================================
# Summary / 摘要
# ============================================================
Write-Section -Title $Msg.SectionSummary

Write-Host ""
if ($applySuccess) {
    Write-Host "    [OK] " -ForegroundColor Green -NoNewline
    Write-Host $Msg.ApplySuccess -ForegroundColor Green
} else {
    Write-Host "    [!] " -ForegroundColor Yellow -NoNewline
    Write-Host $Msg.SkippedApply -ForegroundColor Yellow
}

if ($restartSuccess) {
    Write-Host "    [OK] " -ForegroundColor Green -NoNewline
    Write-Host $Msg.RestartSuccess -ForegroundColor Green
}

Write-Host ""
Write-Tip -Text $Msg.NoteCustom -Type "info"
Write-Tip -Text $Msg.NoteRestart -Type "info"
Write-Tip -Text $Msg.NoteVerify -Type "info"

# Footer / 页脚
Write-Host ""
Write-Host ("=" * 65) -ForegroundColor DarkGray
Write-Host "  $($Msg.Timestamp): $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host "  $($Msg.Completed)" -ForegroundColor DarkGray
Write-Host ""

# Pause if requested / 如果需要则暂停
if ($Pause) {
    Write-Host $Msg.PressAnyKey -ForegroundColor Cyan
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
}

# Return exit code / 返回退出码
exit $(if ($applySuccess) { 0 } else { 1 })

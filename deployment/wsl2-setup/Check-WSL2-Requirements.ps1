<#
.SYNOPSIS
    WSL 2 System Requirements Checker / WSL 2 系统要求检查工具
.DESCRIPTION
    Checks if the current Windows system meets the requirements for WSL 2 installation.
    检查当前 Windows 系统是否满足 WSL 2 安装要求。
.PARAMETER Lang
    Language for output: 'en' (English) or 'zh' (Chinese). Default: auto-detect
    输出语言：'en'（英文）或 'zh'（中文）。默认：自动检测
.EXAMPLE
    .\Check-WSL2-Requirements.ps1
    .\Check-WSL2-Requirements.ps1 -Lang zh
.NOTES
    Author: Claude Code
    Version: 1.0.1
    Last Updated: 2026-01-01
#>

param(
    [Parameter(Mandatory = $false)]
    [ValidateSet('zh', 'en')]
    [string]$Lang = '',

    [Parameter(Mandatory = $false)]
    [switch]$Pause
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
        Title              = "WSL 2 系统要求检查"
        Subtitle           = "检查您的系统是否满足 WSL 2 安装要求"
        SectionSystem      = "系统信息"
        SectionVirt        = "虚拟化支持"
        SectionDisk        = "磁盘空间"
        SectionFeatures    = "Windows 功能"
        SectionSummary     = "检查结果摘要"

        LabelOS            = "操作系统"
        LabelVersion       = "Windows 版本"
        LabelBuild         = "Build 号"
        LabelArch          = "系统架构"
        LabelCPU           = "处理器"
        LabelCores         = "CPU 核心数"
        LabelRAM           = "物理内存"

        LabelVirtEnabled   = "虚拟化已启用"
        LabelVirtFirmware  = "固件虚拟化支持"
        LabelHyperV        = "Hyper-V 可用"
        LabelSLAT          = "二级地址转换(SLAT)"
        LabelVirtVendor    = "虚拟化类型"

        LabelDiskFree      = "C盘可用空间"
        LabelDiskTotal     = "C盘总容量"
        LabelDiskUsage     = "磁盘使用率"

        LabelWSLFeature    = "WSL 功能"
        LabelVMPlatform    = "虚拟机平台"
        LabelHyperVFeature = "Hyper-V 功能"

        StatusPass         = "通过"
        StatusFail         = "未通过"
        StatusWarn         = "警告"
        StatusEnabled      = "已启用"
        StatusDisabled     = "未启用"
        StatusUnknown      = "未知"
        StatusNotAvail     = "不可用"

        VirtIntel          = "Intel VT-x"
        VirtAMD            = "AMD-V"
        VirtUnknown        = "未知"

        SummaryAllPass     = "所有检查项均通过！您的系统已满足 WSL 2 安装要求。"
        SummaryHasFail     = "部分检查项未通过，请查看上方红色标记的项目。"
        SummaryHasWarn     = "存在警告项，建议优化后再安装 WSL 2。"

        TipVirtDisabled    = "提示：虚拟化未启用，需要在 BIOS 中手动启用"
        TipAMDDefault      = "说明：AMD 系统通常默认启用 AMD-V"
        TipIntelManual     = "说明：Intel 系统通常需要手动启用 VT-x"
        TipSurface         = "说明：Microsoft Surface 设备默认已启用虚拟化"
        TipDiskLow         = "提示：磁盘空间不足，建议至少保留 20GB 可用空间"
        TipEnableFeature   = "提示：运行 'wsl --install' 可自动启用所需功能"

        RequireBuild       = "要求：Build >= 19041"
        RequireDisk        = "要求：>= 20GB"
        RequireRAM         = "要求：>= 4GB（推荐 8GB+）"

        ErrorGetInfo       = "获取系统信息时出错"
        Completed          = "检查完成"
        Timestamp          = "检查时间"
        PressAnyKey        = "按任意键关闭此窗口..."
    }
    en = @{
        Title              = "WSL 2 System Requirements Check"
        Subtitle           = "Verify if your system meets WSL 2 installation requirements"
        SectionSystem      = "System Information"
        SectionVirt        = "Virtualization Support"
        SectionDisk        = "Disk Space"
        SectionFeatures    = "Windows Features"
        SectionSummary     = "Check Results Summary"

        LabelOS            = "Operating System"
        LabelVersion       = "Windows Version"
        LabelBuild         = "Build Number"
        LabelArch          = "Architecture"
        LabelCPU           = "Processor"
        LabelCores         = "CPU Cores"
        LabelRAM           = "Physical Memory"

        LabelVirtEnabled   = "Virtualization Enabled"
        LabelVirtFirmware  = "Firmware Virtualization"
        LabelHyperV        = "Hyper-V Available"
        LabelSLAT          = "Second Level Address Translation"
        LabelVirtVendor    = "Virtualization Type"

        LabelDiskFree      = "C: Drive Free Space"
        LabelDiskTotal     = "C: Drive Total Size"
        LabelDiskUsage     = "Disk Usage"

        LabelWSLFeature    = "WSL Feature"
        LabelVMPlatform    = "Virtual Machine Platform"
        LabelHyperVFeature = "Hyper-V Feature"

        StatusPass         = "PASS"
        StatusFail         = "FAIL"
        StatusWarn         = "WARN"
        StatusEnabled      = "Enabled"
        StatusDisabled     = "Disabled"
        StatusUnknown      = "Unknown"
        StatusNotAvail     = "N/A"

        VirtIntel          = "Intel VT-x"
        VirtAMD            = "AMD-V"
        VirtUnknown        = "Unknown"

        SummaryAllPass     = "All checks passed! Your system meets WSL 2 requirements."
        SummaryHasFail     = "Some checks failed. Please review items marked in red above."
        SummaryHasWarn     = "Warnings detected. Consider optimizing before installing WSL 2."

        TipVirtDisabled    = "Tip: Virtualization is disabled. Enable it in BIOS settings."
        TipAMDDefault      = "Note: AMD systems usually have AMD-V enabled by default"
        TipIntelManual     = "Note: Intel systems usually require manual VT-x enablement"
        TipSurface         = "Note: Microsoft Surface devices have virtualization enabled by default"
        TipDiskLow         = "Tip: Low disk space. Recommend at least 20GB free space."
        TipEnableFeature   = "Tip: Run 'wsl --install' to auto-enable required features"

        RequireBuild       = "Required: Build >= 19041"
        RequireDisk        = "Required: >= 20GB"
        RequireRAM         = "Required: >= 4GB (8GB+ recommended)"

        ErrorGetInfo       = "Error retrieving system information"
        Completed          = "Check completed"
        Timestamp          = "Check time"
        PressAnyKey        = "Press any key to close this window..."
    }
}

# Select language messages / 选择语言消息
$Msg = $Messages[$Lang]

# ============================================================
# Helper Functions / 辅助函数
# ============================================================

function Write-Banner {
    param([string]$Text, [string]$Color = "Cyan")
    $width = 60
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
    Write-Host ""
    Write-Host "  [$Title]" -ForegroundColor Yellow
    Write-Host ("  " + "-" * ($Title.Length + 2)) -ForegroundColor DarkGray
}

function Write-CheckItem {
    param(
        [string]$Label,
        [string]$Value,
        [string]$Status,  # pass, fail, warn, info
        [string]$Extra = ""
    )

    $icon = switch ($Status) {
        "pass" { "[OK]"; $color = "Green" }
        "fail" { "[X]"; $color = "Red" }
        "warn" { "[!]"; $color = "Yellow" }
        default { "[i]"; $color = "Cyan" }
    }

    $labelPadded = $Label.PadRight(24)
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
        default { "->"; $color = "DarkCyan" }
    }

    Write-Host "    $icon $Text" -ForegroundColor $color
}

# ============================================================
# Main Check Logic / 主检查逻辑
# ============================================================

# Result tracking / 结果跟踪
$script:failCount = 0
$script:warnCount = 0
$script:passCount = 0

function Add-Result {
    param([string]$Status)
    switch ($Status) {
        "pass" { $script:passCount++ }
        "fail" { $script:failCount++ }
        "warn" { $script:warnCount++ }
    }
}

# Print banner / 打印横幅
Write-Banner -Text $Msg.Title -Color "Cyan"
Write-Host "  $($Msg.Subtitle)" -ForegroundColor DarkGray
Write-Host ""

# ============================================================
# Section 1: System Information / 第1节：系统信息
# ============================================================
Write-Section -Title $Msg.SectionSystem

try {
    $computerInfo = Get-ComputerInfo -ErrorAction Stop
    $cpuInfo = Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1

    # OS Name / 操作系统名称
    # When English mode, translate Chinese OS edition names to English
    # 英文模式时，将中文版本名翻译为英文
    $osName = $computerInfo.OsName
    if ($Lang -eq 'en') {
        # Common Chinese to English OS edition mappings
        $osName = $osName -replace '专业版', 'Pro'
        $osName = $osName -replace '专业工作站版', 'Pro for Workstations'
        $osName = $osName -replace '企业版', 'Enterprise'
        $osName = $osName -replace '教育版', 'Education'
        $osName = $osName -replace '家庭版', 'Home'
        $osName = $osName -replace '家庭中文版', 'Home China'
        $osName = $osName -replace '专业教育版', 'Pro Education'
    }
    Write-CheckItem -Label $Msg.LabelOS -Value $osName -Status "info"

    # Windows Version / Windows 版本
    Write-CheckItem -Label $Msg.LabelVersion -Value $computerInfo.WindowsVersion -Status "info"

    # Build Number / Build 号
    $buildNum = $computerInfo.OsBuildNumber
    $buildStatus = if ($buildNum -ge 19041) { "pass" } else { "fail" }
    Write-CheckItem -Label $Msg.LabelBuild -Value $buildNum -Status $buildStatus -Extra $Msg.RequireBuild
    Add-Result -Status $buildStatus

    # Architecture / 架构
    # Use standardized output instead of localized string
    # 使用标准化输出而非本地化字符串
    $archRaw = $computerInfo.OsArchitecture
    $is64Bit = $archRaw -match "64"
    $archStatus = if ($is64Bit) { "pass" } else { "fail" }
    $archDisplay = if ($Lang -eq 'en') {
        if ($is64Bit) { "64-bit" } else { "32-bit" }
    } else {
        if ($is64Bit) { "64 位" } else { "32 位" }
    }
    Write-CheckItem -Label $Msg.LabelArch -Value $archDisplay -Status $archStatus
    Add-Result -Status $archStatus

    # CPU / 处理器
    $cpuName = if ($cpuInfo) { $cpuInfo.Name.Trim() } else { $Msg.StatusUnknown }
    Write-CheckItem -Label $Msg.LabelCPU -Value $cpuName -Status "info"

    # CPU Cores / CPU 核心
    $cores = if ($cpuInfo) { "$($cpuInfo.NumberOfCores) cores / $($cpuInfo.NumberOfLogicalProcessors) threads" } else { $Msg.StatusUnknown }
    Write-CheckItem -Label $Msg.LabelCores -Value $cores -Status "info"

    # RAM / 内存
    $ramGB = [math]::Round($computerInfo.CsTotalPhysicalMemory / 1GB, 1)
    $ramStatus = if ($ramGB -ge 8) { "pass" } elseif ($ramGB -ge 4) { "warn" } else { "fail" }
    Write-CheckItem -Label $Msg.LabelRAM -Value "$ramGB GB" -Status $ramStatus -Extra $Msg.RequireRAM
    Add-Result -Status $ramStatus

} catch {
    Write-Host "    $($Msg.ErrorGetInfo): $_" -ForegroundColor Red
    $script:failCount++
}

# ============================================================
# Section 2: Virtualization Support / 第2节：虚拟化支持
# ============================================================
Write-Section -Title $Msg.SectionVirt

try {
    # Detect CPU vendor / 检测CPU厂商
    $cpuVendor = if ($cpuInfo.Manufacturer -match "Intel") {
        "Intel"
    } elseif ($cpuInfo.Manufacturer -match "AMD") {
        "AMD"
    } else {
        "Unknown"
    }

    $virtType = switch ($cpuVendor) {
        "Intel" { $Msg.VirtIntel }
        "AMD"   { $Msg.VirtAMD }
        default { $Msg.VirtUnknown }
    }
    Write-CheckItem -Label $Msg.LabelVirtVendor -Value $virtType -Status "info"

    # Virtualization Firmware Enabled / 固件虚拟化已启用
    # Note: This detection may be inaccurate on some devices (e.g., Xiaomi laptops)
    # 注意：此检测在某些设备上可能不准确（如小米笔记本）
    $virtFirmware = $computerInfo.HyperVRequirementVirtualizationFirmwareEnabled
    $hypervisor = $computerInfo.HyperVisorPresent

    # Smart detection: If firmware says disabled but Hypervisor exists, it may be a false negative
    # 智能检测：如果固件显示未启用但Hypervisor存在，可能是误报
    if ($virtFirmware) {
        $virtFirmwareStatus = "pass"
        $virtFirmwareText = $Msg.StatusEnabled
    } elseif ($hypervisor) {
        # Known Windows API bug: HyperVRequirementVirtualizationFirmwareEnabled returns false
        # even when VT is actually enabled. Hypervisor presence PROVES VT is working.
        # Affected: Intel/AMD desktops, Xiaomi/Dell/ASUS laptops, and many other devices.
        # 已知Windows API缺陷：即使VT实际已启用，API仍返回false
        # Hypervisor存在证明VT实际已启用，直接判定为通过
        $virtFirmwareStatus = "pass"
        $virtFirmwareText = $Msg.StatusEnabled
    } else {
        $virtFirmwareStatus = "fail"
        $virtFirmwareText = $Msg.StatusDisabled
    }
    Write-CheckItem -Label $Msg.LabelVirtFirmware -Value $virtFirmwareText -Status $virtFirmwareStatus
    Add-Result -Status $virtFirmwareStatus

    # Show tips only when virtualization is truly disabled (no Hypervisor)
    # 仅当虚拟化确实未启用时（无Hypervisor）才显示提示
    if (-not $virtFirmware -and -not $hypervisor) {
        Write-Tip -Text $Msg.TipVirtDisabled -Type "warn"
        if ($cpuVendor -eq "AMD") {
            Write-Tip -Text $Msg.TipAMDDefault -Type "info"
        } else {
            Write-Tip -Text $Msg.TipIntelManual -Type "info"
        }
    }
    # Note: When Hypervisor exists, VT is proven to be enabled regardless of API result
    # 注意：当Hypervisor存在时，VT已被证明启用，无需显示任何警告

    # Hypervisor Present / Hypervisor 存在 (already retrieved above)
    $hypervisorStatus = if ($hypervisor) { "pass" } else { "info" }
    $hypervisorText = if ($hypervisor) { $Msg.StatusEnabled } else { $Msg.StatusDisabled }
    Write-CheckItem -Label $Msg.LabelHyperV -Value $hypervisorText -Status $hypervisorStatus

    # SLAT Support / SLAT 支持
    # Note: When Hypervisor is running, SLAT must be enabled (Hyper-V requires SLAT)
    # 注意：当Hypervisor运行时，SLAT必定已启用（Hyper-V强制要求SLAT）
    $slat = $computerInfo.HyperVRequirementSecondLevelAddressTranslation
    if ($slat) {
        $slatStatus = "pass"
        $slatText = $Msg.StatusEnabled
    } elseif ($hypervisor) {
        # Hypervisor running proves SLAT is working, regardless of API result
        # Hypervisor运行证明SLAT正常工作，无论API返回什么
        $slatStatus = "pass"
        $slatText = $Msg.StatusEnabled
    } else {
        $slatStatus = "warn"
        $slatText = $Msg.StatusNotAvail
        Add-Result -Status "warn"
    }
    Write-CheckItem -Label $Msg.LabelSLAT -Value $slatText -Status $slatStatus

} catch {
    Write-Host "    $($Msg.ErrorGetInfo): $_" -ForegroundColor Red
    $script:failCount++
}

# ============================================================
# Section 3: Disk Space / 第3节：磁盘空间
# ============================================================
Write-Section -Title $Msg.SectionDisk

try {
    $drive = Get-PSDrive C -ErrorAction Stop
    $freeGB = [math]::Round($drive.Free / 1GB, 2)
    $usedGB = [math]::Round($drive.Used / 1GB, 2)
    $totalGB = [math]::Round(($drive.Free + $drive.Used) / 1GB, 2)
    $usagePercent = [math]::Round(($usedGB / $totalGB) * 100, 1)

    # Free Space / 可用空间
    $freeStatus = if ($freeGB -ge 50) { "pass" } elseif ($freeGB -ge 20) { "warn" } else { "fail" }
    Write-CheckItem -Label $Msg.LabelDiskFree -Value "$freeGB GB" -Status $freeStatus -Extra $Msg.RequireDisk
    Add-Result -Status $freeStatus

    # Total Space / 总容量
    Write-CheckItem -Label $Msg.LabelDiskTotal -Value "$totalGB GB" -Status "info"

    # Usage / 使用率
    $usageStatus = if ($usagePercent -lt 80) { "pass" } elseif ($usagePercent -lt 90) { "warn" } else { "fail" }
    Write-CheckItem -Label $Msg.LabelDiskUsage -Value "$usagePercent%" -Status $usageStatus

    if ($freeGB -lt 20) {
        Write-Tip -Text $Msg.TipDiskLow -Type "warn"
    }

} catch {
    Write-Host "    $($Msg.ErrorGetInfo): $_" -ForegroundColor Red
    $script:failCount++
}

# ============================================================
# Section 4: Windows Features / 第4节：Windows 功能
# ============================================================
Write-Section -Title $Msg.SectionFeatures

try {
    # WSL Feature / WSL 功能
    $wslFeature = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -ErrorAction SilentlyContinue
    $wslEnabled = $wslFeature.State -eq "Enabled"
    $wslStatus = if ($wslEnabled) { "pass" } else { "info" }
    $wslText = if ($wslEnabled) { $Msg.StatusEnabled } else { $Msg.StatusDisabled }
    Write-CheckItem -Label $Msg.LabelWSLFeature -Value $wslText -Status $wslStatus

    # Virtual Machine Platform / 虚拟机平台
    $vmPlatform = Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -ErrorAction SilentlyContinue
    $vmEnabled = $vmPlatform.State -eq "Enabled"
    $vmStatus = if ($vmEnabled) { "pass" } else { "info" }
    $vmText = if ($vmEnabled) { $Msg.StatusEnabled } else { $Msg.StatusDisabled }
    Write-CheckItem -Label $Msg.LabelVMPlatform -Value $vmText -Status $vmStatus

    # Hyper-V Feature / Hyper-V 功能
    $hyperVFeature = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -ErrorAction SilentlyContinue
    if ($hyperVFeature) {
        $hvEnabled = $hyperVFeature.State -eq "Enabled"
        $hvText = if ($hvEnabled) { $Msg.StatusEnabled } else { $Msg.StatusDisabled }
    } else {
        $hvText = $Msg.StatusNotAvail
    }
    Write-CheckItem -Label $Msg.LabelHyperVFeature -Value $hvText -Status "info"

    if (-not $wslEnabled -or -not $vmEnabled) {
        Write-Tip -Text $Msg.TipEnableFeature -Type "info"
    }

} catch {
    Write-Host "    $($Msg.ErrorGetInfo): $_" -ForegroundColor Red
}

# ============================================================
# Summary / 摘要
# ============================================================
Write-Section -Title $Msg.SectionSummary

$totalChecks = $script:passCount + $script:failCount + $script:warnCount

Write-Host ""
Write-Host "    " -NoNewline
Write-Host "[OK] $($script:passCount)" -ForegroundColor Green -NoNewline
Write-Host "  |  " -ForegroundColor DarkGray -NoNewline
Write-Host "[!] $($script:warnCount)" -ForegroundColor Yellow -NoNewline
Write-Host "  |  " -ForegroundColor DarkGray -NoNewline
Write-Host "[X] $($script:failCount)" -ForegroundColor Red
Write-Host ""

if ($script:failCount -eq 0 -and $script:warnCount -eq 0) {
    Write-Host "    $($Msg.SummaryAllPass)" -ForegroundColor Green
} elseif ($script:failCount -gt 0) {
    Write-Host "    $($Msg.SummaryHasFail)" -ForegroundColor Red
} else {
    Write-Host "    $($Msg.SummaryHasWarn)" -ForegroundColor Yellow
}

# Footer / 页脚
Write-Host ""
Write-Host ("=" * 60) -ForegroundColor DarkGray
Write-Host "  $($Msg.Timestamp): $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host "  $($Msg.Completed)" -ForegroundColor DarkGray
Write-Host ""

# Pause if requested / 如果需要则暂停
if ($Pause) {
    Write-Host $Msg.PressAnyKey -ForegroundColor Cyan
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
}

# Return exit code / 返回退出码
exit $script:failCount

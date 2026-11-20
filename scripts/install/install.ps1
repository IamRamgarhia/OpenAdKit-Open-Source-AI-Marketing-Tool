# OpenAdKit one-line installer for Windows (PowerShell)
# Usage from any PowerShell window:
#   powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/main/scripts/install/install.ps1 | iex"
#
# Does everything in one go:
#   1. Checks for Node.js 20.9+ and git (installs via winget if missing)
#   2. Clones OpenAdKit into %USERPROFILE%\OpenAdKit (or pulls if present)
#   3. Runs npm install + a production build
#   4. Creates a Desktop shortcut and launches OpenAdKit
#
# The body runs inside a scriptblock: when piped into `iex`, a bare `exit`
# would close the user's PowerShell window and hide the error message.

& {
$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "OK  $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "!!  $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "ERR $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " OpenAdKit installer - by DiceCodes" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# --- Defaults ---
$Repo    = "https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool.git"
$Branch  = "main"
$Target  = Join-Path $env:USERPROFILE "OpenAdKit"

# --- Step 1: Node.js ---
Write-Step "Checking for Node.js"
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Warn "Node.js not found."
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Host "Installing Node.js LTS via winget..."
        winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        # Refresh PATH for current session
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        $node = Get-Command node -ErrorAction SilentlyContinue
    }
    if (-not $node) {
        Write-Err "Node.js could not be installed automatically."
        Write-Host "  Install it from https://nodejs.org/en/download then re-run this installer."
        return
    }
}
$nodeVer = & node --version
$nodeParts = $nodeVer.TrimStart("v").Split(".")
if ([int]$nodeParts[0] -lt 20 -or ([int]$nodeParts[0] -eq 20 -and [int]$nodeParts[1] -lt 9)) {
    Write-Err "Node $nodeVer is too old. OpenAdKit needs Node 20.9 or newer (22 LTS recommended)."
    Write-Host "  Update with:  winget upgrade OpenJS.NodeJS.LTS   (or https://nodejs.org)"
    return
}
Write-OK "Node $nodeVer"

# --- Step 2: Git ---
Write-Step "Checking for git"
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
    Write-Warn "git not found."
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Host "Installing Git via winget..."
        winget install -e --id Git.Git --accept-package-agreements --accept-source-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        $git = Get-Command git -ErrorAction SilentlyContinue
    }
    if (-not $git) {
        Write-Err "git could not be installed automatically."
        Write-Host "  Install it from https://git-scm.com/download/win then re-run this installer."
        return
    }
}
Write-OK ("git " + (& git --version))

# --- Step 3: Clone (or update) ---
Write-Step "Fetching OpenAdKit into $Target"
if (Test-Path $Target) {
    if (Test-Path (Join-Path $Target ".git")) {
        Write-Host "Existing checkout found. Pulling latest..."
        Push-Location $Target
        try { & git pull --ff-only } catch { Write-Warn "git pull failed; continuing with existing files." }
        Pop-Location
    } else {
        Write-Warn "$Target exists and is not a git repo. Using folder as-is."
    }
} else {
    & git clone --depth=1 --branch $Branch $Repo $Target
}
Set-Location $Target
Write-OK "Source ready at $Target"

# --- Step 4: npm install ---
Write-Step "Installing dependencies (first run can take a few minutes)"
& npm.cmd install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) {
    Write-Err "npm install failed. Read the error above and try again."
    return
}
Write-OK "Dependencies installed"

Write-Step "Building the production app (about a minute)"
& npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    Write-Err "Build failed. Read the error above and try again."
    return
}
Write-OK "Build complete"

# Ports are chosen on first launch by scripts/resolve-ports.cjs (it asks the OS
# for a free pair and merges them into .env.local, keeping any other keys).
if (-not (Test-Path "data")) { New-Item -ItemType Directory -Path "data" | Out-Null }

# --- Step 6: Desktop shortcut ---
Write-Step "Creating Desktop shortcut"
$DesktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "OpenAdKit.lnk"
$LaunchTarget = Join-Path $Target "OpenAdKit.bat"
try {
    $Wsh = New-Object -ComObject WScript.Shell
    $Shortcut = $Wsh.CreateShortcut($DesktopShortcut)
    $Shortcut.TargetPath = $LaunchTarget
    $Shortcut.WorkingDirectory = $Target
    $Shortcut.Description = "Launch OpenAdKit"
    # Hide the cmd flash by asking the shortcut to start minimized
    $Shortcut.WindowStyle = 7
    $Shortcut.Save()
    Write-OK "Desktop shortcut: $DesktopShortcut"
} catch {
    Write-Warn "Could not create Desktop shortcut: $_"
    Write-Host "  You can open the launcher directly: $LaunchTarget"
}

# --- Step 7: Open the launcher right now ---
Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " Install complete - opening OpenAdKit in your browser..." -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  From now on, double-click  OpenAdKit  on your Desktop to launch."
Write-Host "  OpenAdKit opens in your default browser once it is ready."
Write-Host ""

# Minimized, not hidden: if anything needs attention (a failed step pauses
# with a message) the window is still reachable from the taskbar.
Start-Process -FilePath $LaunchTarget -WorkingDirectory $Target -WindowStyle Minimized
}

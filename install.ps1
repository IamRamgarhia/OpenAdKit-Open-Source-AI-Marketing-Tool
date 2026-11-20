# OpenAdKit installer for Windows — downloads and runs the latest Setup.
#
#   powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/main/install.ps1 | iex"
#
# Same result as downloading OpenAdKit-Windows-Setup.exe from the Releases
# page and double-clicking it, but the file is checked against the release's
# SHA256SUMS.txt first and installed silently (per-user, no admin prompt).
#
# Runs inside a scriptblock so an error never closes your PowerShell window.

& {
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"   # Invoke-WebRequest is ~10x faster without the progress bar
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo = "IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool"
$Base = if ($env:OPENADKIT_RELEASE_URL) { $env:OPENADKIT_RELEASE_URL } else { "https://github.com/$Repo/releases/latest/download" }
$SetupName = "OpenAdKit-Windows-Setup.exe"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " OpenAdKit installer - by DiceCodes" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$tmp = Join-Path ([IO.Path]::GetTempPath()) ("openadkit-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
    $setup = Join-Path $tmp $SetupName
    Write-Host "`n==> Downloading OpenAdKit" -ForegroundColor Cyan
    try {
        Invoke-WebRequest -UseBasicParsing -Uri "$Base/$SetupName" -OutFile $setup
        $sums = (Invoke-WebRequest -UseBasicParsing -Uri "$Base/SHA256SUMS.txt").Content
    } catch {
        Write-Host "ERR Could not download from $Base ($($_.Exception.Message))" -ForegroundColor Red
        return
    }
    if ($sums -is [byte[]]) { $sums = [Text.Encoding]::UTF8.GetString($sums) }
    $line = ($sums -split "`n") | Where-Object { $_ -match ("[ *]" + [regex]::Escape($SetupName) + "\s*$") } | Select-Object -First 1
    if (-not $line) { Write-Host "ERR $SetupName is not listed in SHA256SUMS.txt." -ForegroundColor Red; return }
    $want = ($line.Trim() -split "\s+")[0].ToLower()
    $got = (Get-FileHash -Algorithm SHA256 -Path $setup).Hash.ToLower()
    if ($want -ne $got) {
        Write-Host "ERR Download failed its SHA-256 check (got $got). Nothing was installed." -ForegroundColor Red
        return
    }
    Write-Host " ok Verified (SHA-256 $got)" -ForegroundColor Green

    Write-Host "`n==> Installing (per-user, no admin needed)" -ForegroundColor Cyan
    $p = Start-Process -FilePath $setup -ArgumentList "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/TASKS=desktopicon" -Wait -PassThru
    if ($p.ExitCode -ne 0) { Write-Host "ERR Setup exited with code $($p.ExitCode)." -ForegroundColor Red; return }

    $exe = Join-Path $env:LOCALAPPDATA "Programs\OpenAdKit\OpenAdKit.exe"
    if (-not (Test-Path $exe)) { Write-Host "ERR Setup finished but $exe is missing." -ForegroundColor Red; return }
    Write-Host " ok Installed to $(Split-Path $exe)" -ForegroundColor Green
    Write-Host ""
    Write-Host "OpenAdKit is installed. Open it from the Start menu or the desktop shortcut." -ForegroundColor Green
    Write-Host "Update: run this line again.  Uninstall: Settings > Apps > OpenAdKit."
    if ($env:OPENADKIT_NO_LAUNCH -ne "1") { Start-Process -FilePath $exe }
} finally {
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
}

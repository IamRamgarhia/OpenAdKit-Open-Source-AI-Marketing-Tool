@echo off
REM AdForge desktop launcher (Windows).
REM
REM Double-click this file (or the "AdForge" shortcut your installer placed
REM on your Desktop) to:
REM   1. Start the AdForge sidecar in the background if it's not already
REM      running (the sidecar is the tiny Node HTTP server that manages
REM      the web app + serves the launcher page).
REM   2. Open the launcher control panel in your default browser at
REM      http://127.0.0.1:3006/. That page is a normal HTML file with
REM      Start / Stop / Open buttons - click Start to boot the web app.
REM
REM Uses PowerShell (always present on Win10+) to spawn the sidecar
REM detached and hidden so no black cmd window stays behind.

setlocal EnableDelayedExpansion
cd /d "%~dp0"

REM --- Load configured sync port (default 3006) ---
set "SYNC_PORT=3006"
if exist .env.local (
    for /f "tokens=2 delims==" %%a in ('findstr /b "ADFORGE_SYNC_PORT=" .env.local 2^>nul') do set "SYNC_PORT=%%a"
)

REM --- Already running? Just open the browser ---
powershell -NoProfile -Command ^
  "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 -Uri 'http://127.0.0.1:!SYNC_PORT!/health' | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
    start "" "http://127.0.0.1:!SYNC_PORT!/"
    exit /b 0
)

REM --- Sanity: Node installed? ---
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Node.js is not installed.
    echo   Install from https://nodejs.org/en/download then double-click AdForge again.
    echo.
    pause
    exit /b 1
)

REM --- First-run setup is inlined here (no separate install.bat anymore) ---

REM 1. npm install if node_modules is missing
if not exist node_modules (
    echo.
    echo ==================================================
    echo  First run · installing dependencies
    echo ==================================================
    echo This takes 1-3 minutes. You will only see this once.
    echo.
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed. Read the error above and try again.
        echo.
        pause
        exit /b 1
    )
)

REM 2. Write default .env.local if it doesn't exist (user can change ports later
REM    from the launcher's Settings card without re-running anything)
if not exist .env.local (
    > .env.local echo # AdForge configuration ^(default ports - change in launcher Settings if needed^)
    >> .env.local echo PORT=3005
    >> .env.local echo ADFORGE_SYNC_PORT=3006
)

REM 3. Create Desktop shortcut on first run (only if it isn't already there)
powershell -NoProfile -Command ^
  "$d = [Environment]::GetFolderPath('Desktop');" ^
  "$lnk = Join-Path $d 'AdForge.lnk';" ^
  "if (-not (Test-Path $lnk)) {" ^
  "  $t = Join-Path '%CD%' 'AdForge.bat';" ^
  "  $s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk);" ^
  "  $s.TargetPath = $t; $s.WorkingDirectory = '%CD%';" ^
  "  $s.Description = 'Launch AdForge'; $s.WindowStyle = 7; $s.Save();" ^
  "  Write-Host '  -> Created Desktop shortcut: ' $lnk" ^
  "}" 2>nul

if not exist data mkdir data

REM --- Spawn the sidecar detached, hidden, with the right env var ---
echo Starting AdForge sidecar...
powershell -NoProfile -Command ^
  "$env:ADFORGE_SYNC_PORT='!SYNC_PORT!';" ^
  "Start-Process -FilePath 'node' -ArgumentList 'scripts\local-sync.cjs' -WorkingDirectory (Get-Location) -WindowStyle Hidden"
if errorlevel 1 (
    echo [ERROR] Failed to launch the sidecar. Run scripts\start.bat in a visible window to see why.
    pause
    exit /b 1
)

REM --- Wait for /health to come up, then open the browser ---
set /a TRIES=0
:wait
set /a TRIES+=1
powershell -NoProfile -Command ^
  "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 -Uri 'http://127.0.0.1:!SYNC_PORT!/health' | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto :ready
if !TRIES! GEQ 30 goto :fail
REM ~750ms sleep between probes
powershell -NoProfile -Command "Start-Sleep -Milliseconds 750" >nul 2>&1
goto :wait

:ready
start "" "http://127.0.0.1:!SYNC_PORT!/"
exit /b 0

:fail
echo.
echo [ERROR] Sidecar did not respond within 30 seconds.
echo   Run scripts\start.bat in a normal window to see the actual log output.
echo.
pause
exit /b 1

@echo off
REM OpenAdKit desktop launcher (Windows).
REM
REM Double-click this file to launch OpenAdKit. On every launch we:
REM   1. Inspect any OpenAdKit sidecar already running on the configured port.
REM      If it's THIS install's current sidecar  → reuse, open browser.
REM      If it's THIS install's stale sidecar    → kill, restart on same port.
REM      If it's ANOTHER install's sidecar       → shift to a free port pair.
REM      If port is bound by something unrelated → shift to a free port pair.
REM      If port is free                         → start fresh.
REM   2. On first run, install deps + write default .env.local + create Desktop shortcut.
REM   3. Spawn sidecar hidden (PowerShell Start-Process -WindowStyle Hidden).
REM   4. Wait for /health, open browser to the launcher.
REM
REM Two OpenAdKit installs in different folders never fight over the same port —
REM the second one detects the first and auto-shifts to the next free pair.

setlocal EnableDelayedExpansion
cd /d "%~dp0"

REM --- Sanity: Node ---
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Node.js is not installed.
    echo   Install from https://nodejs.org/en/download then double-click OpenAdKit again.
    echo.
    pause
    exit /b 1
)

REM --- First-run setup (inline; no separate install.bat) ---
if not exist node_modules (
    echo.
    echo ==================================================
    echo  First run - installing dependencies
    echo ==================================================
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)
REM --- Production build (once, and again after updates) ---
REM The web app runs from .next\standalone in production mode: starts in about
REM a second and uses far less memory than the dev server.
if not exist .next\standalone\server.js (
    echo.
    echo ===================================================
    echo  Building OpenAdKit ^(one time, about a minute^)
    echo ===================================================
    call npm run build
    if errorlevel 1 (
        echo.
        echo [ERROR] Build failed. Read the error above.
        pause
        exit /b 1
    )
)
REM .env.local is NOT seeded here — the port resolver below detects first-run
REM (no .env.local) and asks the OS for ports the kernel just confirmed are
REM free. That avoids the 3000-range collision storm entirely.
if not exist data mkdir data

REM Desktop shortcut on first run. The folder reaches PowerShell through an
REM environment variable, never spliced into the command text, so a path with
REM an apostrophe (C:\Users\O'Brien) or "!" can't break the quoting.
REM Delayed expansion is switched off for this block so a "!" in the path survives.
setlocal DisableDelayedExpansion
set "OAK_DIR=%~dp0"
powershell -NoProfile -Command ^
  "$dir = $env:OAK_DIR.TrimEnd([char]92);" ^
  "$d = [Environment]::GetFolderPath('Desktop');" ^
  "$lnk = Join-Path $d 'OpenAdKit.lnk';" ^
  "if (-not (Test-Path $lnk)) {" ^
  "  $s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk);" ^
  "  $s.TargetPath = (Join-Path $dir 'OpenAdKit.bat'); $s.WorkingDirectory = $dir;" ^
  "  $s.Description = 'Launch OpenAdKit'; $s.WindowStyle = 7; $s.Save();" ^
  "}" 2>nul
endlocal

REM --- Resolve ports (handles multi-install conflicts) ---
echo Checking for port conflicts...
set "ACTION="
set "PORT="
set "SYNC="
set "REASON="
for /f "tokens=1,2,3,4 delims= " %%a in ('node scripts\resolve-ports.cjs 2^>nul') do (
    for /f "tokens=1,2 delims==" %%x in ("%%a") do if "%%x"=="ACTION" set "ACTION=%%y"
    for /f "tokens=1,2 delims==" %%x in ("%%b") do if "%%x"=="PORT"   set "PORT=%%y"
    for /f "tokens=1,2 delims==" %%x in ("%%c") do if "%%x"=="SYNC"   set "SYNC=%%y"
    for /f "tokens=1,2 delims==" %%x in ("%%d") do if "%%x"=="REASON" set "REASON=%%y"
)

if "!ACTION!"=="" (
    echo [ERROR] Port resolver failed to run.
    pause
    exit /b 1
)
if "!ACTION!"=="error" (
    echo [ERROR] Port resolver: !REASON!
    pause
    exit /b 1
)

if "!ACTION!"=="reuse" (
    echo OpenAdKit is already running for this install. Opening it...
    if not "%OPENADKIT_NO_BROWSER%"=="1" start "" "http://127.0.0.1:!PORT!/"
    exit /b 0
)

if "!ACTION!"=="restart_stale" (
    echo Stale sidecar on :!SYNC! - asking it to quit before starting fresh...
    powershell -NoProfile -Command ^
      "try { Invoke-WebRequest -UseBasicParsing -Method POST -TimeoutSec 3 -Uri 'http://127.0.0.1:!SYNC!/quit' | Out-Null } catch {}" >nul 2>&1
    powershell -NoProfile -Command "Start-Sleep -Milliseconds 1500" >nul 2>&1
)

if "!ACTION!"=="shifted" (
    echo.
    echo  Default ports were taken by another OpenAdKit install or process.
    echo  This install will use:  web=!PORT!  sync=!SYNC!
    echo  Saved to .env.local so future launches reuse these.
    echo.
)

REM --- Spawn sidecar detached + hidden ---
echo Starting OpenAdKit sidecar on :!SYNC!...
powershell -NoProfile -Command ^
  "$env:OPENADKIT_SYNC_PORT='!SYNC!'; $env:ADFORGE_SYNC_PORT='!SYNC!'; $env:PORT='!PORT!';" ^
  "Start-Process -FilePath 'node' -ArgumentList 'scripts\local-sync.cjs' -WorkingDirectory (Get-Location) -WindowStyle Hidden"
if errorlevel 1 (
    echo [ERROR] Failed to launch the sidecar. Try scripts\start.bat for a visible log.
    pause
    exit /b 1
)

REM --- Wait for sidecar /health on SYNC port, THEN wait for Next dev on WEB port ---
REM The sidecar auto-starts the Next dev server on boot, so by the time
REM /health returns 200 the web app is either already up or compiling.
echo Starting OpenAdKit web app...
set /a TRIES=0
:wait_sidecar
set /a TRIES+=1
powershell -NoProfile -Command ^
  "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 -Uri 'http://127.0.0.1:!SYNC!/health' | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto :wait_web
if !TRIES! GEQ 30 goto :fail
powershell -NoProfile -Command "Start-Sleep -Milliseconds 750" >nul 2>&1
goto :wait_sidecar

:wait_web
REM Sidecar is alive. Now wait for the web app itself on PORT — Next dev's
REM cold-compile can take 30s on slower machines. Up to 90s total.
set /a WTRIES=0
:wait_web_loop
set /a WTRIES+=1
powershell -NoProfile -Command ^
  "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 -Uri 'http://127.0.0.1:!PORT!/' | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto :ready
if !WTRIES! GEQ 120 goto :fallback_launcher
powershell -NoProfile -Command "Start-Sleep -Milliseconds 750" >nul 2>&1
goto :wait_web_loop

:ready
REM Open browser DIRECTLY to the app, not the launcher panel.
if not "%OPENADKIT_NO_BROWSER%"=="1" start "" "http://127.0.0.1:!PORT!/"
exit /b 0

:fallback_launcher
REM Web app didn't come up in time — open the control panel so user can see
REM the build log and retry. Better than failing silently.
echo.
echo [WARN] Web app didn't respond within 90 seconds. Opening control panel.
echo   Use Restart there, or run scripts\start.bat to see the log.
if not "%OPENADKIT_NO_BROWSER%"=="1" start "" "http://127.0.0.1:!SYNC!/"
exit /b 0

:fail
echo.
echo [ERROR] Sidecar did not respond on :!SYNC! within 30 seconds.
echo   Run scripts\start.bat in a normal window to see the actual log output.
echo.
pause
exit /b 1

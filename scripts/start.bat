@echo off
REM OpenAdKit start (Windows) - visible-log launcher.
REM Starts the sidecar (control panel + sync), which auto-starts the web app,
REM then opens the web app in your browser. Close this window to stop.

setlocal
REM Always run from the repo root (this file lives in scripts\).
cd /d "%~dp0.."

if not exist node_modules (
    echo First run: installing dependencies...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)
if not exist .next\standalone\server.js (
    echo Building OpenAdKit ^(one time, about a minute^)...
    call npm run build
    if errorlevel 1 (
        echo [ERROR] Build failed.
        pause
        exit /b 1
    )
)

if not exist .env.local node scripts\resolve-ports.cjs >nul
set "SYNC_PORT="
set "WEB_PORT="
for /f "usebackq tokens=1,2 delims==" %%A in (".env.local") do (
    if /I "%%A"=="PORT" set "WEB_PORT=%%B"
    if /I "%%A"=="OPENADKIT_SYNC_PORT" set "SYNC_PORT=%%B"
)
if not defined SYNC_PORT (
    for /f "usebackq tokens=1,2 delims==" %%A in (".env.local") do (
        if /I "%%A"=="ADFORGE_SYNC_PORT" set "SYNC_PORT=%%B"
    )
)
if not defined SYNC_PORT set "SYNC_PORT=41574"
if not defined WEB_PORT set "WEB_PORT=41573"

echo.
echo ==================================================
echo  Starting OpenAdKit
echo ==================================================
echo   Web app:        http://127.0.0.1:%WEB_PORT%/
echo   Control panel:  http://127.0.0.1:%SYNC_PORT%/
echo   Close this window or run scripts\stop.bat to shut down.
echo.

REM Open the browser once the web app answers (waits up to 60s).
REM Set OPENADKIT_NO_BROWSER=1 to skip (CI / headless).
if not "%OPENADKIT_NO_BROWSER%"=="1" start "" /min powershell -NoProfile -WindowStyle Hidden -Command "$u='http://127.0.0.1:%WEB_PORT%/'; for($i=0;$i -lt 120;$i++){ try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 $u | Out-Null; Start-Process $u; exit } catch { Start-Sleep -Milliseconds 500 } }; Start-Process 'http://127.0.0.1:%SYNC_PORT%/'"

set "OPENADKIT_SYNC_PORT=%SYNC_PORT%"
set "ADFORGE_SYNC_PORT=%SYNC_PORT%"
set "PORT=%WEB_PORT%"
node scripts\local-sync.cjs

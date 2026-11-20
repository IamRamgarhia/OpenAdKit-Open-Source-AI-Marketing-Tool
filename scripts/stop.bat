@echo off
REM OpenAdKit stop (Windows). Asks the sidecar to shut down cleanly (it stops
REM the web app first), then frees the ports if anything is left.

setlocal
REM Always run from the repo root (this file lives in scripts\).
cd /d "%~dp0.."
echo Stopping OpenAdKit...

set "WEB_PORT="
set "SYNC_PORT="
if not exist .env.local (
    echo No .env.local found - OpenAdKit has not been started from this folder.
    goto :done
)
for /f "usebackq tokens=1,2 delims==" %%A in (".env.local") do (
    if /I "%%A"=="PORT" set "WEB_PORT=%%B"
    if /I "%%A"=="OPENADKIT_SYNC_PORT" set "SYNC_PORT=%%B"
)
if not defined SYNC_PORT (
    for /f "usebackq tokens=1,2 delims==" %%A in (".env.local") do (
        if /I "%%A"=="ADFORGE_SYNC_PORT" set "SYNC_PORT=%%B"
    )
)

if defined SYNC_PORT (
    curl -s -X POST --max-time 2 http://127.0.0.1:%SYNC_PORT%/quit >nul 2>&1
    ping -n 3 127.0.0.1 >nul
)
for %%Q in (%WEB_PORT% %SYNC_PORT%) do (
    for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":%%Q .*LISTENING"') do (
        echo Stopping PID %%P ^(port %%Q^)
        taskkill /PID %%P /T /F >nul 2>&1
    )
)

:done
echo Done.
ping -n 3 127.0.0.1 >nul

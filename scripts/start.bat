@echo off
REM AdForge start — opens the launcher control panel in your browser.
REM From the launcher you click "Start AdForge" and watch progress.

setlocal EnableDelayedExpansion
cd /d "%~dp0"

REM Make sure node_modules exists
if not exist node_modules (
    echo node_modules missing. Running install first...
    call install.bat
    if errorlevel 1 exit /b 1
)

REM Make sure data folder exists
if not exist data mkdir data

REM Load SYNC_PORT from .env.local (default 3006)
set "SYNC_PORT=3006"
if exist .env.local (
    for /f "tokens=2 delims==" %%a in ('findstr /b "ADFORGE_SYNC_PORT=" .env.local 2^>nul') do set "SYNC_PORT=%%a"
)

echo.
echo ==================================================
echo  Opening AdForge launcher...
echo ==================================================
echo.
echo  Launcher (control panel): http://127.0.0.1:!SYNC_PORT!/
echo.
echo  In the launcher, click "Start AdForge" to launch the web app.
echo  Press Ctrl+C in this window or run stop.bat to shut down.
echo.

REM Open the launcher page in the default browser after the sidecar starts
start /min "" cmd /c "ping -n 3 127.0.0.1 >nul && start http://127.0.0.1:!SYNC_PORT!/"

REM Run the sidecar in this window (it serves the launcher + manages Next)
set "ADFORGE_SYNC_PORT=!SYNC_PORT!"
node scripts\local-sync.cjs

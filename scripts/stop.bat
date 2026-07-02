@echo off
REM OpenAdKit stop — kills the Next.js dev server (port 3005) and sync sidecar (port 3006).
REM Double-click this file.

setlocal

echo Stopping OpenAdKit...

REM Read the ACTUAL ports from .env.local — the launcher/resolver writes these
REM and they are NOT 3005/3006 on most installs. (Audit finding.)
set "WEB_PORT="
set "SYNC_PORT="
if exist .env.local (
    for /f "usebackq tokens=1,2 delims==" %%A in (".env.local") do (
        if /I "%%A"=="PORT" set "WEB_PORT=%%B"
        if /I "%%A"=="ADFORGE_SYNC_PORT" set "SYNC_PORT=%%B"
    )
)

if defined WEB_PORT (
    for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%WEB_PORT% .*LISTENING"') do (
        echo Killing PID %%P (web port %WEB_PORT%)
        taskkill /PID %%P /F >nul 2>&1
    )
) else (
    echo No .env.local PORT found — skipping web port.
)

if defined SYNC_PORT (
    for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%SYNC_PORT% .*LISTENING"') do (
        echo Killing PID %%P (sync port %SYNC_PORT%)
        taskkill /PID %%P /F >nul 2>&1
    )
)

REM Kill any leftover Node windows started by start.bat
taskkill /FI "WINDOWTITLE eq openadkit sync" /F >nul 2>&1

echo Done.
timeout /t 2 >nul

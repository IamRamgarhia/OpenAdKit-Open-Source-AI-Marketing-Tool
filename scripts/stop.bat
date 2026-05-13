@echo off
REM AdForge stop — kills the Next.js dev server (port 3005) and sync sidecar (port 3006).
REM Double-click this file.

setlocal

echo Stopping AdForge...

REM Kill anything listening on port 3005 (Next dev)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3005 .*LISTENING"') do (
    echo Killing PID %%P (port 3005)
    taskkill /PID %%P /F >nul 2>&1
)

REM Kill anything listening on port 3006 (local-sync)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3006 .*LISTENING"') do (
    echo Killing PID %%P (port 3006)
    taskkill /PID %%P /F >nul 2>&1
)

REM Kill any leftover Node windows started by start.bat
taskkill /FI "WINDOWTITLE eq adforge sync" /F >nul 2>&1

echo Done.
timeout /t 2 >nul

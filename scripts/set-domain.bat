@echo off
REM OpenAdKit — add or remove the  openadkit.local  hosts entry.
REM RIGHT-CLICK THIS FILE AND "Run as administrator" — otherwise it cannot edit
REM C:\Windows\System32\drivers\etc\hosts.
REM
REM Usage:
REM   set-domain.bat          ← adds the entry (default)
REM   set-domain.bat remove   ← removes the entry

setlocal EnableDelayedExpansion
set "HOSTS=%WINDIR%\System32\drivers\etc\hosts"
set "ENTRY=127.0.0.1   openadkit.local   # OpenAdKit local"

REM Current web port from .env.local (repo root is one level up from scripts\).
set "PORT=your-port"
if exist "%~dp0..\.env.local" (
    for /f "usebackq tokens=1,2 delims==" %%A in ("%~dp0..\.env.local") do (
        if /I "%%A"=="PORT" set "PORT=%%B"
    )
)

REM Admin check
net session >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ERROR] This script needs Administrator privileges to edit the hosts file.
    echo.
    echo  Close this window, RIGHT-CLICK  set-domain.bat,  then choose
    echo  "Run as administrator".
    echo.
    pause
    exit /b 1
)

if /i "%~1"=="remove" goto REMOVE

REM ADD
findstr /c:"openadkit.local" "%HOSTS%" >nul 2>&1
if not errorlevel 1 (
    echo.
    echo  openadkit.local is ALREADY in your hosts file. Nothing to do.
    echo.
    pause
    exit /b 0
)

echo.>>"%HOSTS%"
echo %ENTRY%>>"%HOSTS%"
echo.
echo  Added:  %ENTRY%
echo.
echo  Now run OpenAdKit on port 80 to use  http://openadkit.local/
echo  Edit .env.local and set  PORT=80,  then run scripts\start.bat as administrator.
echo.
echo  Or keep your current port and use  http://openadkit.local:!PORT!/
echo.
pause
exit /b 0

:REMOVE
findstr /v "openadkit.local" "%HOSTS%" > "%HOSTS%.tmp"
move /y "%HOSTS%.tmp" "%HOSTS%" >nul
echo.
echo  Removed openadkit.local from your hosts file.
echo.
pause
exit /b 0

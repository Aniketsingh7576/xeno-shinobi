@echo off
REM Runs the VMS in this window instead of as a service, so startup errors are
REM visible. Use this to troubleshoot. Stop the service first, or the port will
REM already be taken. Ctrl+C to stop.
setlocal
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
net stop ShinobiVMS >nul 2>&1
cd /d "%ROOT%\app\backend"
echo Starting Shinobi VMS in console mode ...
echo Open http://localhost:8080/super   (Ctrl+C to stop)
echo.
"%ROOT%\node\node.exe" camera.js
pause

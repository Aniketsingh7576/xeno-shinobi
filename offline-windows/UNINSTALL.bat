@echo off
REM Removes the Shinobi VMS service. Leaves conf.json, the database and video.
setlocal
net session >nul 2>&1
if errorlevel 1 (
    echo   Run this as administrator.
    pause
    exit /b 1
)
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
echo   Stopping and removing the ShinobiVMS service ...
"%ROOT%\shinobi-service.exe" stop      >nul 2>&1
"%ROOT%\shinobi-service.exe" uninstall >nul 2>&1
echo.
echo   Service removed.
echo   Your data was NOT deleted:
echo     %ROOT%\shinobi.sqlite
echo     %ROOT%\videos
echo   Delete the folder by hand if you want those gone too.
echo.
pause

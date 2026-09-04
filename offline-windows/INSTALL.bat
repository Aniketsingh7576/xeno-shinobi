@echo off
REM Installs Shinobi VMS as a Windows service. No internet required.
REM Right-click this file and choose "Run as administrator".
setlocal

net session >nul 2>&1
if errorlevel 1 (
    echo.
    echo   This installer must run as administrator.
    echo   Right-click INSTALL.bat and choose "Run as administrator".
    echo.
    pause
    exit /b 1
)

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

echo.
echo   Installing Shinobi VMS
echo   Location: %ROOT%
echo.

echo %ROOT% | findstr /C:"\Program Files" >nul
if not errorlevel 1 (
    echo   WARNING: Program Files restricts writes. Prefer C:\ShinobiVMS.
    echo.
)

if not exist "%ROOT%\node\node.exe"     goto :missing
if not exist "%ROOT%\ffmpeg\ffmpeg.exe" goto :missing
if not exist "%ROOT%\app\backend\camera.js" goto :missing

REM --- config: substitute the real install path into the template ---
if not exist "%ROOT%\app\backend\conf.json" (
    echo   Writing conf.json ...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$r = '%ROOT%' -replace '\\','/'; $t = (Get-Content '%ROOT%\conf.template.json' -Raw).Replace('__ROOT__', $r); [IO.File]::WriteAllText('%ROOT%\app\backend\conf.json', $t, (New-Object Text.UTF8Encoding $false))"
) else (
    echo   conf.json already exists, keeping it.
    echo   NOTE: if this is a re-install over an older bundle, that file may be
    echo         stale. Delete app\backend\conf.json and re-run to regenerate it.
)

if not exist "%ROOT%\videos" mkdir "%ROOT%\videos"
if not exist "%ROOT%\logs"   mkdir "%ROOT%\logs"

REM --- service definition for WinSW ---
echo   Writing service definition ...
> "%ROOT%\shinobi-service.xml" (
echo ^<service^>
echo   ^<id^>ShinobiVMS^</id^>
echo   ^<name^>Shinobi VMS^</name^>
echo   ^<description^>Shinobi video management system^</description^>
echo   ^<executable^>%ROOT%\node\node.exe^</executable^>
echo   ^<arguments^>camera.js^</arguments^>
echo   ^<workingdirectory^>%ROOT%\app\backend^</workingdirectory^>
echo   ^<logpath^>%ROOT%\logs^</logpath^>
echo   ^<log mode="roll-by-size"^>^<sizeThreshold^>10240^</sizeThreshold^>^<keepFiles^>5^</keepFiles^>^</log^>
REM Three failure actions, not one. Windows takes first / second / subsequent, and a
REM single ^<onfailure^> only ever sets the FIRST -- which meant the service retried
REM once, 10 seconds later, and then gave up. The recorder now exits non-zero when
REM storage is missing, so this policy IS the power-cut behaviour: a NAS that comes up
REM slower than the server has to be survivable.
echo   ^<onfailure action="restart" delay="30 sec"/^>
echo   ^<onfailure action="restart" delay="30 sec"/^>
echo   ^<onfailure action="restart" delay="60 sec"/^>
echo   ^<resetfailure^>1 hour^</resetfailure^>
echo   ^<startmode^>Automatic^</startmode^>
echo   ^<delayedAutoStart^>true^</delayedAutoStart^>
echo ^</service^>
)

sc query ShinobiVMS >nul 2>&1
if not errorlevel 1 (
    echo   Existing service found, removing it first ...
    "%ROOT%\shinobi-service.exe" stop      >nul 2>&1
    "%ROOT%\shinobi-service.exe" uninstall >nul 2>&1
    REM Windows needs a moment to release the service name.
    ping -n 4 127.0.0.1 >nul
)

echo   Registering service ...
"%ROOT%\shinobi-service.exe" install
if errorlevel 1 goto :svcfail

REM Assert the two settings that decide whether this machine survives a power cut.
REM Do not trust the XML for them: on at least one install the registered service came
REM out DEMAND_START even though the XML said Automatic, so nothing started at boot.
REM sc is deterministic and its result can be read back, which the XML path cannot.
echo   Setting start type and recovery policy ...
sc config ShinobiVMS start= delayed-auto >nul
if errorlevel 1 (
    echo   ERROR: could not set the service to delayed-auto start.
    goto :svcfail
)
sc failure ShinobiVMS reset= 3600 actions= restart/30000/restart/30000/restart/60000 >nul
if errorlevel 1 (
    echo   ERROR: could not set the service recovery policy.
    goto :svcfail
)

REM Read it back. A silent no-op here is exactly how this was missed the first time.
sc qc ShinobiVMS | findstr /C:"AUTO_START" >nul
if errorlevel 1 (
    echo   ERROR: start type did not stick - the service will NOT start after a power cut.
    sc qc ShinobiVMS
    goto :svcfail
)
echo   Start type and recovery policy confirmed.

echo   Starting service ...
"%ROOT%\shinobi-service.exe" start
if errorlevel 1 goto :svcfail

REM First boot creates the SQLite tables; give it a moment before reporting.
ping -n 9 127.0.0.1 >nul

sc query ShinobiVMS | find "RUNNING" >nul
if errorlevel 1 (
    echo.
    echo   Service registered but not running yet. Check %ROOT%\logs\
    echo   You can also run START-CONSOLE.bat to see errors directly.
    echo.
    pause
    exit /b 1
)

echo.
echo   ================================================
echo    Shinobi VMS is installed and running.
echo.
echo    Open:  http://localhost:8080/super
echo    Login: see app\backend\super.json
echo.
echo    CHANGE THE DEFAULT PASSWORD BEFORE GOING LIVE.
echo.
echo    Database: %ROOT%\shinobi.sqlite  (back this up)
echo    Logs:     %ROOT%\logs
echo   ================================================
echo.
pause
exit /b 0

:missing
echo.
echo   ERROR: The bundle is incomplete.
echo   Copy the whole ShinobiVMS-Offline folder, not just some of it.
echo.
pause
exit /b 1

:svcfail
echo.
echo   ERROR: Could not install or start the service.
echo   Check %ROOT%\logs\ for details.
echo.
pause
exit /b 1

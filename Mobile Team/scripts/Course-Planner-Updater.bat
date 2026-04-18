@echo off
setlocal EnableExtensions

title GatorGuide Course Planner Updater
cd /d "%~dp0.."

set "MODE=%~1"
set "ACTION_LABEL=Course planner updater"

if /I "%MODE%"=="maintenance" goto runMaintenance
if /I "%MODE%"=="maintenance-no-downloads" goto runMaintenanceNoDownloads
if /I "%MODE%"=="refresh" goto runRefresh
if /I "%MODE%"=="refresh-no-downloads" goto runRefreshNoDownloads
if /I "%MODE%"=="cache-summary" goto runCacheSummary
if /I "%MODE%"=="help" goto printHelp
if not "%MODE%"=="" goto invalidMode

:menu
echo.
echo Course Planner Updater
echo 1. Full maintenance
echo 2. Full maintenance ^(skip downloads^)
echo 3. Refresh only
echo 4. Refresh only ^(skip downloads^)
echo 5. Show cache summary
echo 6. Exit
echo.
set "CHOICE="
set /p CHOICE=Enter 1-6: 

if "%CHOICE%"=="1" goto runMaintenance
if "%CHOICE%"=="2" goto runMaintenanceNoDownloads
if "%CHOICE%"=="3" goto runRefresh
if "%CHOICE%"=="4" goto runRefreshNoDownloads
if "%CHOICE%"=="5" goto runCacheSummary
if "%CHOICE%"=="6" exit /b 0

echo Enter a number from 1 to 6.
goto menu

:runMaintenance
set "ACTION_LABEL=Course planner maintenance"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-transfer-planner-maintenance.ps1"
goto finish

:runMaintenanceNoDownloads
set "ACTION_LABEL=Course planner maintenance (skip downloads)"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-transfer-planner-maintenance.ps1" -SkipDownloads
goto finish

:runRefresh
set "ACTION_LABEL=Course planner refresh"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-transfer-planner-refresh.ps1"
goto finish

:runRefreshNoDownloads
set "ACTION_LABEL=Course planner refresh (skip downloads)"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-transfer-planner-refresh.ps1" -SkipDownloads
goto finish

:runCacheSummary
set "ACTION_LABEL=Course planner cache summary"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-transfer-planner-maintenance.ps1" -ShowCacheSummary -NoPrompt -NoOpenSummary
goto finish

:invalidMode
echo Unknown mode "%MODE%".
echo.
goto printHelp

:printHelp
echo Usage:
echo   Course-Planner-Updater.bat
echo   Course-Planner-Updater.bat maintenance
echo   Course-Planner-Updater.bat maintenance-no-downloads
echo   Course-Planner-Updater.bat refresh
echo   Course-Planner-Updater.bat refresh-no-downloads
echo   Course-Planner-Updater.bat cache-summary
echo   Course-Planner-Updater.bat help
exit /b 0

:finish
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if "%EXIT_CODE%"=="0" (
  echo %ACTION_LABEL% finished successfully.
) else (
  echo %ACTION_LABEL% failed with exit code %EXIT_CODE%.
)
echo.
pause
exit /b %EXIT_CODE%

@echo off
setlocal EnableExtensions

title GatorGuide Course Planner Updater
set "REPO_ROOT=%~dp0"
set "APP_ROOT=%REPO_ROOT%Mobile Team"
set "SCRIPT_ROOT=%APP_ROOT%\scripts"
set "BACK_EXIT_CODE=86"
set "INTERACTIVE_MENU=0"
set "HOSTED_BACK_TARGET="
cd /d "%APP_ROOT%"

set "MODE=%~1"
set "ACTION_LABEL=Course planner updater"

if /I "%MODE%"=="maintenance" goto runMaintenance
if /I "%MODE%"=="maintenance-no-downloads" goto runMaintenanceNoDownloads
if /I "%MODE%"=="refresh" goto runRefresh
if /I "%MODE%"=="refresh-no-downloads" goto runRefreshNoDownloads
if /I "%MODE%"=="cache-summary" goto runCacheSummary
if /I "%MODE%"=="edit-course-links" goto runEditCourseLinks
if /I "%MODE%"=="laymans-diagnosis" goto runLaymansDiagnosis
if /I "%MODE%"=="help" goto printHelp
if not "%MODE%"=="" goto invalidMode

set "INTERACTIVE_MENU=1"
:menu
set "HOSTED_BACK_TARGET="
echo.
echo Course Planner Updater
echo 1. Full maintenance
echo 2. Refresh only
echo 3. Show cache summary
echo 4. Edit course links
echo 5. Laymans Diagnosis
echo 6. Back
echo.
set "CHOICE="
set /p CHOICE=Enter 1-6:

if "%CHOICE%"=="1" goto maintenanceModeMenu
if "%CHOICE%"=="2" goto refreshModeMenu
if "%CHOICE%"=="3" goto runCacheSummary
if "%CHOICE%"=="4" (
  set "HOSTED_BACK_TARGET=menu"
  goto runEditCourseLinks
)
if "%CHOICE%"=="5" goto runLaymansDiagnosis
if "%CHOICE%"=="6" exit /b 0

echo Enter a number from 1 to 6.
goto menu

:maintenanceModeMenu
echo.
echo Full maintenance
echo 1. Normal
echo 2. Skip downloads
echo B. Back
echo.
set "CHOICE="
set /p CHOICE=Enter 1-2 or B:

if "%CHOICE%"=="1" (
  set "HOSTED_BACK_TARGET=maintenanceModeMenu"
  goto runMaintenance
)
if "%CHOICE%"=="2" (
  set "HOSTED_BACK_TARGET=maintenanceModeMenu"
  goto runMaintenanceNoDownloads
)
if /I "%CHOICE%"=="B" goto menu

echo Enter 1, 2, or B.
goto maintenanceModeMenu

:refreshModeMenu
echo.
echo Refresh only
echo 1. Normal
echo 2. Skip downloads
echo B. Back
echo.
set "CHOICE="
set /p CHOICE=Enter 1-2 or B:

if "%CHOICE%"=="1" goto runRefresh
if "%CHOICE%"=="2" goto runRefreshNoDownloads
if /I "%CHOICE%"=="B" goto menu

echo Enter 1, 2, or B.
goto refreshModeMenu

:runMaintenance
set "ACTION_LABEL=Course planner maintenance"
if "%HOSTED_BACK_TARGET%"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_ROOT%\run-transfer-planner-maintenance.ps1"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_ROOT%\run-transfer-planner-maintenance.ps1" -BackExitCode %BACK_EXIT_CODE%
)
goto finish

:runMaintenanceNoDownloads
set "ACTION_LABEL=Course planner maintenance (skip downloads)"
if "%HOSTED_BACK_TARGET%"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_ROOT%\run-transfer-planner-maintenance.ps1" -SkipDownloads
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_ROOT%\run-transfer-planner-maintenance.ps1" -SkipDownloads -BackExitCode %BACK_EXIT_CODE%
)
goto finish

:runRefresh
set "ACTION_LABEL=Course planner refresh"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_ROOT%\run-transfer-planner-refresh.ps1"
goto finish

:runRefreshNoDownloads
set "ACTION_LABEL=Course planner refresh (skip downloads)"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_ROOT%\run-transfer-planner-refresh.ps1" -SkipDownloads
goto finish

:runCacheSummary
set "ACTION_LABEL=Course planner cache summary"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_ROOT%\run-transfer-planner-maintenance.ps1" -ShowCacheSummary -NoPrompt -NoOpenSummary
goto finish

:runEditCourseLinks
set "ACTION_LABEL=Edit course links"
if "%HOSTED_BACK_TARGET%"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_ROOT%\run-transfer-planner-maintenance.ps1" -EditCourseLinks
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_ROOT%\run-transfer-planner-maintenance.ps1" -EditCourseLinks -BackExitCode %BACK_EXIT_CODE%
)
goto finish

:runLaymansDiagnosis
set "ACTION_LABEL=Laymans Diagnosis"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_ROOT%\run-transfer-planner-maintenance.ps1" -ShowLaymansDiagnosis -NoPrompt
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
echo   Course-Planner-Updater.bat edit-course-links
echo   Course-Planner-Updater.bat laymans-diagnosis
echo   Course-Planner-Updater.bat help
exit /b 0

:finish
set "EXIT_CODE=%ERRORLEVEL%"
if "%EXIT_CODE%"=="%BACK_EXIT_CODE%" if not "%HOSTED_BACK_TARGET%"=="" goto %HOSTED_BACK_TARGET%
echo.
if "%EXIT_CODE%"=="0" (
  echo %ACTION_LABEL% finished successfully.
) else (
  echo %ACTION_LABEL% failed with exit code %EXIT_CODE%.
)
echo.
pause
if "%INTERACTIVE_MENU%"=="1" goto menu
exit /b %EXIT_CODE%

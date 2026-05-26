@echo off
setlocal EnableExtensions

title GatorGuide Course Planner Updater
set "REPO_ROOT=%~dp0"
set "APP_ROOT=%REPO_ROOT%source"
set "SCRIPT_ROOT=%APP_ROOT%\scripts"
set "REPO_DIR_NAME=GatorGuide"
set "REPO_URL=https://github.com/MarsLuay/GatorGuide.git"
set "BACK_EXIT_CODE=86"
set "INTERACTIVE_MENU=0"
set "HOSTED_BACK_TARGET="

call :locate_or_clone_repo
if errorlevel 1 exit /b 1

cd /d "%APP_ROOT%" || (
  echo Could not open "%APP_ROOT%".
  exit /b 1
)

set "MODE=%~1"
set "ACTION_LABEL=Course planner updater"

if /I "%MODE%"=="maintenance" goto runMaintenance
if /I "%MODE%"=="maintenance-no-downloads" goto runMaintenanceNoDownloads
if /I "%MODE%"=="refresh" goto runRefresh
if /I "%MODE%"=="refresh-no-downloads" goto runRefreshNoDownloads
if /I "%MODE%"=="cache-summary" goto runCacheSummary
if /I "%MODE%"=="edit-course-links" goto runEditCourseLinks
if /I "%MODE%"=="laymans-diagnosis" goto runLaymansDiagnosis
if /I "%MODE%"=="export-fact-check" goto runFactCheckExport
if /I "%MODE%"=="help" goto printHelp
if not "%MODE%"=="" goto invalidMode

set "INTERACTIVE_MENU=1"
:menu
set "HOSTED_BACK_TARGET="
echo.
echo Course Planner Updater
echo 1. Course updates + tests
echo 2. Course updates only
echo 3. Show cache summary
echo 4. Edit course links
echo 5. Laymans Diagnosis
echo 6. Export course planner row document
echo 7. Back
echo.
set "CHOICE="
set /p CHOICE=Enter 1-7:

if "%CHOICE%"=="1" goto maintenanceModeMenu
if "%CHOICE%"=="2" goto refreshModeMenu
if "%CHOICE%"=="3" goto runCacheSummary
if "%CHOICE%"=="4" (
  set "HOSTED_BACK_TARGET=menu"
  goto runEditCourseLinks
)
if "%CHOICE%"=="5" goto runLaymansDiagnosis
if "%CHOICE%"=="6" goto runFactCheckExport
if "%CHOICE%"=="7" exit /b 0

echo Enter a number from 1 to 7.
goto menu

:maintenanceModeMenu
echo.
echo Course updates + tests
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
echo Course updates only
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
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_ROOT%\run-transfer-planner-maintenance.ps1" -NoPrompt -RunPostChecks
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_ROOT%\run-transfer-planner-maintenance.ps1" -NoPrompt -RunPostChecks -BackExitCode %BACK_EXIT_CODE%
)
goto finish

:runMaintenanceNoDownloads
set "ACTION_LABEL=Course planner maintenance (skip downloads)"
if "%HOSTED_BACK_TARGET%"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_ROOT%\run-transfer-planner-maintenance.ps1" -SkipDownloads -NoPrompt -RunPostChecks
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_ROOT%\run-transfer-planner-maintenance.ps1" -SkipDownloads -NoPrompt -RunPostChecks -BackExitCode %BACK_EXIT_CODE%
)
goto finish

:runRefresh
set "ACTION_LABEL=Course planner refresh"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_ROOT%\run-transfer-planner-refresh.ps1" -SkipVerify
goto finish

:runRefreshNoDownloads
set "ACTION_LABEL=Course planner refresh (skip downloads)"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_ROOT%\run-transfer-planner-refresh.ps1" -SkipDownloads -SkipVerify
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

:runFactCheckExport
set "ACTION_LABEL=Course planner row document export"
node "%APP_ROOT%\scripts\planner\export-transfer-planner-fact-check.cjs"
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
echo   Course-Planner-Updater.bat export-fact-check
echo   Course-Planner-Updater.bat help
exit /b 0

:finish
set "EXIT_CODE=%ERRORLEVEL%"
if exist "%APP_ROOT%\scripts\organize-tmp-artifacts.cjs" node "%APP_ROOT%\scripts\organize-tmp-artifacts.cjs" --quiet >nul 2>&1
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

:locate_or_clone_repo
if exist "%APP_ROOT%\package.json" (
  exit /b 0
)

set "CLONE_ROOT=%REPO_ROOT%%REPO_DIR_NAME%"
if exist "%CLONE_ROOT%\source\package.json" (
  set "REPO_ROOT=%CLONE_ROOT%\"
  set "APP_ROOT=%REPO_ROOT%source"
  set "SCRIPT_ROOT=%APP_ROOT%\scripts"
  echo Found Gator Guide in "%REPO_ROOT%".
  exit /b 0
)

echo Gator Guide was not found next to this launcher.
call :ensure_git
if errorlevel 1 exit /b 1

echo Cloning Gator Guide into "%CLONE_ROOT%"...
git clone "%REPO_URL%" "%CLONE_ROOT%"
if errorlevel 1 (
  echo Could not clone the repo from %REPO_URL%.
  exit /b 1
)

set "REPO_ROOT=%CLONE_ROOT%\"
set "APP_ROOT=%REPO_ROOT%source"
set "SCRIPT_ROOT=%APP_ROOT%\scripts"
if not exist "%APP_ROOT%\package.json" (
  echo The repo finished cloning, but "%APP_ROOT%\package.json" is still missing.
  exit /b 1
)

echo Repo cloned successfully.
exit /b 0

:ensure_git
set "PATH=%ProgramFiles%\Git\cmd;%ProgramFiles(x86)%\Git\cmd;%LocalAppData%\Programs\Git\cmd;%PATH%"
where git >nul 2>&1
if not errorlevel 1 (
  echo Git is already installed.
  exit /b 0
)

where winget >nul 2>&1
if errorlevel 1 (
  echo Git is missing and winget is not available on this PC.
  echo Install Git from https://git-scm.com/downloads and run this file again.
  exit /b 1
)

echo Git was not found. Installing Git with winget...
winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo Git installation failed.
  exit /b 1
)

set "PATH=%ProgramFiles%\Git\cmd;%ProgramFiles(x86)%\Git\cmd;%LocalAppData%\Programs\Git\cmd;%PATH%"
where git >nul 2>&1
if errorlevel 1 (
  echo Git was installed, but this terminal cannot find it yet.
  echo Close this window and run Course-Planner-Updater.bat again.
  exit /b 1
)

echo Git finished installing successfully.
exit /b 0

@echo off
setlocal
title GatorGuide Planner Refresh (No Downloads)
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-transfer-planner-refresh.ps1" -SkipDownloads
set EXIT_CODE=%ERRORLEVEL%
echo.
if %EXIT_CODE%==0 (
  echo Planner refresh finished successfully.
) else (
  echo Planner refresh failed with exit code %EXIT_CODE%.
)
echo.
pause
exit /b %EXIT_CODE%

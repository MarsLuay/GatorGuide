@echo off
setlocal
title GatorGuide Planner Maintenance
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-transfer-planner-maintenance.ps1"
set EXIT_CODE=%ERRORLEVEL%
echo.
if %EXIT_CODE%==0 (
  echo Planner maintenance finished successfully.
) else (
  echo Planner maintenance failed with exit code %EXIT_CODE%.
)
echo.
pause
exit /b %EXIT_CODE%

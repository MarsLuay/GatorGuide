@echo off
REM Compatibility shim: canonical launcher lives at repo root.
setlocal EnableExtensions
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "REPO_ROOT=%%~fI\"
call "%REPO_ROOT%Course-Planner-Updater.bat" %*
exit /b %ERRORLEVEL%

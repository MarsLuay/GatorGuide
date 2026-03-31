@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "NODE_SCRIPT=%SCRIPT_DIR%report-publish-size.cjs"

if not exist "%NODE_SCRIPT%" (
  echo [publish-size] Could not find "%NODE_SCRIPT%".
  exit /b 1
)

node "%NODE_SCRIPT%" %*
exit /b %ERRORLEVEL%
